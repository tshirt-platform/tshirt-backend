import PrintOrderService from "../../../../src/modules/print-order/service"

// Instantiate service and mock inherited MedusaService methods
function createMockService() {
  const service = Object.create(PrintOrderService.prototype)
  service.createPrintJobs = jest.fn()
  service.listPrintJobs = jest.fn()
  service.retrievePrintJob = jest.fn()
  service.updatePrintJobs = jest.fn()
  return service as InstanceType<typeof PrintOrderService> & {
    createPrintJobs: jest.Mock
    listPrintJobs: jest.Mock
    retrievePrintJob: jest.Mock
    updatePrintJobs: jest.Mock
  }
}

describe("PrintOrderService", () => {
  let service: ReturnType<typeof createMockService>

  beforeEach(() => {
    service = createMockService()
  })

  describe("createForOrder", () => {
    it("creates record with status pending", async () => {
      const input = {
        order_id: "order_123",
        design_png_url: "https://s3.example.com/front.png",
        design_json_url: "https://s3.example.com/front.json",
      }
      const expected = { id: "pj_1", ...input, status: "pending" }
      service.createPrintJobs.mockResolvedValue(expected)

      const result = await service.createForOrder(input)

      expect(service.createPrintJobs).toHaveBeenCalledWith({
        ...input,
        status: "pending",
      })
      expect(result).toEqual(expected)
    })
  })

  describe("createForOrder with garment and placement", () => {
    it("passes the extra columns through and starts pending", async () => {
      service.createPrintJobs.mockResolvedValue({ id: "pj_1" })
      const input = {
        order_id: "order_1",
        design_png_url: "https://s3/a.png",
        design_json_url: "https://s3/a.json",
        side: "back" as const,
        quantity: 3,
        garment_size: "M",
        color_name: "Đen",
        needs_underbase: true,
      }

      await service.createForOrder(input)

      expect(service.createPrintJobs).toHaveBeenCalledWith({ ...input, status: "pending" })
    })
  })

  describe("updateStatus", () => {
    it("updates status and notes correctly", async () => {
      service.retrievePrintJob.mockResolvedValue({
        id: "pj_1",
        status: "proof_approved",
      })

      await service.updateStatus("pj_1", "processing", "Started printing")

      expect(service.updatePrintJobs).toHaveBeenCalledWith({
        selector: { id: "pj_1" },
        data: { status: "processing", notes: "Started printing" },
      })
    })

    it("walks the full production flow", async () => {
      const steps: Array<[string, string]> = [
        ["pending", "proof_approved"],
        ["proof_approved", "processing"],
        ["processing", "shipped"],
        ["shipped", "delivered"],
      ]
      for (const [from, to] of steps) {
        service.retrievePrintJob.mockResolvedValue({ id: "pj_1", status: from })
        await expect(service.updateStatus("pj_1", to as never)).resolves.toBeUndefined()
      }
      expect(service.updatePrintJobs).toHaveBeenCalledTimes(4)
    })

    it("does not let a job skip the proof approval", async () => {
      service.retrievePrintJob.mockResolvedValue({ id: "pj_1", status: "pending" })

      await expect(service.updateStatus("pj_1", "processing")).rejects.toThrow(
        'Cannot transition from "pending" to "processing"'
      )
      expect(service.updatePrintJobs).not.toHaveBeenCalled()
    })

    it("allows cancelling before shipping, but not after", async () => {
      for (const from of ["pending", "proof_approved", "processing"]) {
        service.retrievePrintJob.mockResolvedValue({ id: "pj_1", status: from })
        await expect(service.updateStatus("pj_1", "cancelled")).resolves.toBeUndefined()
      }
      for (const from of ["shipped", "delivered", "cancelled"]) {
        service.retrievePrintJob.mockResolvedValue({ id: "pj_1", status: from })
        await expect(service.updateStatus("pj_1", "cancelled")).rejects.toThrow("Cannot transition")
      }
    })

    it("rejects invalid status transitions", async () => {
      service.retrievePrintJob.mockResolvedValue({
        id: "pj_1",
        status: "delivered",
      })

      await expect(
        service.updateStatus("pj_1", "pending")
      ).rejects.toThrow('Cannot transition from "delivered" to "pending"')

      expect(service.updatePrintJobs).not.toHaveBeenCalled()
    })
  })

  describe("getByOrderId", () => {
    it("returns jobs for order", async () => {
      const jobs = [
        { id: "pj_1", order_id: "order_123", status: "pending" },
      ]
      service.listPrintJobs.mockResolvedValue(jobs)

      const result = await service.getByOrderId("order_123")

      expect(service.listPrintJobs).toHaveBeenCalledWith({
        order_id: "order_123",
      })
      expect(result).toEqual(jobs)
    })
  })

  describe("cancel", () => {
    it("sets status to cancelled for pending job", async () => {
      service.retrievePrintJob.mockResolvedValue({
        id: "pj_1",
        status: "pending",
      })

      await service.cancel("pj_1")

      expect(service.updatePrintJobs).toHaveBeenCalledWith({
        selector: { id: "pj_1" },
        data: { status: "cancelled" },
      })
    })

    it("rejects non-cancellable jobs", async () => {
      service.retrievePrintJob.mockResolvedValue({
        id: "pj_1",
        status: "shipped",
      })

      await expect(service.cancel("pj_1")).rejects.toThrow(
        'Cannot transition from "shipped" to "cancelled"'
      )

      expect(service.updatePrintJobs).not.toHaveBeenCalled()
    })
  })
})
