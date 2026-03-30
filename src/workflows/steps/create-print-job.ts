import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

type DesignItem = {
  design_png_url: string
  design_json_url: string
}

type CreatePrintJobInput = {
  order_id: string
  items: DesignItem[]
}

type CreatePrintJobOutput = {
  print_job_ids: string[]
}

type CompensationData = {
  print_job_ids: string[]
}

export const createPrintJobStep = createStep(
  "create-print-job",
  async (
    { order_id, items }: CreatePrintJobInput,
    { container }
  ): Promise<StepResponse<CreatePrintJobOutput, CompensationData>> => {
    const printOrderService = container.resolve("printOrder")
    const printJobIds: string[] = []

    for (const item of items) {
      const job = await printOrderService.createForOrder({
        order_id,
        design_png_url: item.design_png_url,
        design_json_url: item.design_json_url,
      })
      printJobIds.push(job.id)
    }

    return new StepResponse(
      { print_job_ids: printJobIds },
      { print_job_ids: printJobIds }
    )
  },
  // Compensation: cancel all created print jobs on workflow failure
  async (compensationData: CompensationData, { container }) => {
    const printOrderService = container.resolve("printOrder")

    for (const id of compensationData.print_job_ids) {
      await printOrderService.cancel(id)
    }
  }
)
