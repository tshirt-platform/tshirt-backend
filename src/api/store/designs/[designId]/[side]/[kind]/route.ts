import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  KINDS,
  checkDesignFile,
  designKey,
  getDesignStorage,
  parseDesignFileRef,
} from "../../../../../../lib/design-storage"

/** Collects the request body, giving up as soon as it passes the limit instead of buffering it all */
async function readBody(req: MedusaRequest, maxBytes: number): Promise<Buffer | null> {
  const declared = Number(req.headers["content-length"] ?? 0)
  if (declared > maxBytes) return null

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > maxBytes) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * The storefront saves a design here; this service is the only thing that holds
 * bucket credentials. Files are named by the server from validated parts.
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const ref = parseDesignFileRef(req.params)
  if (!ref) {
    res.status(400).json({ message: "Invalid design file" })
    return
  }

  const { contentType, maxBytes } = KINDS[ref.kind]
  const body = await readBody(req, maxBytes)
  if (!body) {
    res.status(413).json({ message: "File too large" })
    return
  }

  const problem = checkDesignFile(ref.kind, body)
  if (problem) {
    res.status(400).json({ message: problem })
    return
  }

  try {
    const url = await getDesignStorage().put(designKey(ref), body, contentType)
    res.status(201).json({ url })
  } catch (e) {
    console.error("[design-storage] upload failed:", e)
    res.status(502).json({ message: "Could not store the file" })
  }
}

/**
 * The editor scene comes back through here rather than from the bucket, so the
 * bucket needs no CORS rules. Only scenes are readable this way.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const ref = parseDesignFileRef(req.params)
  if (!ref || ref.kind !== "json") {
    res.status(404).json({ message: "Not found" })
    return
  }

  try {
    const bytes = await getDesignStorage().get(designKey(ref))
    if (!bytes) {
      res.status(404).json({ message: "Not found" })
      return
    }
    res.setHeader("Content-Type", KINDS.json.contentType)
    res.status(200).send(bytes)
  } catch (e) {
    console.error("[design-storage] read failed:", e)
    res.status(502).json({ message: "Could not read the file" })
  }
}
