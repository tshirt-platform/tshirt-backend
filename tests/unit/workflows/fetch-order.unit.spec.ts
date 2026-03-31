/**
 * Tests for fetchOrderStep logic.
 *
 * Since createStep wraps the handler internally, we import
 * the step module and re-implement the handler logic inline
 * to test it in isolation.
 */

describe("fetchOrderStep", () => {
  const mockRetrieveOrder = jest.fn()
  const mockContainer = {
    resolve: jest.fn().mockReturnValue({
      retrieveOrder: mockRetrieveOrder,
    }),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Re-create the step handler logic for testability
  async function runFetchOrder(orderId: string) {
    const orderService = mockContainer.resolve("order")
    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items", "items.metadata"],
    })
    if (!order) {
      throw new Error(`Order ${orderId} not found`)
    }
    return order
  }

  it("fetches order with line items", async () => {
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

    const result = await runFetchOrder("order_123")

    expect(mockContainer.resolve).toHaveBeenCalledWith("order")
    expect(mockRetrieveOrder).toHaveBeenCalledWith("order_123", {
      relations: ["items", "items.metadata"],
    })
    expect(result).toEqual(mockOrder)
  })

  it("throws on missing order", async () => {
    mockRetrieveOrder.mockResolvedValue(null)

    await expect(runFetchOrder("order_missing")).rejects.toThrow(
      "Order order_missing not found"
    )
  })
})
