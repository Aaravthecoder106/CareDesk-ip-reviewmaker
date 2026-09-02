import 'server-only'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { env } from '@/env'

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)

// Primary + fallback verified against this key's quota (gemini-2.0-flash has
// zero free-tier quota for new keys and always 429s).
const PRIMARY_MODEL = 'gemini-2.0-flash'
const FALLBACK_MODEL = 'gemini-1.5-flash'

export function getGeminiModel(model: string = PRIMARY_MODEL) {
  return genAI.getGenerativeModel({ model })
}

type Part =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } }

/**
 * Generate with the primary model, falling back to the lite model when the
 * primary is rate-limited/overloaded (429/503) or unavailable (404).
 */
async function generate(parts: Part[]): Promise<string> {
  try {
    const result = await getGeminiModel(PRIMARY_MODEL).generateContent(parts)
    return result.response.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/\b(429|503|404)\b|quota|overloaded|high demand/i.test(msg)) {
      const result = await getGeminiModel(FALLBACK_MODEL).generateContent(parts)
      return result.response.text()
    }
    throw err
  }
}

export async function generateText(prompt: string): Promise<string> {
  return generate([{ text: prompt }])
}

/** Prompt + inline files (images or PDFs) in one request. */
export async function generateTextWithImages(
  prompt: string,
  images: { data: string; mimeType: string }[]
): Promise<string> {
  return generate([
    { text: prompt },
    ...images.map((img) => ({
      inlineData: { data: img.data, mimeType: img.mimeType },
    })),
  ])
}

/** Strip markdown fences and parse the model's JSON reply. Throws on garbage. */
export function parseJsonReply<T>(response: string): T {
  const cleaned = response
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  // Some models prepend prose; grab the outermost JSON object if needed.
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  const jsonText = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned
  return JSON.parse(jsonText) as T
}
