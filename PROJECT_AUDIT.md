# CareDesk Project Audit & Architecture Review

## Executive Summary
This document serves as the **Final Architecture Review** for CareDesk. As the Principal Engineer, I have evaluated the current prototype against the requirements of a production-grade, investor-ready, and HIPAA-compliant healthcare application designed to scale for the next 10 years.

The current architecture is a functional MVP built on TanStack Start, Supabase, and Lovable AI Gateway. While excellent for a quick prototype, it carries significant technical debt, security risks for PHI (Protected Health Information), and scalability bottlenecks that must be resolved before securing funding and scaling to thousands of users.

---

## Part 1: Current State Assessment

### 1. Current Tech Stack
- **Frontend**: TanStack Start, React 19, Tailwind CSS 4, shadcn/ui.
- **Backend**: Supabase (PostgreSQL, Auth, Storage).
- **AI**: Lovable AI Gateway (Vercel AI SDK compatible).

### 2. Folder Structure
- `src/components`: UI components (shadcn/ui), `analytics-view`, `app-shell`.
- `src/routes`: TanStack Router routes.
- `src/lib`: Server functions (`ai.functions.ts`, `ai-gateway.server.ts`), utilities.
- `supabase/migrations`: SQL migrations for DB schema and RLS.

### 3. Existing Features
- User Authentication (Supabase Auth).
- Report Upload & Library (with password lock).
- AI Report Extraction & Summarization (Synchronous).
- Chat with AI (Basic concatenation context).
- Analytics Dashboard (JSONB snapshots).
- Family Member Invites & Sharing.

### 4. Broken Features
- **AI Context Window Limits**: Chat history and report summaries are blindly concatenated. This will quickly exceed LLM token limits and fail as patients upload more reports.
- **Synchronous AI Processing**: Uploading a report triggers a synchronous server function to parse it with AI and regenerate all analytics. This will timeout on large PDFs or under load.

### 5. Lovable-specific Dependencies
- `@lovable.dev/cloud-auth-js`, `@lovable.dev/vite-tanstack-config`, `lovable/ai-gateway`.
- **Action**: These must be removed to avoid vendor lock-in and transition to standard Next.js 15 + Clerk + direct AI providers.

### 6. Technical Debt
- **Analytics Regeneration**: Rebuilding the entire `analytics_snapshots` JSONB object from scratch on every upload is $O(N^2)$ and unscalable.
- **Missing Doctor Domain**: The database only supports patients and family members. There is no `doctors` table, clinic mapping, or patient-doctor relationship mapping.

### 7. Security Issues
- **No PHI Audit Logs**: Missing HIPAA-compliant audit trails for who views which medical record.
- **Plaintext PHI**: Medical extractions are stored in plaintext JSONB.
- **File Access**: Signed URLs are passed directly to external AI APIs.

### 8. Missing Features
- Clerk Authentication integration.
- Vector Database (pgvector) for true RAG.
- Doctor/Professional dashboard and RBAC (Role-Based Access Control).

### 9. Refactoring Opportunities
- Migrate from TanStack Start to **Next.js 15 App Router**.
- Decouple AI extraction into asynchronous background jobs.
- Normalize the `analytics_snapshots` into relational tables (`lab_results`, `medications`).

---

## Part 2: Critical Architecture Review (30 Points)

