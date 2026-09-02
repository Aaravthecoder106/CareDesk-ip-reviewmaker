# CareDesk: Initial Audit Findings Summary

**Status**: 🔴 **NOT READY TO LAUNCH** — Multiple Critical Blockers Found

---

## CRITICAL BLOCKERS (Must Fix)

### 1. ⚠️ INVALID AI MODEL NAME
**Severity**: CRITICAL  
**Location**: `src/lib/ai/gemini.ts:9`  
**Issue**:
```typescript
const PRIMARY_MODEL = 'gemini-3-flash-preview'  // ❌ Does not exist!
```
**Impact**: Every AI request will fail with 404 error. Chat, report analysis, all AI features broken.  
**Fix**: Use valid Gemini model:
- `gemini-2.0-flash` (recommended, fastest)
- `gemini-1.5-flash` (good alternative)
- `gemini-1.5-pro` (slower, more accurate)

---

### 2. ⚠️ MISSING `.env` FILE
**Severity**: CRITICAL  
**Location**: Project root  
**Issue**: No `.env.local` or `.env` file present. App will fail to boot.  
**Impact**: Environment validation will fail, secrets missing, Clerk/Supabase cannot authenticate.  
**Fix**: Create `.env.local` with these required vars:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
GEMINI_API_KEY=AIza...
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_MONTHLY_ID=plan_...
RAZORPAY_PLAN_ANNUAL_ID=plan_...
```

---

### 3. ⚠️ PLACEHOLDER ENV DEFAULTS CAUSING ISSUES
**Severity**: HIGH  
**Location**: `src/env.ts:14-19`  
**Issue**:
```typescript
GEMINI_API_KEY: z.string().min(1).default('placeholder'),
RAZORPAY_KEY_ID: z.string().min(1).default('placeholder'),
// ... etc
```
**Impact**: If env var missing, app uses "placeholder" string instead of failing early.  
**Problem**: 
- Gemini calls will fail silently with 401
- Razorpay won't actually create orders
- Hard to debug in production

**Fix**: Remove `.default()` if truly required, or add to `skipValidation` list.

---

### 4. ⚠️ CLERK ↔ SUPABASE INTEGRATION INCOMPLETE
**Severity**: CRITICAL  
**Location**: Database RLS policies, `src/lib/supabase/client.ts`  
**Issue**: 
- Database RLS uses `public.clerk_user_id()` function
- This function extracts user ID from JWT
- **But where is it defined in migrations?**
- Clerk JWT needs to be configured in Supabase dashboard

**Impact**: 
- All authenticated queries will return "permission denied"
- Users can't access their own data
- Dashboard is completely broken

**Fix**: 
1. Go to Supabase dashboard → Settings → Auth → JWT
2. Enable "Custom JWT" for Clerk integration
3. Run migration `0000_initial.sql` which should create `public.clerk_user_id()` function
4. Test that RLS policies are evaluating correctly

---

### 5. ⚠️ DATABASE MIGRATIONS NOT APPLIED
**Severity**: CRITICAL  
**Location**: `supabase/migrations/` directory  
**Issue**: SQL migrations exist but README says must be run manually in Supabase SQL editor  
**Impact**: 
- Tables don't exist
- RLS policies don't exist
- Storage buckets don't exist
- All database queries will fail with "relation does not exist"

**Fix**: 
1. Supabase dashboard → SQL Editor
2. Copy entire contents of `0000_initial.sql` → paste → Run
3. Copy entire contents of `0001_user_provisioning.sql` → paste → Run
4. Copy entire contents of `0002_deletion_tombstone.sql` → paste → Run
5. Verify schema created: `SELECT * FROM information_schema.tables WHERE table_schema='public' LIMIT 10`

---

### 6. ⚠️ NO `.env` EXAMPLE/TEMPLATE
**Severity**: HIGH  
**Location**: Project root  
**Issue**: No `.env.example` file for developers to copy  
**Impact**: Developers don't know which vars are required  
**Fix**: Create `.env.example`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Google Gemini AI
GEMINI_API_KEY=AIza...

# Razorpay Payments
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_MONTHLY_ID=plan_...
RAZORPAY_PLAN_ANNUAL_ID=plan_...
```

