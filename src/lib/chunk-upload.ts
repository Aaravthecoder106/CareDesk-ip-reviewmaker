export function reassembleChunkedUpload(parts: Array<Buffer | undefined>, expectedTotal: number): Buffer | null {
  if (!Array.isArray(parts) || parts.length !== expectedTotal) return null

  const normalized: Array<Buffer | null> = []
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]
    normalized.push(Buffer.isBuffer(part) ? part : null)
  }

  if (normalized.some((part) => part === null)) return null

  return Buffer.concat(normalized as Buffer[])
}
