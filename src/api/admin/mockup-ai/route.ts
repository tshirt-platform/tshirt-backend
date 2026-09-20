import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { forward } from "../mockups/proxy"

// Whether the render service has AI analysis switched on (and which model), for the admin
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  await forward(req, res, "/vision/status", "GET")
}