| Weakness | Why it is a problem | Production-Grade Solution |
| :--- | :--- | :--- |
| **1. Database normalization** | Analytics and AI extractions are stored as massive JSONB blobs. Querying a specific lab trend across populations or indexing is impossible. | Normalize into `lab_results`, `medications`, `conditions` tables with foreign keys to `reports` and `patients`. |
| **2. Security** | PHI is in plaintext. A DB dump exposes all patient data. | Implement Application-Level Encryption (ALE) or strictly rely on Supabase Transparent Data Encryption (TDE) with strict RLS. |
| **3. Row Level Security policies** | Currently relies on `auth.uid() = user_id`. Moving to Clerk will break this because Clerk IDs are strings, while Supabase uses UUIDs. | Update RLS to use `request.jwt.claims` injected by Clerk via Supabase Custom JWT integration. |
| **4. Clerk ↔ Supabase synchronization** | Does not exist yet. | Use Clerk Webhooks (`user.created`, `user.updated`) to sync profiles to Supabase, or strictly use Clerk JWTs to authenticate Supabase requests. |
| **5. AI pipeline** | Synchronous API calls block the UI and risk Vercel function timeouts (max 10s-60s). | Move to an event-driven architecture. Upload file → Supabase Webhook → Next.js Background Route/Inngest → Update DB status. |
| **6. OCR pipeline** | Relies entirely on LLM vision. Expensive and prone to hallucination on blurry medical documents. | Add a dedicated OCR pre-processing step (e.g., AWS Textract or GCP Document AI) before passing structured text to the LLM. |
| **7. RAG pipeline** | Currently uses basic string concatenation of the last 30 reports. Unscalable and loses context. | Implement `pgvector` in Supabase. Generate embeddings for each report paragraph. Use similarity search to fetch relevant chunks for the Chat context. |
| **8. File upload scalability** | Files are fetched as Base64 into server memory, crashing on large PDFs. | Direct client-to-Supabase Storage uploads. Pass the Supabase Storage URI to the backend worker, avoiding memory bloat. |
| **9. Medical report schema** | `ai_extracted` is loosely typed JSON. Prone to runtime errors if the AI hallucinates keys. | Enforce strict schema validation using `zod` and `Instructor` or structured outputs (OpenAI/Gemini JSON mode) before saving to DB. |
| **10. Dashboard performance** | Calculating charts requires parsing large JSONB snapshots on the fly. | Use normalized tables and database views/materialized views for fast charting. |
| **11. Analytics scalability** | Regenerating analytics iterates over *all* past reports on every new upload. | Incremental updates. When a new report is processed, only insert the *new* data points into the normalized tables. |
| **12. Future migration risks** | Tight coupling to TanStack and Lovable limits hiring and scaling. | Standardize on Next.js 15, which has the largest ecosystem and developer pool. |
| **13. Vendor lock-in** | Using Lovable AI Gateway prevents utilizing specific features of OpenAI/Gemini/Claude. | Implement a Provider-Agnostic AI Adapter Interface (designed below). |
| **14. Cost optimization** | Sending the entire report history on every chat message burns LLM tokens ($$$). | True RAG (Vector search) ensures only the top 3-5 relevant report chunks are sent to the LLM per query. |
| **15. Edge Functions** | Using standard server functions for AI processing. | Use Next.js App Router background jobs or Supabase Edge Functions with higher timeout limits for AI processing. |
| **16. API security** | No API rate limiting. Vulnerable to DDoS or token exhaustion attacks. | Implement Upstash Rate Limit or Vercel KV Rate Limiting on all API routes. |
| **17. Role permissions** | No RBAC. Doctors and Patients share the same schema. | Implement `roles` enum (`patient`, `doctor`, `admin`) and separate `doctor_profiles` and `patient_doctor_relations` tables. |
| **18. Error handling** | Basic `try/catch` with console logs. Fails silently in production. | Integrate Sentry for frontend and backend error tracking. Use standard problem details (RFC 7807) for API responses. |
| **19. Logging** | Missing structured logging. | Implement Pino or Winston for structured JSON logging. Send logs to Datadog or Axiom. |
| **20. Monitoring** | Missing uptime and performance monitoring. | Integrate Vercel Analytics and Datadog for APM. |
| **21. Audit trail** | Missing completely. Critical for HIPAA compliance. | Create an `audit_logs` table. Log every `SELECT`, `INSERT`, `UPDATE` on PHI with `actor_id`, `action`, `target_id`, `timestamp`, and `ip_address`. |
| **22. Caching** | No caching layer. Repeated queries hit the DB. | Utilize Next.js Data Cache and Vercel KV (Redis) for frequently accessed, non-sensitive metadata. |
| **23. Rate limiting** | None. | Apply strict rate limits to AI Chat (e.g., 20 messages/hour) and Report Uploads (e.g., 50/day) to prevent abuse. |
| **24. Folder structure** | TanStack specific. | Adopt Next.js feature-sliced architecture (`src/app`, `src/features`, `src/components`, `src/lib`). |
| **25. API route organization** | Server functions mixed in `lib`. | Move to Next.js Route Handlers (`src/app/api/...`) or tRPC for type-safe APIs. |
| **26. Environment variables** | Unvalidated `process.env`. | Use `@t3-oss/env-nextjs` for strict Zod validation of environment variables at build and runtime. |
| **27. Secrets management** | Relies on local `.env`. | Use Vercel Environment Variables and Infisical/Doppler for secret management in production. |
| **28. Testing strategy** | No tests. | Implement Vitest for unit tests (especially AI parsing logic) and Playwright for critical user flows (e.g., uploading a report). |
| **29. CI/CD** | Undefined. | Implement GitHub Actions for linting, type-checking, testing, and automated Vercel deployments. |
| **30. Deployment strategy** | Undefined. | Deploy on Vercel with preview environments for PRs and a production environment tied to the `main` branch. |

