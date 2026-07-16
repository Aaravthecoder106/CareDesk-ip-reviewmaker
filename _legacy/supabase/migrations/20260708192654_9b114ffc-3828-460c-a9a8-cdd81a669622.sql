
-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Library settings (password lock)
CREATE TABLE public.library_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_settings TO authenticated;
GRANT ALL ON public.library_settings TO service_role;
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own library settings" ON public.library_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reports
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  ai_summary TEXT,
  ai_extracted JSONB,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports" ON public.reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX reports_user_created_idx ON public.reports(user_id, created_at DESC);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat" ON public.chat_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX chat_messages_user_created_idx ON public.chat_messages(user_id, created_at ASC);

-- Analytics snapshots
CREATE TABLE public.analytics_snapshots (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_snapshots TO authenticated;
GRANT ALL ON public.analytics_snapshots TO service_role;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- Family members
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  relation TEXT,
  status TEXT NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own family links" ON public.family_members FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = member_id)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = member_id);

-- Now that family_members exists, add analytics policies that let linked family read
CREATE POLICY "own or family analytics read" ON public.analytics_snapshots FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.status = 'accepted'
        AND (
          (fm.owner_id = analytics_snapshots.user_id AND fm.member_id = auth.uid())
          OR (fm.member_id = analytics_snapshots.user_id AND fm.owner_id = auth.uid())
        )
    )
  );
CREATE POLICY "own analytics write" ON public.analytics_snapshots FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own analytics update" ON public.analytics_snapshots FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Family profile read: needed to show family member names
CREATE POLICY "family profile read" ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.status = 'accepted'
        AND (
          (fm.owner_id = profiles.id AND fm.member_id = auth.uid())
          OR (fm.member_id = profiles.id AND fm.owner_id = auth.uid())
        )
    )
  );

-- Family invites
CREATE TABLE public.family_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  relation TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_invites TO authenticated;
GRANT ALL ON public.family_invites TO service_role;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invites read" ON public.family_invites FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own invites write" ON public.family_invites FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own invites delete" ON public.family_invites FOR DELETE TO authenticated USING (auth.uid() = owner_id);
-- Accepting an invite: the invitee reads/updates by token via a security-definer function (below)

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- Accept invite function
CREATE OR REPLACE FUNCTION public.accept_family_invite(_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.family_invites%ROWTYPE;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_invite FROM public.family_invites WHERE token = _token AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid or used invite'; END IF;
  IF v_invite.owner_id = v_uid THEN RAISE EXCEPTION 'cannot accept own invite'; END IF;
  INSERT INTO public.family_members (owner_id, member_id, relation, status)
  VALUES (v_invite.owner_id, v_uid, v_invite.relation, 'accepted')
  ON CONFLICT (owner_id, member_id) DO UPDATE SET status = 'accepted';
  UPDATE public.family_invites SET status = 'accepted' WHERE id = v_invite.id;
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (v_invite.owner_id, 'family_joined', 'Family member joined', v_invite.email || ' accepted your invite');
  RETURN jsonb_build_object('ok', true, 'owner_id', v_invite.owner_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_family_invite(TEXT) TO authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER tg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_reports_updated BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_library_updated BEFORE UPDATE ON public.library_settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
