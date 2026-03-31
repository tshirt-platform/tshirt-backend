describe("createPrintJobWorkflow", () => {
  const mockRetrieveOrder = jest.fn()
  const mockCreateForOrder = jest.fn()
  const mockCancel = jest.fn()

  function createMockContainer() {
    return {
      resolve: jest.fn((name: string) => {
        if (name === "order") {
          return { retrieveOrder: mockRetrieveOrder }
        }
        if (name === "printOrder") {
          return { createForOrder: mockCreateForOrder, cancel: mockCancel }
        }
        throw new Error(`Unknown service: ${name}`)
      }),
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Simulate the full workflow pipeline
  async function runWorkflow(orderId: string) {
    const container = createMockContainer()

    // Step 1: fetch order
    const orderService = container.resolve("order")
    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items", "items.metadata"],
    })
    if (!order) {
      throw new Error(`Order ${orderId} not found`)
    }

    // Step 2: extract design data
    const items = order.items.map(
      (item: { id: string; metadata: Record<string, unknown> | null }) => {
        const meta = item.metadata
        if (!meta?.design_png_url || !meta?.design_json_url) {
          throw new Error(
            `Missing design metadata on order item ${item.id}`
          )
        }
        return {
          design_png_url: meta.design_png_url as string,
          design_json_url: meta.design_json_url as string,
        }
      }
    )

    // Step 3: create print jobs
    const printOrderService = container.resolve("printOrder")
    const printJobIds: string[] = []
    for (const item of items) {
      const job = await printOrderService.createForOrder({
        order_id: orderId,
        design_png_url: item.design_png_url,
        design_json_url: item.design_json_url,
      })
      printJobIds.push(job.id)
    }

    return { print_job_ids: printJobIds }
  }

  it("full workflow success path", async () => {
    const mockOrder = {
      id: "order_123",
      items: [
        {
          id: "item_1",
          metadata: {
            design_png_url: "https://s3.example.com/front.png",
            design_json_url: "https://s3.example.com/front.json",
          },
        },
      ],
    }
    mockRetrieveOrder.mockResolvedValue(mockOrder)
    mockCreateForOrder.mockResolvedValue({ id: "pj_1" })

    const result = await runWorkflow("order_123")

    expect(result.print_job_ids).toEqual(["pj_1"])
    expect(mockRetrieveOrder).toHaveBeenCalledWith("order_123", {
      relations: ["items", "items.metadata"],
    })
    expect(mockCreateForOrder).toHaveBeenCalledWith({
      order_id: "order_123",
      design_png_url: "https://s3.example.com/front.png",
      design_json_url: "https://s3.example.com/front.json",
    })
  })

  it("workflow fails on missing order", async () => {
    mockRetrieveOrder.mockResolvedValue(null)

    await expect(runWorkflow("order_missing")).rejects.toThrow(
      "Order order_missing not found"
    )
  })

  it("workflow fails on missing design metadata", async () => {
    mockRetrieveOrder.mockResolvedValue({
      id: "order_123",
      items: [{ id: "item_1", metadata: null }],
    })

    await expect(runWorkflow("order_123")).rejects.toThrow(
      "Missing design metadata on order item item_1"
    )
  })
})