---

## HIGH SEVERITY ISSUES

### 7. ⚠️ MIDDLEWARE LAZY-LOADS CLERK WITH `require()`
**Severity**: HIGH  
**Location**: `src/middleware.ts:10-11`  
**Issue**:
```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { clerkMiddleware, createRouteMatcher } = require("@clerk/nextjs/server");
```
**Impact**: 
- Disables ESLint to use CommonJS require in ES module
- Could cause issues in Edge Runtime (middleware runs on edge)
- Not as bad as it seems, but unusual pattern

**Recommendation**: Use ES import if possible, or document why require is needed.

---

### 8. ⚠️ MISSING PAYMENT WEBHOOK SIGNATURE VALIDATION
**Severity**: HIGH  
**Location**: `src/app/api/razorpay/webhook/route.ts`  
**Issue**: Need to check if webhook signature is validated  
**Impact**: Attacker could send fake payment confirmations, bypass payment  
**Fix**: Validate webhook signature using RAZORPAY_WEBHOOK_SECRET

---

### 9. ⚠️ MISSING CLERK WEBHOOK SIGNATURE VALIDATION  
**Severity**: HIGH  
**Location**: `src/app/api/webhooks/clerk/route.ts`  
**Issue**: Same as above — signature must be validated  
**Impact**: Attacker could send fake user creation events  
**Fix**: Validate signature using `svix` library (Clerk's webhook provider)

---

### 10. ⚠️ REPORT ANALYSIS IS SYNCHRONOUS
**Severity**: HIGH  
**Location**: Report upload flow  
**Issue**: Analyzing PDFs with Gemini vision is done in request handler  
**Impact**: 
- Large PDFs will timeout (Vercel serverless max 60s)
- Users wait for AI analysis (poor UX)
- Blocked upload handler can't handle multiple requests

**Recommendation**: Move to async job queue:
- Use Vercel Background Functions OR
- Use Supabase Edge Functions OR
- Add Inngest/Bull queue

---

### 11. ⚠️ NO RATE LIMITING ON AI ENDPOINTS
**Severity**: HIGH  
**Location**: `src/lib/rate-limit.ts`  
**Issue**: Need to verify rate limiting is actually working  
**Impact**: Attacker could spam Gemini requests and incur huge costs  
**Fix**: Ensure rate limiting is strict (e.g., 5 reports/hour, 20 chats/hour)

---

### 12. ⚠️ MISSING AUDIT LOGGING (HIPAA VIOLATION)
**Severity**: CRITICAL for HIPAA  
**Location**: Entire application  
**Issue**: No audit trail of who accessed/modified PHI  
**Impact**: 
- HIPAA non-compliance
- Cannot detect unauthorized access
- Regulatory fines

**Fix**: Implement audit logging:
- Log every SELECT, INSERT, UPDATE, DELETE on health data
- Include: user, action, timestamp, IP address
- Store in `audit_logs` table with Supabase RLS (service-role only access)

---

### 13. ⚠️ NO CONTENT SECURITY POLICY HEADER
**Severity**: MEDIUM  
**Location**: `next.config.ts`  
**Issue**: CSP not configured  
**Impact**: XSS attacks possible  
**Fix**: Add CSP header to `next.config.ts`:
```javascript
{
  key: "Content-Security-Policy",
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.clerk.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:"
}
```

---

### 14. ⚠️ RESEND EMAIL SERVICE NOT CONFIGURED
**Severity**: MEDIUM  
**Location**: `src/lib/email/family-invite.ts`  
**Issue**: Uses `resend` library but no `RESEND_API_KEY` in env  
**Impact**: Invitations might fail silently  
**Fix**: Either add RESEND_API_KEY to env, or remove Resend and use Supabase email

---

### 15. ⚠️ FILE SIZE VALIDATION MISSING
**Severity**: HIGH  
**Location**: `src/app/api/reports/upload/route.ts`  
**Issue**: Need to verify file size is limited  
**Impact**: 
- Large PDFs crash serverless function
- Memory exhaustion
- DoS vector

**Fix**: Enforce max file size (e.g., 50MB) and validate MIME type

---

## MEDIUM SEVERITY ISSUES

### 16. No E2E Tests
**Location**: `tests/` folder  
**Issue**: Only unit test for provisioning, no E2E tests  
**Impact**: Cannot verify auth flow, report upload, chat work end-to-end

---

### 17. No Error Tracking (Sentry)
**Location**: Entire app  
**Issue**: No Sentry integration  
**Impact**: Production errors go unnoticed

---

### 18. No Structured Logging
**Location**: `src/lib/logger.ts`  
**Issue**: Logging exists but not centralized  
**Impact**: Hard to debug issues in production

---

### 19. TypeScript not strictly checking
**Location**: `tsconfig.json`  
**Issue**: `strict: true` but many `eslint-disable` comments  
**Impact**: Type safety compromised

---

## LOW SEVERITY ISSUES

### 20. Comments reference old architecture  
**Location**: Throughout codebase  
**Issue**: References to "TanStack Start", "Lovable" still in comments  
**Impact**: Confusing for new developers

---

---

## QUICK AUDIT SCORECARD

| Category | Status | Grade |
|----------|--------|-------|
| **Environment Setup** | ❌ Missing .env | F |
| **AI Model Configuration** | ❌ Invalid model name | F |
| **Database Setup** | ❌ Migrations not applied | F |
| **Authentication** | ⚠️ Clerk integration unclear | D |
| **API Security** | ⚠️ Signature validation TBD | D |
| **Rate Limiting** | ? | ? |
| **HIPAA Compliance** | ❌ No audit logging | F |
| **Error Handling** | ✅ Basic structure present | C |
| **Performance** | ⚠️ Sync AI processing | D |
| **Testing** | ❌ Missing E2E tests | F |
| **Documentation** | ⚠️ Minimal | D |
| **DevOps** | ❌ No CI/CD documented | F |

---

## GO/NO-GO DECISION

### 🔴 **NO GO FOR PRODUCTION**

**Reasons:**
1. Invalid Gemini model will crash all AI features
2. Missing `.env` prevents app from booting
3. Database migrations not applied
4. Clerk-Supabase integration incomplete
5. HIPAA audit logging missing
6. Webhook signature validation unclear

**Top 5 Fixes (in priority order):**
1. Create `.env.local` with all required secrets
2. Fix Gemini model name to valid value
3. Run all 3 database migrations in Supabase
4. Configure Clerk JWT integration in Supabase
5. Verify webhook signature validation is implemented

**Estimated time to fix**: 2-4 hours  
**Risk level**: HIGH (healthcare app, compliance issues)

---

## FILES TO REVIEW MANUALLY

1. ✅ `src/lib/ai/gemini.ts` — Model name issue found
2. ⚠️ `src/app/api/webhooks/clerk/route.ts` — Signature validation?
3. ⚠️ `src/app/api/razorpay/webhook/route.ts` — Signature validation?
4. ⚠️ `src/app/api/reports/upload/route.ts` — File size limits?
5. ⚠️ `src/lib/rate-limit.ts` — Is it actually enforced?
6. ⚠️ `supabase/migrations/0000_initial.sql` — Clerk function defined?

---

**Audit Date**: September 2, 2026  
**Auditor**: AI Code Review System  
**Recommendation**: Run comprehensive audit using attached prompt before any launch attempt
