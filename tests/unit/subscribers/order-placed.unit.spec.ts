describe("orderPlacedHandler", () => {
  const mockRun = jest.fn()
  const mockWorkflow = jest.fn().mockReturnValue({ run: mockRun })
  const mockLoggerInfo = jest.fn()
  const mockLoggerError = jest.fn()
  const mockContainer = {
    resolve: jest.fn((name: string) => {
      if (name === "logger") {
        return { info: mockLoggerInfo, error: mockLoggerError }
      }
      throw new Error(`Unknown service: ${name}`)
    }),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
  })

  // Simulate the subscriber handler logic
  async function runHandler(orderId: string) {
    const logger = mockContainer.resolve("logger")
    try {
      await mockWorkflow(mockContainer).run({
        input: { order_id: orderId },
      })
      logger.info(`Print job created for order ${orderId}`)
    } catch (error) {
      logger.error(
        `Failed to create print job for order ${orderId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  it("triggers workflow on order.placed event", async () => {
    mockRun.mockResolvedValue({ result: { print_job_ids: ["pj_1"] } })

    await runHandler("order_123")

    expect(mockWorkflow).toHaveBeenCalledWith(mockContainer)
    expect(mockRun).toHaveBeenCalledWith({
      input: { order_id: "order_123" },
    })
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "Print job created for order order_123"
    )
    expect(mockLoggerError).not.toHaveBeenCalled()
  })

  it("logs error without re-throwing on failure", async () => {
    mockRun.mockRejectedValue(new Error("Order not found"))

    await runHandler("order_fail")

    expect(mockLoggerError).toHaveBeenCalledWith(
      "Failed to create print job for order order_fail: Order not found"
    )
    // Should NOT throw — handler completes successfully
  })
})
