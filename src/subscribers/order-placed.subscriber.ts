import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { createPrintJobWorkflow } from "../workflows/create-print-job"

export default async function orderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const orderId = event.data.id

  try {
    await createPrintJobWorkflow(container).run({
      input: { order_id: orderId },
    })

    logger.info(`Print job created for order ${orderId}`)
  } catch (error) {
    // Log but don't re-throw — avoid blocking the order flow
    logger.error(
      `Failed to create print job for order ${orderId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
