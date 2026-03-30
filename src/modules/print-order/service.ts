import { MedusaService } from "@medusajs/framework/utils"
import PrintJob from "./models/print-job"

type PrintJobStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"

const VALID_TRANSITIONS: Record<PrintJobStatus, PrintJobStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
}

class PrintOrderService extends MedusaService({ PrintJob }) {
  async createForOrder(data: {
    order_id: string
    design_png_url: string
    design_json_url: string
  }) {
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
