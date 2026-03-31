import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updatePrintJobSchema } from "../validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const printOrderService = req.scope.resolve("printOrder")

  try {
    const printJob = await printOrderService.retrievePrintJob(id)
    res.json({ print_job: printJob })
  } catch {
    res.status(404).json({ message: `Print job ${id} not found` })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  const printOrderService = req.scope.resolve("printOrder")

  const parsed = updatePrintJobSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const { status, tracking_number, notes } = parsed.data

  try {
    await printOrderService.updateStatus(id, status, notes)

    if (tracking_number !== undefined) {
      await printOrderService.updatePrintJobs({
        selector: { id },
        data: { tracking_number },
      })
    }

    const printJob = await printOrderService.retrievePrintJob(id)
    res.json({ print_job: printJob })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes("not found")) {
      res.status(404).json({ message })
      return
    }

    // Invalid status transition
    res.status(400).json({ message })
  }
}
