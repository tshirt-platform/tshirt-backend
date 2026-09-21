import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { forward, isValidTemplateId } from "../../../proxy"

const LAYER_NAME = /^[a-z][a-z0-9-]{0,19}$/

/** One layer of a photo: GET draws it on its own, PUT switches an occluding part on or off */
function layerRoute(method: "GET" | "PUT", body: "none" | "json") {
  return async (req: MedusaRequest, res: MedusaResponse) => {
    const { id, name } = req.params
    if (!isValidTemplateId(id) || !LAYER_NAME.test(name ?? "")) {
      res.status(404).json({ message: "Layer not found" })
      return
    }
    await forward(req, res, `/templates/${id}/layers/${name}`, method, body)
  }
}

export const GET = layerRoute("GET", "none")
export const PUT = layerRoute("PUT", "json")
