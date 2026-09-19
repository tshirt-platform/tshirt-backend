import { MedusaService } from "@medusajs/framework/utils"
import type {
  DesignSide,
  PrintJobStatus,
  PrintPlacement,
} from "@tshirt-platform/shared"
import PrintJob from "./models/print-job"

// A job cannot enter production before the customer's proof is approved
export const VALID_TRANSITIONS: Record<PrintJobStatus, PrintJobStatus[]> = {
  pending: ["proof_approved", "cancelled"],
  proof_approved: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
}

export type CreatePrintJobData = {
  order_id: string
  design_png_url: string
  design_json_url: string
  order_item_id?: string
  side?: DesignSide
  quantity?: number
  garment_size?: string
  color_name?: string
  color_hex?: string
  supplier_color_code?: string | null
  needs_underbase?: boolean
  placement?: PrintPlacement
  preview_url?: string
}

class PrintOrderService extends MedusaService({ PrintJob }) {
  async createForOrder(data: CreatePrintJobData) {
    return this.createPrintJobs({ ...data, status: "pending" })
  }

  async updateStatus(
    printJobId: string,
    status: PrintJobStatus,
    notes?: string
  ): Promise<void> {
    const job = await this.retrievePrintJob(printJobId)
    const currentStatus = job.status as PrintJobStatus
    const allowed = VALID_TRANSITIONS[currentStatus]
    if (!allowed.includes(status)) {
      throw new Error(
        `Cannot transition from "${currentStatus}" to "${status}"`
      )
    }
    await this.updatePrintJobs({
      selector: { id: printJobId },
      data: {
        status,
        ...(notes !== undefined ? { notes } : {}),
      },
    })
  }

  async getByOrderId(orderId: string) {
    return this.listPrintJobs({ order_id: orderId })
  }

  async cancel(printJobId: string): Promise<void> {
    await this.updateStatus(printJobId, "cancelled")
  }
}

export default PrintOrderService
