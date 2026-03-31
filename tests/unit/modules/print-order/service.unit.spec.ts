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

  describe("updateStatus", () => {
    it("updates status and notes correctly", async () => {
      service.retrievePrintJob.mockResolvedValue({
        id: "pj_1",
        status: "pending",
      })

      await service.updateStatus("pj_1", "processing", "Started printing")

      expect(service.updatePrintJobs).toHaveBeenCalledWith({
        selector: { id: "pj_1" },
        data: { status: "processing", notes: "Started printing" },
      })
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
