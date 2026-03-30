import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

type FetchOrderInput = {
  order_id: string
}

export const fetchOrderStep = createStep(
  "fetch-order",
  async ({ order_id }: FetchOrderInput, { container }) => {
    const orderService = container.resolve("order")
    const order = await orderService.retrieveOrder(order_id, {
      relations: ["items", "items.metadata"],
    })

    if (!order) {
      throw new Error(`Order ${order_id} not found`)
    }

    return new StepResponse(order)
  }
)