---

## Part 3: Feature Classification & Roadmap

### ✅ Keep
- **Supabase PostgreSQL & Storage**: Robust, scalable, and secure base.
- **shadcn/ui & Tailwind**: Industry standard for fast, premium UI development.
- **Family Sharing**: High value for caregiver engagement.

### 🟡 Improve
- **AI Pipeline**: Must move from synchronous concatenation to asynchronous RAG (pgvector).
- **Analytics**: Move from JSONB blobs to normalized relational tables.
- **Authentication**: Migrate from Supabase Auth to **Clerk** for better B2B (Doctor clinics) and B2C (Patients) support, MFA, and organization management.

### 🔴 Remove
- **TanStack Start**: Migrate to Next.js 15 App Router. Next.js is the industry standard for React frameworks, easier to hire for, and natively supports Vercel's edge network.
- **Lovable Dependencies**: Remove `@lovable.dev/*` to ensure the codebase is 100% owned and un-ejected.
- **Password-locked Library**: Instead of a custom password hash table, use Clerk's Step-Up Authentication (MFA/Re-auth) to unlock sensitive areas. It is much more secure.

### 🔵 Move to Future Version
- **Complex Predictive AI**: Focus the MVP on extraction, summarization, and RAG. Leave predictive diagnostics to V2.
- **Wearable Integration (Apple Health/Fitbit)**: High engineering cost, low MVP necessity.

---

## Part 4: AI Abstraction Design (Provider-Agnostic)

To ensure CareDesk is immune to vendor lock-in and can instantly switch between Gemini, Claude, or OpenAI, we implement the **Strategy Pattern** via an interface.

```typescript
// src/lib/ai/types.ts
export interface ExtractedMedicalData {
  summary: string;
  report_type: string;
  report_date: string | null;
  conditions: string[];
  medications: Array<{ name: string; dose: string }>;
  labs: Array<{ name: string; value: number; unit: string; flag: string }>;
  flags: string[];
}

export interface AIChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIProvider {
  /** Extracts structured JSON from a medical report (PDF/Image) */
  extractMedicalData(fileBase64: string, mimeType: string): Promise<ExtractedMedicalData>;
  
  /** Handles chat using RAG context */
  chat(messages: AIChatMessage[], context: string): Promise<string>;
  
  /** Generates embeddings for pgvector */
  generateEmbeddings(text: string): Promise<number[]>;
}
```

```typescript
// src/lib/ai/adapters/gemini.ts
import { AIProvider, ExtractedMedicalData, AIChatMessage } from "../types";
import { generateText, embed } from "ai";
import { google } from "@ai-sdk/google";

export class GeminiAdapter implements AIProvider {
  async extractMedicalData(fileBase64: string, mimeType: string): Promise<ExtractedMedicalData> {
    // Implementation using google('gemini-1.5-pro')
  }
  async chat(messages: AIChatMessage[], context: string): Promise<string> {
    // Implementation
  }
  async generateEmbeddings(text: string): Promise<number[]> {
    // Implementation using google.textEmbeddingModel('text-embedding-004')
  }
}
```

```typescript
// src/lib/ai/factory.ts
import { AIProvider } from "./types";
import { GeminiAdapter } from "./adapters/gemini";
import { OpenAIAdapter } from "./adapters/openai";

export class AIFactory {
  static getProvider(): AIProvider {
    const provider = process.env.AI_PROVIDER || "gemini";
    
    switch (provider) {
      case "openai":
        return new OpenAIAdapter();
      case "gemini":
      default:
        return new GeminiAdapter();
    }
  }
}

// Usage in business logic:
// const ai = AIFactory.getProvider();
// const data = await ai.extractMedicalData(file, mime);
```

