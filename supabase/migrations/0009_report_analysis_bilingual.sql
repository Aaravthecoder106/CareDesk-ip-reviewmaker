-- 0009 — bilingual report analysis and traceable elderly-vital extraction.
-- Additive only: preserve the existing ai_summary/summary and labResults fields.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS ai_summary_english text,
  ADD COLUMN IF NOT EXISTS ai_summary_hinglish text,
  ADD COLUMN IF NOT EXISTS extracted_vitals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS questions_for_doctor jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS medical_disclaimer text NOT NULL DEFAULT 'Medical disclaimer: This is an informational summary of the uploaded medical report, not a clinical diagnosis or treatment recommendation. AI extraction can be incomplete or incorrect and does not replace review by a qualified healthcare professional. Do not start, stop, or change medicines or treatment based on this summary. For urgent symptoms, seek emergency medical care.';

UPDATE public.reports
SET ai_summary_english = COALESCE(ai_summary_english, ai_summary)
WHERE ai_summary_english IS NULL;

ALTER TABLE public.preview_tokens
  ADD COLUMN IF NOT EXISTS summary_english text,
  ADD COLUMN IF NOT EXISTS summary_hinglish text,
  ADD COLUMN IF NOT EXISTS extracted_vitals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS questions_for_doctor jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS medical_disclaimer text NOT NULL DEFAULT 'Medical disclaimer: This is an informational summary of the uploaded medical report, not a clinical diagnosis or treatment recommendation. AI extraction can be incomplete or incorrect and does not replace review by a qualified healthcare professional. Do not start, stop, or change medicines or treatment based on this summary. For urgent symptoms, seek emergency medical care.';

UPDATE public.preview_tokens
SET summary_english = COALESCE(summary_english, summary)
WHERE summary_english IS NULL;
