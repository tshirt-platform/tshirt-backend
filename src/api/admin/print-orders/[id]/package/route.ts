import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DisallowedFileUrlError, fetchDesignFile } from "../../../../../modules/print-order/file-fetch"
import { buildPrintPackage } from "../../../../../modules/print-order/print-package"
import { itemNumber } from "../../../../../modules/print-order/print-spec"

async function resolveOrderNo(req: MedusaRequest, orderId: string): Promise<string> {
  try {
    const query = req.scope.resolve("query")
    const { data } = await query.graph({
      entity: "order",
      fields: ["display_id"],
      filters: { id: orderId },
    })
    const displayId = data?.[0]?.display_id
    return displayId != null ? String(displayId) : orderId
  } catch {
    return orderId
  }
}

// Download everything a print shop needs for one printed side as a single zip
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const printOrderService = req.scope.resolve("printOrder")

  let job
  try {
    job = await printOrderService.retrievePrintJob(id)
  } catch {
    res.status(404).json({ message: `Print job ${id} not found` })
    return
  }

  try {
    const siblings = await printOrderService.getByOrderId(job.order_id)
    const pkg = await buildPrintPackage({
      orderNo: await resolveOrderNo(req, job.order_id),
      itemNo: itemNumber(siblings, job),
      job,
      fetchFile: (url) => fetchDesignFile(url),
    })

    res.setHeader("Content-Type", "application/zip")
    res.setHeader("Content-Disposition", `attachment; filename="${pkg.fileName}"`)
    res.setHeader("X-Package-Warnings", String(pkg.warnings.length))
    res.status(200).send(Buffer.from(pkg.bytes))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(error instanceof DisallowedFileUrlError ? 422 : 502).json({ message })
  }
}
