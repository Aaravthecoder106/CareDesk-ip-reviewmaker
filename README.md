# CareDesk

AI-powered healthcare platform for patients and caregivers. Upload medical reports, chat with AI about your health data, visualize trends, and share insights with family.

## Features

- **Report Library** — Upload PDFs and images, AI auto-analyzes and extracts lab results, medications, and conditions
- **AI Chat** — Ask questions about your health data; AI uses your full report library for context
- **Analytics** — Interactive charts, health scores, lab trends, and AI-generated insights
- **Family Sharing** — Invite family members, share analytics, get notified about health changes
- **Library Password** — Optional password lock for your report library
- **Row-Level Security** — Every table is protected; your data is isolated and encrypted

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Auth | Clerk |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | Google Gemini (free tier) |
| UI | shadcn/ui + Tailwind CSS v4 + Recharts |
| Validation | Zod + @t3-oss/env-nextjs |

## Project Structure

```
caredesk/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/
│   │   │   ├── webhooks/           # Clerk + Razorpay webhooks
│   │   │   ├── reports/            # Upload, presign, list, delete, analyze
│   │   │   ├── chat/               # AI chat + history
│   │   │   ├── analytics/          # Data + regenerate
│   │   │   ├── family/            # Invite, accept, confirm, members
│   │   │   ├── razorpay/          # Order, verify, webhook
│   │   │   ├── subscription/      # Tier + usage status
│   │   │   ├── library/           # Password lock
│   │   │   └── feedback/          # User feedback
│   │   ├── dashboard/              # Authenticated pages
│   │   │   ├── reports/            # Report library UI
│   │   │   ├── chat/               # AI chat UI
│   │   │   ├── analytics/          # Charts & graphs
│   │   │   ├── family/             # Family sharing
│   │   │   ├── settings/           # Library password settings
│   │   │   └── upgrade/            # Pricing & checkout
│   │   ├── sign-in/                # Clerk sign-in
│   │   ├── sign-up/                # Clerk sign-up
│   │   ├── layout.tsx              # Root layout (providers)
│   │   ├── page.tsx                # Landing page
│   │   └── globals.css             # Tailwind + shadcn variables
│   ├── components/
│   │   ├── ui/                     # shadcn components
│   │   ├── header.tsx              # Public header
│   │   ├── sidebar.tsx             # Dashboard sidebar
│   │   ├── mobile-nav.tsx          # Mobile nav
│   │   └── feedback-widget.tsx     # Feedback modal
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── gemini.ts           # Gemini client (model fallbacks)
│   │   │   ├── analyze-report.ts   # Report analysis pipeline
│   │   │   └── chat.ts             # AI chat with context
│   │   ├── data/
│   │   │   ├── reports.ts          # Report CRUD
│   │   │   ├── chat.ts             # Chat history
│   │   │   ├── analytics.ts        # Analytics read/write
│   │   │   ├── family.ts           # Family members & invites
│   │   │   ├── library.ts          # Library password
│   │   │   ├── users.ts            # User identity
│   │   │   ├── provisioning.ts     # Clerk → Supabase sync
│   │   │   ├── subscriptions.ts    # Plan tiers + usage
│   │   │   └── audit.ts            # Audit logging
│   │   ├── supabase/
│   │   │   ├── client.ts           # RLS-scoped client
│   │   │   ├── admin.ts            # Service-role client
│   │   │   └── types.ts            # DB type definitions
│   │   └── ...
│   ├── env.ts                      # Env validation
│   └── middleware.ts               # Clerk route protection
├── supabase/
│   └── migrations/
│       ├── 0000_initial.sql        # Full schema (16 tables + storage)
│       ├── 0001_user_provisioning.sql
│       ├── 0002_deletion_tombstone.sql
│       ├── 0003_feedback.sql
│       └── 0004_subscriptions.sql
└── tests/
    └── provisioning.test.ts        # Unit tests
```

## Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account
- A [Clerk](https://clerk.com) account
- A [Google AI Studio](https://aistudio.google.com/apikey) account (free)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click **New Project**
3. Choose a name, database password, and region
4. Wait ~2 minutes for provisioning

### 2. Run the Database Migrations

In the Supabase dashboard, go to **SQL Editor** (left sidebar).

You need to run **5 SQL files in order**. Open each file, copy the entire contents, paste into the SQL Editor, and click **Run**. (Alternatively, apply everything in one shot with `supabase/migrations/COMBINED_ALL_MIGRATIONS.sql`.)

#### Migration 1: Full Schema

Copy the entire contents of `supabase/migrations/0000_initial.sql` and run it.

This creates:
- 16 tables (users, patients, doctors, reports, lab_results, medications, conditions, chat_messages, analytics_snapshots, family_members, family_invites, notifications, library_settings, audit_logs, deleted_users, report_embeddings)
- 2 enums (user_role, report_status)
- Row Level Security policies on every table
- A private `reports` storage bucket with ownership policies
- 2 RPC functions (accept_family_invite, confirm_family_member)
- Helper functions (clerk_user_id, tg_set_updated_at)
- Performance indexes

#### Migration 2: User Provisioning Trigger

Copy the entire contents of `supabase/migrations/0001_user_provisioning.sql` and run it.

This creates a trigger that auto-creates a `patients` row whenever a `users` row is inserted.

#### Migration 3: Deletion Tombstone

Copy the entire contents of `supabase/migrations/0002_deletion_tombstone.sql` and run it.

This creates the `deleted_users` table that prevents late webhooks from resurrecting deleted accounts.

#### Migration 4: Feedback Table

Copy the entire contents of `supabase/migrations/0003_feedback.sql` and run it.

This creates the `feedback` table used by the in-app feedback widget.

#### Migration 5: Subscriptions

Copy the entire contents of `supabase/migrations/0004_subscriptions.sql` and run it.

This creates the `subscriptions` and `razorpay_orders` tables used by the upgrade/checkout flow.

### 3. Get Supabase Keys

Go to **Settings → API** in the Supabase dashboard and copy:

| Key | Where |
|-----|-------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

### 4. Set Up Clerk

1. Go to [clerk.com](https://clerk.com) and sign up
2. Create a new application
3. Copy keys from **API Keys**:
   - **Publishable key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret key** → `CLERK_SECRET_KEY`
4. Go to **Webhooks** → Create endpoint:
   - URL: `https://your-domain.com/api/webhooks/clerk`
   - Copy the **Signing secret** → `CLERK_WEBHOOK_SIGNING_SECRET`
5. Go to **Integrations** → Enable **Supabase**

### 5. Get Gemini API Key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create a free API key
3. Add to `.env` as `GEMINI_API_KEY=your_key`

### 6. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```env
# Core (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# AI (required for report analysis & chat)
GEMINI_API_KEY=AIza...

# Payments (optional — upgrade page shows a friendly error without them)
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Email invites (optional — falls back to a shareable invite code)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=CareDesk <onboarding@resend.dev>

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

Optional integrations fail gracefully:
- **Gemini missing** → report analysis/chat return a clear "AI not configured" error
- **Razorpay missing** → upgrade/checkout is disabled with a friendly message
- **Resend missing** → family invites return a copyable code (WhatsApp/SMS fallback)

### 7. (Optional) Set Up Razorpay

1. Go to [razorpay.com](https://razorpay.com) and create an account
2. Copy keys from **Settings → API Keys**:
   - **Key ID** → `RAZORPAY_KEY_ID`
   - **Key Secret** → `RAZORPAY_KEY_SECRET`
3. Go to **Settings → Webhooks** → Create webhook:
   - URL: `https://your-domain.com/api/razorpay/webhook`
   - Events: `payment.captured`
   - Copy the **Secret** → `RAZORPAY_WEBHOOK_SECRET`

### 8. (Optional) Set Up Resend for Invite Emails

1. Go to [resend.com](https://resend.com) and sign up
2. Create an API key → `RESEND_API_KEY`
3. Set a verified sender → `RESEND_FROM_EMAIL`

Without Resend, family invites still work — the UI shows the invite code for manual sharing (WhatsApp/SMS/copy).

### 9. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `users` | Identity (synced from Clerk, TEXT primary key) |
| `patients` | Patient profiles (1:1 with users) |
| `doctors` | Doctor profiles (portal deferred) |
| `patient_doctor_relations` | Consent edges between doctors and patients |
| `reports` | Medical report metadata + AI summary |
| `report_embeddings` | pgvector embeddings for RAG (768 dims) |
| `lab_results` | Normalized lab test data |
| `medications` | Patient medications |
| `conditions` | Diagnosed conditions |
| `chat_messages` | AI chat history |
| `analytics_snapshots` | JSONB analytics data |
| `family_members` | Mutual-consent family links |
| `family_invites` | Token-based family invites |
| `notifications` | User notifications |
| `library_settings` | Password hash + salt for library lock |
| `audit_logs` | HIPAA audit trail (service-role only) |
| `deleted_users` | Deletion tombstones |
| `feedback` | In-app feedback widget submissions |
| `subscriptions` | Plan tier, status, and period |
| `razorpay_orders` | Payment orders (idempotent activation) |

### Enums

- `user_role`: `patient`, `doctor`, `admin`
- `report_status`: `pending`, `processing`, `ready`, `failed`

### Security

- **RLS on every table** — policies use `public.clerk_user_id()` to extract the Clerk user id from JWT
- **Column-level grants** — `role` column excluded from UPDATE to prevent self-promotion
- **Two Supabase clients** — `client.ts` (RLS-scoped) and `admin.ts` (service-role, bypasses RLS)
- **Storage policies** — folder-level ownership via `<clerk_user_id>/` path convention
- **Deletion tombstones** — prevents late webhooks from resurrecting deleted accounts

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/webhooks/clerk` | POST | Clerk webhook (user sync) |
| `/api/reports/upload` | POST | Upload report to storage |
| `/api/reports/presign` | POST | Direct-upload URL (bypasses body-size limit) |
| `/api/reports/list` | GET | List user's reports |
| `/api/reports/delete` | DELETE | Delete report + storage file |
| `/api/reports/analyze` | POST | Re-analyze a report |
| `/api/reports/analyze-image` | POST | Analyze report image with Gemini vision |
| `/api/reports/preview` | GET | Signed preview URL for a report |
| `/api/chat` | POST | Send message, get AI reply |
| `/api/chat/history` | GET | Get chat history |
| `/api/chat/clear` | DELETE | Clear all chat messages |
| `/api/analytics/data` | GET | Get stored analytics |
| `/api/analytics/regenerate` | POST | AI-generate health analytics |
| `/api/family/invite` | POST | Create family invite |
| `/api/family/members` | GET | Get family members |
| `/api/family/invites` | GET | Get pending invites |
| `/api/family/accept` | POST | Accept invite (via RPC) |
| `/api/family/member` | POST/DELETE | Confirm or remove member |
| `/api/library/password` | POST | Set/verify/remove library password |
| `/api/feedback` | POST | Submit feedback (GET admin-only) |
| `/api/notifications` | GET/POST | List / mark notifications read |
| `/api/razorpay/order` | POST | Create payment order |
| `/api/razorpay/verify` | POST | Verify payment + activate plan |
| `/api/razorpay/webhook` | POST | Razorpay webhook (payment.captured) |
| `/api/subscription/status` | GET | Current tier, limits, and usage |

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
npm test         # Run unit tests
```

## How It Works

### Auth Flow
1. User signs up via Clerk → webhook fires → `provisionUser()` creates `users` + `patients` rows
2. On first page load, `ensureCurrentUserProvisioned()` self-heals if webhook hasn't landed
3. All data queries use RLS-scoped client → user can only see their own data

### Report Analysis Pipeline
1. User uploads PDF/image → stored in Supabase Storage under `<user_id>/`
2. Background job calls Gemini → extracts summary, lab results, medications, conditions
3. Results written to `reports`, `lab_results`, `medications`, `conditions` tables
4. Analytics can be regenerated from this structured data

### AI Chat
1. User sends message → system fetches all reports, labs, meds, conditions from DB
2. Context injected into Gemini prompt → AI responds with personalized answer
3. Messages saved to `chat_messages` for history

### Family Sharing
1. Owner invites by email → creates `family_invites` row with random token
2. Invitee accepts (via `accept_family_invite` RPC) → creates `family_members` row (status: `pending_owner`)
3. Owner confirms (via `confirm_family_member` RPC) → status flips to `accepted`
4. Both can now read each other's `analytics_snapshots`

## License

Private — not for distribution.
