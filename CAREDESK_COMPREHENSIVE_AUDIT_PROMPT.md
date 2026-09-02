# CareDesk: Comprehensive Codebase Audit Prompt

**Project**: CareDesk (AI-powered healthcare platform)  
**Tech Stack**: Next.js 15 + React 19 + TypeScript + Supabase + Clerk + Gemini AI + Razorpay  
**Objective**: Full codebase audit to identify blockers, errors, and issues preventing webapp launch

---

## INSTRUCTIONS FOR AI AUDITOR

You are a Principal Software Engineer tasked with auditing a production healthcare webapp. Your goal is to:

1. **Identify all blockers** that prevent the app from launching (critical issues)
2. **Find all errors** — runtime, TypeScript, configuration, environment, dependency
3. **List architectural issues** that will cause problems at scale
4. **Security assessment** — especially for healthcare/PHI context
5. **Provide audit, not fixes** — describe issues clearly, but don't rewrite code

---

## PART 1: CRITICAL BLOCKERS (LAUNCH STOPPERS)

**Analyze these areas and report YES or NO for each blocker:**

### 1. Environment & Secrets
- [ ] Is `.env.local` or `.env` file present and complete?
- [ ] Are all required env vars defined? (Check against `src/env.ts`)
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  - CLERK_SECRET_KEY
  - CLERK_WEBHOOK_SIGNING_SECRET
  - GEMINI_API_KEY
  - RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, etc.
- [ ] Are placeholder defaults in `src/env.ts` causing validation failures?
  - Flag: Lines 14-19 set `.default('placeholder')` for Razorpay & Gemini
  - Issue: Will the app boot if these are missing? Check `skipValidation` logic
- [ ] Will `SKIP_ENV_VALIDATION` bypass critical checks and hide missing secrets?

### 2. Dependency Installation
- [ ] Do `package.json` dependencies resolve without conflicts?
- [ ] Are there peer dependency warnings?
- [ ] Is `node_modules` size reasonable (no bloat)?
- [ ] Check: Are all imports in code actually present in `package.json`?
  - Flag: `@google/generative-ai`, `@clerk/nextjs`, `@supabase/supabase-js`, `razorpay`, `resend`

### 3. AI Model Configuration (CRITICAL)
- [ ] Check `src/lib/ai/gemini.ts` line 9:
  - **ISSUE FOUND**: `PRIMARY_MODEL = 'gemini-3-flash-preview'` — **This model does not exist**
  - Gemini valid models: `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`
  - **Will this cause app to crash on first AI request?**
- [ ] Does fallback model `gemini-flash-lite-latest` exist and work?
- [ ] Is error handling for 404/quota errors tested?

### 4. Database Setup
- [ ] Are Supabase migrations in `supabase/migrations/` actually compatible with Clerk ID format?
  - Issue: RLS policies use `public.clerk_user_id()` but is this function defined?
  - Check: `0000_initial.sql` creates this function?
- [ ] Do migrations need to be run manually before first launch?
- [ ] Is there a migration runner script? (not found in `scripts/`)

### 5. Authentication Setup
- [ ] Is Clerk configured as a provider in Supabase dashboard?
  - Needed: Custom JWT integration to pass Clerk user ID to RLS policies
  - If missing: All RLS policies will fail and users see "permission denied"
- [ ] Does middleware correctly protect routes?
  - Check: `src/middleware.ts` uses lazy-loading with `require()` — safe pattern?
  - Public routes: `/`, `/sign-in`, `/sign-up`, `/api/webhooks` — correct?
- [ ] Clerk webhook configured?
  - Needs: `CLERK_WEBHOOK_SIGNING_SECRET` and endpoint at `/api/webhooks/clerk`
  - Check: Route handler at `src/app/api/webhooks/clerk/route.ts` exists and validates signature

### 6. Build & Compilation
- [ ] Does TypeScript compilation succeed? (`npm run build`)
  - Flag: `strict: true` in tsconfig — any loose types?
  - Check for common errors:
    - Missing async/await in API routes
    - Unhandled Promise rejections
    - Type mismatches in Supabase calls
- [ ] Does Turbopack build without warnings?
  - Warning: `turbopack.root` is set to `import.meta.dirname` — correct in monorepo context?
- [ ] Are there circular dependency issues?

### 7. API Routes
- [ ] Do all API routes have proper error handling?
- [ ] Are auth checks on protected routes?
  - Flag: Check if every protected route calls `auth()` and validates `userId`
- [ ] Is rate limiting actually preventing abuse?
  - Check: `src/lib/rate-limit.ts` and `src/lib/api-helpers.ts`
  - Issue: If rate limit isn't working, chat/upload endpoints are DoS-vulnerable
- [ ] Do file uploads validate size and MIME type?
  - Check: `src/app/api/reports/upload/route.ts`
  - Issue: Large file handling could crash serverless function

### 8. Webhook Handlers
- [ ] Does Clerk webhook handler validate signature?
  - Check: `src/app/api/webhooks/clerk/route.ts`
  - Missing validation = replay attacks, fake user creations
