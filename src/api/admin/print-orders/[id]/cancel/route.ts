import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const printOrderService = req.scope.resolve("printOrder")

  try {
    await printOrderService.cancel(id)
    const printJob = await printOrderService.retrievePrintJob(id)
    res.json({ print_job: printJob })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes("not found")) {
      res.status(404).json({ message })
      return
    }

    // Invalid status transition (e.g. cancelling shipped/delivered job)
    res.status(400).json({ message })
  }
}
