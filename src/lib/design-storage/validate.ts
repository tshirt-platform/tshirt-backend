import type { Kind } from "./keys"

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])

/**
 * The route names the file type, so the bytes are checked against it: this endpoint
 * is open to visitors and must not become a place to park arbitrary files.
 * Returns a reason, or null when the file is acceptable.
 */
export function checkDesignFile(kind: Kind, bytes: Buffer): string | null {
  if (bytes.length === 0) return "Empty file"

  switch (kind) {
    case "png":
      return bytes.subarray(0, 8).equals(PNG_SIGNATURE) ? null : "Not a PNG image"
    case "jpg":
      return bytes.subarray(0, 3).equals(JPEG_SIGNATURE) ? null : "Not a JPEG image"
    case "json": {
      try {
        const scene = JSON.parse(bytes.toString("utf8")) as unknown
        const ok = typeof scene === "object" && scene !== null && !Array.isArray(scene)
        return ok ? null : "Design scene must be a JSON object"
      } catch {
        return "Design scene is not valid JSON"
      }
    }
  }
}