- [ ] Does Razorpay webhook validate signature?
  - Check: `src/app/api/razorpay/webhook/route.ts`

### 9. Third-Party Integrations
- [ ] Is Resend (email service) actually needed and configured?
  - Check: No `RESEND_API_KEY` in env schema — will email sending fail silently?
- [ ] Is Razorpay hardcoded as only payment provider?
  - Issue: No fallback if Razorpay is down
- [ ] Are API keys properly scoped (not overprivileged)?

### 10. Data Layer & ORM
- [ ] Are Supabase clients correctly instantiated?
  - Check: `src/lib/supabase/client.ts` (RLS-scoped) vs `src/lib/supabase/admin.ts` (bypasses RLS)
  - Issue: Is admin client accidentally used in user-facing code?
- [ ] Do queries properly handle null/undefined?
  - Pattern check: `maybeSingle()` vs `single()` usage

---

## PART 2: ERROR ANALYSIS

### TypeScript Errors
- [ ] Run `npm run build` — are there type errors?
- [ ] Check for `any` types — how many unsafe escapes?
- [ ] Unused imports/variables?

### Import Errors
- [ ] Can all imports resolve? (Check `@/` alias paths)
- [ ] Are server-only functions marked with `'use server'` or `'use client'`?
- [ ] Are client components importing server-only modules? (e.g., `server-only`, `@supabase/supabase-js` in client code)

### Runtime Errors
- [ ] Will app boot and render first page?
- [ ] Will sign-in flow work?
- [ ] Will dashboard load for authenticated users?
- [ ] Will chat endpoint handle requests without crashing?
- [ ] Will report upload work?

### Configuration Errors
- [ ] Are environment variables used before validation?
- [ ] Does `next.config.ts` have valid syntax?
- [ ] Does `tsconfig.json` have valid paths?
- [ ] Does `postcss.config.mjs` + `tailwind.config.*` exist and match?

---

## PART 3: ARCHITECTURE & DESIGN ISSUES

### Database Design
- [ ] Is schema normalized or over-normalized? (Check: `analytics_snapshots` as JSONB blob)
- [ ] Are foreign keys correctly defined?
- [ ] Are indexes present on frequently-queried columns?
- [ ] Is RLS too permissive or too restrictive?

### API Design
- [ ] Are routes RESTful or mixed?
- [ ] Do status codes follow conventions? (200, 201, 400, 401, 403, 404, 500)
- [ ] Is response shape consistent across endpoints?
- [ ] Are error responses following RFC 7807 (Problem Details)?

### State Management
- [ ] Is React state management excessive or insufficient?
- [ ] Are queries cached or repeatedly fetched?
- [ ] Is Server State management (Next.js Data Cache) used correctly?

### Component Architecture
- [ ] Are components too large (>500 lines)?
- [ ] Is prop drilling excessive?
- [ ] Are context providers properly scoped?

---

## PART 4: SECURITY ASSESSMENT

### Authentication & Authorization
- [ ] Is Clerk integration correct and secure?
- [ ] Are JWTs validated on every API call?
- [ ] Is session timeout configured?
- [ ] Can users access other users' data? (RLS bypass risk)

### Data Protection
- [ ] Is PHI (Protected Health Information) encrypted at rest? (Supabase TDE configured?)
- [ ] Is PHI encrypted in transit? (HTTPS headers set)
- [ ] Check: `next.config.ts` security headers — are they all present?
  - X-Frame-Options: DENY ✓
  - X-Content-Type-Options: nosniff ✓
  - Strict-Transport-Security ✓
  - CSP (Content-Security-Policy) — NOT PRESENT ✗

### Input Validation
- [ ] Are all API inputs validated with Zod?
- [ ] Are file uploads validated (size, MIME type)?
- [ ] Are URLs/links validated before opening?
- [ ] Is SQL injection prevented? (Using Supabase SDK = safe)
- [ ] Is XSS prevented? (Check user content rendering)

### API Security
- [ ] Are rate limits enforced?
- [ ] Is CORS configured (if needed)?
- [ ] Are secrets stored in environment, not code?
- [ ] Are API keys properly rotated?

### Third-Party Risk
- [ ] Are external APIs called over HTTPS?
- [ ] Are API responses validated before use?
- [ ] Is vendor lock-in risk acknowledged? (Supabase, Clerk, Gemini, Razorpay)

### Compliance (HIPAA/Privacy)
- [ ] Is audit logging implemented? (Cannot find `audit_logs` table or function)
- [ ] Are access logs stored with timestamp, user, action?
- [ ] Is data retention policy documented?
- [ ] Is data deletion implemented and tested?
- [ ] Is GDPR right-to-deletion working?

---

## PART 5: PERFORMANCE & SCALABILITY

### Database Queries
- [ ] Are N+1 queries present? (Check API routes for loops with queries inside)
- [ ] Are queries using SELECT * or specific columns?
- [ ] Are indexes on foreign keys and filters?
- [ ] Is pagination implemented for large result sets?

