/**
 * Zod schemas for API request validation.
 *
 * Every route handler should parse its input through the matching schema
 * before trusting any field.  This catches malformed / malicious payloads
 * early and gives the caller a clear 400 response.
 */
import { z } from 'zod'

// ── Chat ─────────────────────────────────────────────────────────────────
export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(4000, 'Message too long'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
  image: z
    .object({
      data: z.string().min(1),
      mimeType: z.string().min(1),
    })
    .optional(),
})

export type ChatMessageInput = z.infer<typeof chatMessageSchema>

// ── Reports ──────────────────────────────────────────────────────────────
export const reportIdSchema = z.object({
  reportId: z.string().min(1, 'reportId is required'),
})

export const reportDeleteSchema = z.object({
  id: z.string().min(1, 'id is required'),
})

export const reportPreviewSchema = z.object({
  id: z.string().min(1, 'id is required'),
})

// ── Family ───────────────────────────────────────────────────────────────
export const familyInviteSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  relation: z.string().max(100).optional(),
})

export const familyAcceptSchema = z.object({
  token: z.string().min(1, 'Token is required').max(512),
})

export const familyConfirmSchema = z.object({
  memberId: z.string().min(1, 'memberId is required'),
})

export const familyRemoveSchema = z.object({
  memberId: z.string().min(1, 'memberId is required'),
})

// ── Library Password ─────────────────────────────────────────────────────
export const libraryPasswordSchema = z.object({
  action: z.enum(['status', 'set', 'verify', 'remove']),
  password: z.string().max(256).optional(),
})

// ── Feedback ─────────────────────────────────────────────────────────────
export const feedbackSchema = z.object({
  wouldUse: z.enum(['Yes', 'No', 'Maybe'], {
    message: 'Please answer the first question',
  }),
  liked: z.string().max(2000).optional().default(''),
  missing: z.string().max(2000).optional().default(''),
})

// ── Notification ─────────────────────────────────────────────────────────
export const notificationReadSchema = z.object({
  id: z.string().min(1, 'id is required'),
})
