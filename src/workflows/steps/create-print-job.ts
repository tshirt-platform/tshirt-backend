import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import type { DesignItem } from "./extract-design-data"

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

// Flattens a design item (with its garment snapshot) into the columns of a print job
export function toPrintJobData(orderId: string, item: DesignItem) {
  return {
    order_id: orderId,
    order_item_id: item.order_item_id,
    side: item.side,
    quantity: item.quantity,
    design_png_url: item.design_png_url,
    design_json_url: item.design_json_url,
    ...(item.preview_url ? { preview_url: item.preview_url } : {}),
    ...(item.placement ? { placement: item.placement } : {}),
    ...(item.garment
      ? {
          garment_size: item.garment.size,
          color_name: item.garment.color_name,
          color_hex: item.garment.color_hex,
          supplier_color_code: item.garment.supplier_color_code,
          needs_underbase: item.garment.needs_underbase,
        }
      : {}),
  }
}

type PrintOrderApi = {
  createForOrder: (data: ReturnType<typeof toPrintJobData>) => Promise<{ id: string }>
  cancel: (id: string) => Promise<void>
}

export async function createPrintJobs(
  service: PrintOrderApi,
  { order_id, items }: CreatePrintJobInput
): Promise<CreatePrintJobOutput> {
  const printJobIds: string[] = []
  for (const item of items) {
    const job = await service.createForOrder(toPrintJobData(order_id, item))
    printJobIds.push(job.id)
  }
  return { print_job_ids: printJobIds }
}

export async function cancelPrintJobs(
  service: PrintOrderApi,
  data: CompensationData
): Promise<void> {
  for (const id of data.print_job_ids) {
    await service.cancel(id)
  }
}

export const createPrintJobStep = createStep(
  "create-print-job",
  async (
    input: CreatePrintJobInput,
    { container }
  ): Promise<StepResponse<CreatePrintJobOutput, CompensationData>> => {
    const result = await createPrintJobs(container.resolve("printOrder"), input)
    return new StepResponse(result, { print_job_ids: result.print_job_ids })
  },
  // Compensation: cancel all created print jobs on workflow failure
  async (compensationData: CompensationData, { container }) => {
    await cancelPrintJobs(container.resolve("printOrder"), compensationData)
  }
)
