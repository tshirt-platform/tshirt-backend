import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { forward } from "./proxy"

export const GET = (req: MedusaRequest, res: MedusaResponse) =>
  forward(req, res, "/templates", "GET")

// Multipart upload: image + name, streamed to the render service
export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  forward(req, res, "/templates", "POST", "raw")