### Caching Strategy
- [ ] Is Next.js Data Cache configured correctly?
- [ ] Are frequently-accessed reads cached?
- [ ] Is cache invalidation working?
- [ ] Should Redis (Vercel KV) be added?

### API Performance
- [ ] Are endpoints returning large payloads?
- [ ] Is streaming used for large data?
- [ ] Are background jobs for long-running tasks?
  - Issue: Report analysis is synchronous — will timeout

### Frontend Performance
- [ ] Are components lazy-loaded?
- [ ] Are images optimized?
- [ ] Is bundle size checked?
- [ ] Are third-party scripts deferred?

### Scalability Issues
- [ ] Will app handle 1,000 concurrent users?
- [ ] Will Vercel serverless handle peak load?
- [ ] Are there rate limits to prevent abuse?
- [ ] Is database connection pooling configured?

---

## PART 6: MISSING PIECES

### Documentation
- [ ] Is there a SETUP.md for developers?
- [ ] Are API endpoints documented?
- [ ] Is database schema documented?
- [ ] Is deployment procedure documented?

### Testing
- [ ] Are there unit tests?
- [ ] Are there integration tests?
- [ ] Are there E2E tests?
- [ ] Is test coverage >80%?

### Monitoring & Observability
- [ ] Is error tracking (Sentry) integrated?
- [ ] Is logging structured and centralized?
- [ ] Is APM (application performance monitoring) integrated?
- [ ] Are alerts configured for critical issues?

### DevOps & CI/CD
- [ ] Is there a GitHub Actions workflow?
- [ ] Are linting and type-checking automated?
- [ ] Is there a staging environment?
- [ ] Is deployment documented?

### Deployment
- [ ] Is Vercel `vercel.json` correct?
- [ ] Are environment variables configured in Vercel?
- [ ] Are secrets secured in Vercel Secret Storage?
- [ ] Is preview deployment working?

---

## PART 7: ISSUE SEVERITY CLASSIFICATION

**For each issue found, classify as:**

- **CRITICAL** — Prevents launch or causes data loss/security breach
- **HIGH** — Major functionality broken or significant performance issue
- **MEDIUM** — Feature partially broken or poor UX
- **LOW** — Code quality or best practice issue

---

## PART 8: DETAILED FINDINGS TEMPLATE

For each issue, provide:

```
## Issue ID: [NUMBER]
**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Title**: [Short title]
**Location**: [File path, line number]
**Description**: [What is wrong and why it matters]
**Impact**: [What breaks as a result]
**Evidence**: [Code snippet or log]
**Recommendation**: [Describe fix approach, but don't write code]
```

---

## PART 9: AUDIT CHECKLIST

Report the following metrics:

- **Total Issues Found**: [N]
- **Critical Issues**: [N]
- **High Issues**: [N]
- **Medium Issues**: [N]
- **Low Issues**: [N]
- **Code Coverage**: [Estimated %]
- **TypeScript Strict Mode**: [YES/NO]
- **Security Headers**: [N/10]
- **API Rate Limiting**: [IMPLEMENTED/MISSING]
- **Error Tracking**: [IMPLEMENTED/MISSING]
- **Database RLS**: [ENABLED/DISABLED]
- **Authentication Flow**: [WORKING/BROKEN]

---

## PART 10: GO/NO-GO DECISION

**Can this app launch to production RIGHT NOW?**

- **YES** — All critical blockers resolved, architecture sound, security adequate
- **NO** — Critical issues present, must fix before launch
  - List the top 5 things that must be fixed first

---

## OUTPUT EXPECTATION

Your audit should:

1. ✅ Be thorough and systematic
2. ✅ Flag all blockers, errors, and risks
3. ✅ Use severity levels (CRITICAL/HIGH/MEDIUM/LOW)
4. ✅ Provide evidence (code location, error message)
5. ✅ Explain business impact
6. ✅ NOT rewrite code (describe fixes at a high level)
7. ✅ Give a clear GO/NO-GO recommendation
8. ✅ Be organized and scannable

---

## ADDITIONAL CONTEXT

**Project goals:**
- Healthcare platform for patients to upload medical reports, chat with AI
- Family sharing of health data
- AI analysis of reports (labs, medications, conditions)
- Payment via Razorpay (subscription model)

**Constraints:**
- HIPAA compliance required (healthcare PHI)
- Serverless deployment (Vercel)
- No local database setup (Supabase managed)
- MVP stage, but must be production-ready

**Known debt (from PROJECT_AUDIT.md):**
- Migrated from TanStack Start to Next.js 15
- Clerk integration added (Supabase Auth removed)
- Razorpay payment system added
- Some legacy code still present

---

## HOW TO USE THIS PROMPT

1. Copy this entire prompt
2. Upload the codebase
3. Run with Claude (or other AI auditor)
4. Audit will take 10-20 minutes
5. Output detailed findings in structured format
6. Use findings to prioritize fixes before launch

---

**End of Audit Prompt**
