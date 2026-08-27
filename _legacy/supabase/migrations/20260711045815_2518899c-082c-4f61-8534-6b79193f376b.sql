
-- Mutual permission workflow: accept sets status to pending owner confirmation.
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
  VALUES (v_invite.owner_id, v_uid, v_invite.relation, 'pending_owner')
  ON CONFLICT (owner_id, member_id) DO UPDATE SET status = 'pending_owner';
  UPDATE public.family_invites SET status = 'accepted' WHERE id = v_invite.id;
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (v_invite.owner_id, 'family_pending', 'Confirm family member', v_invite.email || ' accepted your invite — confirm to unlock shared analytics');
  RETURN jsonb_build_object('ok', true, 'owner_id', v_invite.owner_id, 'status', 'pending_owner');
END;
$$;

-- Owner confirms the pending member to unlock mutual permission.
CREATE OR REPLACE FUNCTION public.confirm_family_member(_member_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.family_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_row FROM public.family_members
    WHERE id = _member_id AND owner_id = v_uid AND status = 'pending_owner';
  IF NOT FOUND THEN RAISE EXCEPTION 'no pending link to confirm'; END IF;
  UPDATE public.family_members SET status = 'accepted' WHERE id = _member_id;
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (v_row.member_id, 'family_confirmed', 'Family link confirmed', 'Shared analytics are now available.');
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_family_member(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_family_member(UUID) FROM PUBLIC, anon;
