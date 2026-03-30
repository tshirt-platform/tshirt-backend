describe("Admin Print Orders Routes", () => {
  const mockListAndCountPrintJobs = jest.fn()
  const mockRetrievePrintJob = jest.fn()
  const mockUpdateStatus = jest.fn()
  const mockUpdatePrintJobs = jest.fn()
  const mockCancel = jest.fn()

  function createMockService() {
    return {
      listAndCountPrintJobs: mockListAndCountPrintJobs,
      retrievePrintJob: mockRetrievePrintJob,
      updateStatus: mockUpdateStatus,
      updatePrintJobs: mockUpdatePrintJobs,
      cancel: mockCancel,
    }
  }

  function createMockReq(overrides: Record<string, unknown> = {}) {
    return {
      query: {},
      params: {},
      body: {},
      scope: {
        resolve: jest.fn().mockReturnValue(createMockService()),
      },
      ...overrides,
    }
  }

  function createMockRes() {
    const res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    }
    return res
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("GET /admin/print-orders", () => {
    it("returns paginated list of print jobs", async () => {
      const jobs = [
        { id: "pj_1", order_id: "order_1", status: "pending" },
        { id: "pj_2", order_id: "order_2", status: "processing" },
      ]
      mockListAndCountPrintJobs.mockResolvedValue([jobs, 2])

      const req = createMockReq({ query: {} })
      const res = createMockRes()

      // Simulate route handler logic
      const printOrderService = req.scope.resolve("printOrder")
      const [printJobs, count] =
        await printOrderService.listAndCountPrintJobs(
          {},
          { skip: 0, take: 20, order: { created_at: "DESC" } }
        )
      res.json({ print_jobs: printJobs, count, offset: 0, limit: 20 })

      expect(res.json).toHaveBeenCalledWith({
        print_jobs: jobs,
        count: 2,
        offset: 0,
        limit: 20,
      })
    })
  })

  describe("GET /admin/print-orders/:id", () => {
    it("returns print job detail", async () => {
      const job = {
        id: "pj_1",
        order_id: "order_1",
        status: "pending",
        design_png_url: "https://s3.example.com/front.png",
        design_json_url: "https://s3.example.com/front.json",
      }
      mockRetrievePrintJob.mockResolvedValue(job)

      const req = createMockReq({ params: { id: "pj_1" } })
      const res = createMockRes()

      const printOrderService = req.scope.resolve("printOrder")
      const printJob = await printOrderService.retrievePrintJob("pj_1")
      res.json({ print_job: printJob })

      expect(res.json).toHaveBeenCalledWith({ print_job: job })
    })
  })

  describe("POST /admin/print-orders/:id (update status)", () => {
    it("updates print job status", async () => {
      const updatedJob = { id: "pj_1", status: "processing" }
      mockUpdateStatus.mockResolvedValue(undefined)
      mockRetrievePrintJob.mockResolvedValue(updatedJob)

      const req = createMockReq({
        params: { id: "pj_1" },
        body: { status: "processing", notes: "Started" },
      })
      const res = createMockRes()

      const printOrderService = req.scope.resolve("printOrder")
      await printOrderService.updateStatus("pj_1", "processing", "Started")
      const printJob = await printOrderService.retrievePrintJob("pj_1")
      res.json({ print_job: printJob })

      expect(mockUpdateStatus).toHaveBeenCalledWith(
        "pj_1",
        "processing",
        "Started"
      )
      expect(res.json).toHaveBeenCalledWith({ print_job: updatedJob })
    })
  })

  describe("POST /admin/print-orders/:id/cancel", () => {
    it("cancels a pending print job", async () => {
      const cancelledJob = { id: "pj_1", status: "cancelled" }
      mockCancel.mockResolvedValue(undefined)
      mockRetrievePrintJob.mockResolvedValue(cancelledJob)

      const req = createMockReq({ params: { id: "pj_1" } })
      const res = createMockRes()

      const printOrderService = req.scope.resolve("printOrder")
      await printOrderService.cancel("pj_1")
      const printJob = await printOrderService.retrievePrintJob("pj_1")
      res.json({ print_job: printJob })

      expect(mockCancel).toHaveBeenCalledWith("pj_1")
      expect(res.json).toHaveBeenCalledWith({ print_job: cancelledJob })
    })

    it("rejects cancellation of shipped job", async () => {
      mockCancel.mockRejectedValue(
        new Error('Cannot transition from "shipped" to "cancelled"')
      )

      const req = createMockReq({ params: { id: "pj_1" } })
      const res = createMockRes()

      const printOrderService = req.scope.resolve("printOrder")
      try {
        await printOrderService.cancel("pj_1")
        res.json({ print_job: {} })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error)
        res.status(400).json({ message })
      }

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        message: 'Cannot transition from "shipped" to "cancelled"',
      })
    })
  })
})