---

## Architecture Version 1.0 (Final)

### 1. Improved Product Structure (Next.js 15 App Router)
- **Frontend**: Next.js 15 (React 19), Tailwind CSS, shadcn/ui, Framer Motion, Recharts.
- **Backend**: Next.js Route Handlers (`/api/*`), Supabase PostgreSQL, Supabase Storage.
- **Auth**: Clerk (Handles B2C Patients, B2B Clinics via Organizations).
- **AI**: Vercel AI SDK + AIFactory (Gemini as default).

### 2. Improved Folder Structure
```text
caredesk/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── (marketing)/        # Landing page, About, Privacy
│   │   ├── (auth)/             # Clerk sign-in, sign-up
│   │   ├── (patient)/          # Patient Dashboard, Reports, Chat
│   │   ├── (doctor)/           # Doctor Dashboard, Patient Search
│   │   └── api/                # Route Handlers (Webhooks, AI)
│   ├── components/             # shadcn UI + custom components
│   ├── features/               # Feature-sliced domains (auth, reports, chat, analytics)
│   ├── lib/                    # Utilities, Supabase client, Clerk sync
│   └── ai/                     # AI Factory and Adapters
├── supabase/
│   └── migrations/             # SQL schemas, RLS, pgvector setup
└── public/                     # Static assets
```

### 3. Improved Database Design (Normalized)
- `users` (Synced from Clerk, contains role: `patient` | `doctor`).
- `doctors` (Doctor specific details, clinic name).
- `patients` (Patient specific details).
- `patient_doctor_relations` (Maps doctors to patients for access).
- `reports` (Metadata and status: pending, processed, failed).
- `report_embeddings` (pgvector chunks for RAG).
- `lab_results` (Normalized: `report_id`, `patient_id`, `test_name`, `value`, `unit`, `date`).
- `medications` (Normalized list).
- `conditions` (Normalized list).
- `family_members` (Caregiver relationships).
- `audit_logs` (HIPAA compliance logging).

### 4. Improved User Flow
**Patient Flow**:
1. Sign up via Clerk.
2. Dashboard shows empty state -> Prompts to upload a report.
3. Uploads PDF directly to Supabase Storage -> Triggers async API route.
4. AI Factory extracts data -> Saves to normalized tables -> Generates Embeddings.
5. Patient views interactive Recharts based on `lab_results` table.
6. Patient chats with AI -> System uses pgvector to find relevant report chunks -> AI answers.

**Doctor Flow**:
1. Sign up via Clerk (Requests verification/NPI number).
2. Dashboard shows patient search.
3. Doctor requests access to Patient via email/phone.
4. Patient approves -> Relation created.
5. Doctor searches Patient Name -> Instantly sees normalized timeline of labs, AI summaries, and original PDFs.

### 5. MVP Scope
- Clerk Auth (Patients & Doctors).
- Report Upload (PDF/Images) with Async AI Extraction (Gemini).
- Normalized Analytics Dashboard (Recharts).
- AI Chat (RAG via pgvector).
- Basic Doctor Search & View Patient History.

### 6. Future Roadmap
- Predictive Diagnostics / Health Risk Scoring.
- Wearable Integrations (Apple HealthKit).
- Clinic/Hospital EMR (Electronic Medical Record) integration (HL7/FHIR).
- Subscription tiers (Stripe).

### 7. Security Improvements
- Switch from custom password-lock to **Clerk Step-Up Auth** for accessing the Report Library.
- Implement strictly enforced **RLS** utilizing `request.jwt.claims` synced from Clerk.
- Enforce **Audit Logging** via PostgreSQL triggers on all PHI tables.

### 8. AI Pipeline Redesign
- **Asynchronous**: Client uploads to Supabase Storage -> Client polls status -> Next.js Background job fetches file, extracts JSON via AIFactory, normalizes data, generates chunks, generates embeddings, saves to DB.

---

### Conclusion
This architecture removes the technical debt of the prototype, eliminates vendor lock-in, normalizes the database for performance, introduces a secure HIPAA-ready foundation, and establishes a scalable provider-agnostic AI layer. 

**Awaiting your approval to freeze this architecture.**
file_path: c:\Users\Aarav Kumar\Downloads\caredesk-ip-main\PROJECT_AUDIT.md