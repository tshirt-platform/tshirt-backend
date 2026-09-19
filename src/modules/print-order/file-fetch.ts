const MAX_BYTES = 80 * 1024 * 1024
const TIMEOUT_MS = 30_000

export class DisallowedFileUrlError extends Error {}

/** Origins design files may be downloaded from; set DESIGN_FILE_ORIGINS in production */
export function allowedFileOrigins(
  raw: string | undefined = process.env.DESIGN_FILE_ORIGINS
): string[] {
  const configured = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (configured.length > 0) return configured.map((o) => new URL(o).origin)
  return process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"]
}

/**
 * Design URLs come from cart metadata a customer can edit, so the server only
 * fetches from known origins; anything else would let an order probe internal hosts.
 */
export function isAllowedFileUrl(url: string, origins: string[]): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false
  if (parsed.username || parsed.password) return false
  return origins.includes(parsed.origin)
}

export async function fetchDesignFile(
  url: string,
  origins: string[] = allowedFileOrigins()
): Promise<Uint8Array> {
  if (!isAllowedFileUrl(url, origins)) {
    throw new DisallowedFileUrlError(`File URL is not on an allowed origin: ${url}`)
  }

  // A redirect could leave the allowed origin, so it counts as a failure
  const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`)

  const declared = Number(res.headers.get("content-length") ?? 0)
  if (declared > MAX_BYTES) throw new Error(`File is too large: ${url}`)

  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > MAX_BYTES) throw new Error(`File is too large: ${url}`)
  return bytes
}
