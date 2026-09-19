import { Readable } from "node:stream"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

const TEMPLATE_ID = /^[a-f0-9]{12}$/
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024
const TIMEOUT_MS = 120_000

export function isValidTemplateId(id: unknown): id is string {
  return typeof id === "string" && TEMPLATE_ID.test(id)
}

function renderBaseUrl(): string {
  return (process.env.RENDER_SERVICE_URL || "http://localhost:8001").replace(/\/+$/, "")
}

type Body = "none" | "json" | "raw"

/**
 * Passes an admin request on to the render service, which is internal and has no user
 * accounts of its own. Uploads stream straight through instead of being buffered here.
 */
export async function forward(
  req: MedusaRequest,
  res: MedusaResponse,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body: Body = "none"
): Promise<void> {
  const headers: Record<string, string> = {}
  if (process.env.RENDER_API_KEY) headers["X-Api-Key"] = process.env.RENDER_API_KEY

  const init: RequestInit & { duplex?: "half" } = { method, headers, signal: AbortSignal.timeout(TIMEOUT_MS) }

  if (body === "raw") {
    const length = Number(req.headers["content-length"] ?? 0)
    if (length > MAX_UPLOAD_BYTES) {
      res.status(413).json({ message: "File too large" })
      return
    }
    const type = req.headers["content-type"]
    if (typeof type !== "string" || !type.startsWith("multipart/form-data")) {
      res.status(400).json({ message: "Expected a multipart/form-data upload" })
      return
    }
    headers["Content-Type"] = type
    if (length) headers["Content-Length"] = String(length)
    init.body = Readable.toWeb(req as unknown as Readable) as unknown as BodyInit
    init.duplex = "half"
  } else if (body === "json") {
    headers["Content-Type"] = "application/json"
    init.body = JSON.stringify(req.body ?? {})
  }

  try {
    const upstream = await fetch(`${renderBaseUrl()}${path}`, init)
    const type = upstream.headers.get("content-type")
    if (type) res.setHeader("Content-Type", type)
    res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    res.status(502).json({ message: "Preview service unreachable" })
  }
}

/** Runs the forward for a route with a template id in the path */
export function templateRoute(
  suffix: string,
  method: "GET" | "PUT" | "DELETE",
  body: Body = "none"
) {
  return async (req: MedusaRequest, res: MedusaResponse) => {
    const { id } = req.params
    if (!isValidTemplateId(id)) {
      res.status(404).json({ message: "Template not found" })
      return
    }
    await forward(req, res, `/templates/${id}${suffix}`, method, body)
  }
}
