
# CareDesk — Patient/Caregiver Prototype

Goal: an investor-ready working prototype of the patient/caregiver side. Real accounts, real uploads, real AI. Doctor side is deferred.

Lovable AI (Gemini) works both in preview and after deployment — no external Gemini key needed. Free monthly allowance covers demo use; if it runs out during a demo we can top up credits.

## Step 1 — Design directions (before building)

I'll generate 3 rendered concepts for the app shell (dashboard + report library + AI chat + analytics look and feel), all in a trustworthy healthtech aesthetic but with different personalities (e.g. calm clinical / warm human / data-forward modern). You pick one, then I build the whole app in that direction.

## Step 2 — Backend (Lovable Cloud)

Enable Lovable Cloud. Auth: email/password + Google. Tables:

- `profiles` — id, full_name, avatar, created_at
- `reports` — id, user_id, title, file_path, mime, uploaded_at, ai_summary, ai_extracted (jsonb), password_hash (for library lock)
- `chat_conversations` + `chat_messages` — per-user AI chat, so context persists
- `analytics_snapshots` — id, user_id, generated_at, data (jsonb: metrics/series the charts read from)
- `family_members` — id, owner_user_id, member_user_id, status (invited/accepted), permissions
- `family_invites` — id, owner_user_id, email, token, status
- `notifications` — id, user_id, type, payload, read_at

All tables RLS-scoped to `auth.uid()`; family visibility gated through `family_members`. Storage bucket `reports` (private, user-scoped path).

## Step 3 — Pages / routes

- `/auth` — sign in / sign up
- `/` (authed) — dashboard: recent reports, latest insights, family status
- `/reports` — Report Library (password-locked on first entry per session)
- `/chat` — AI Chat (context = all report summaries)
- `/analytics` — auto-generated charts from report data
- `/family` — invite family, list members, per-member analytics view
- `/settings` — profile, library password, notifications
- `/upgrade` — placeholder pricing page (no real payments yet)
- `/about`, `/privacy` — static pages

## Step 4 — Feature behavior

**Report Library**
- Upload PDF / image / doc → stored in Storage.
- Server function calls Lovable AI (Gemini 3 Flash) to extract a structured summary + key medical values (labs, vitals, diagnoses, meds) into `ai_extracted`.
- Summary appended to the user's chat context and analytics snapshot.
- Library requires a user-set password to unlock (hashed, per-session unlock).

**AI Chat**
- Streaming chat via TanStack server route `/api/chat` + AI SDK.
- System prompt injects the user's aggregated report summaries.
- Users can attach images inline; files/PDFs must go through Report Library (per architecture).

**Analytics**
- On new upload, regenerate `analytics_snapshots.data` from all `ai_extracted`.
- Renders interactive charts (Recharts): trend lines for labs over time, pie of conditions, vitals cards.

**Family**
- Invite by email → email link with token (uses Lovable AI Gateway's Resend connector or logs invite link if email not configured).
- Accepted members see each other's analytics page (not raw reports).
- Background check: after each new report, compare against prior snapshot; if AI flags anomalies, insert notifications for owner + family.

**Notifications** — bell in header, list page.

## Step 5 — Polish for the demo

- Seed demo data option on signup ("Load sample patient") so investors see a populated app immediately.
- Empty states, loading skeletons, toasts.
- Landing/marketing top of `/` when signed out, explaining the product.
- SEO metadata per route, favicon, OG image.

## Technical notes

- Stack: TanStack Start + Supabase (Lovable Cloud) + AI SDK + Lovable AI Gateway (`google/gemini-3-flash-preview` for chat/extraction).
- Server functions for uploads, AI extraction, analytics regeneration, family invites.
- Streaming chat via `src/routes/api/chat.ts`.
- All AI calls server-side; `LOVABLE_API_KEY` auto-provisioned.
- Doctor side, real payments, and real email delivery are explicitly out of scope for this pass.

## What I'll do next after you approve

1. Generate 3 design directions and ask you to pick one.
2. Enable Lovable Cloud + schema + auth.
3. Build the app in the chosen direction, feature by feature in the order above.
