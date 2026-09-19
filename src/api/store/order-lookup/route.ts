import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"
import { clientKey, createRateLimiter } from "../../../lib/rate-limit"
import { parseOrderRef, sameEmail, toTrackingView, type JobInput, type OrderInput } from "../../../lib/order-tracking/lookup"

const bodySchema = z.object({
  order: z.string().min(1).max(64),
  email: z.string().min(3).max(254),
})

// Guessing an order needs its email too, but the short numbers are sequential, so attempts are limited
const limiter = createRateLimiter(10, 10 * 60 * 1000)

const FIELDS = [
  // items.quantity comes back only when the line's detail is requested with it
  "id", "display_id", "email", "created_at", "currency_code", "shipping_total", "metadata",
  "items.id", "items.title", "items.quantity", "items.detail.quantity", "items.unit_price", "items.thumbnail", "items.metadata",
  "shipping_address.first_name", "shipping_address.last_name", "shipping_address.phone",
  "shipping_address.address_1", "shipping_address.address_2", "shipping_address.city",
  "payment_collections.status", "payment_collections.payments.provider_id",
]

/**
 * Order tracking without an account: the order number plus the email it was placed with.
 * A wrong number and a wrong email get the same answer, so the endpoint cannot be used
 * to find out which orders exist.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const verdict = limiter.hit(clientKey(req))
  if (!verdict.allowed) {
    res.setHeader("Retry-After", String(verdict.retryAfterSeconds))
    res.status(429).json({ message: "Thử quá nhiều lần, vui lòng đợi ít phút rồi thử lại" })
    return
  }

  const body = bodySchema.safeParse(req.body)
  const ref = body.success ? parseOrderRef(body.data.order) : null
  if (!body.success || !ref) {
    res.status(400).json({ message: "Nhập mã đơn hàng và email đã dùng khi đặt hàng" })
    return
  }

  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "order",
    // The generated filter types call display_id a string; it is a number in the database
    filters: ("id" in ref ? { id: ref.id } : { display_id: ref.displayId }) as never,
    fields: FIELDS,
  })
  const order = data[0] as unknown as OrderInput | undefined

  if (!order || !sameEmail(order.email, body.data.email)) {
    res.status(404).json({ message: "Không tìm thấy đơn hàng khớp với mã và email này" })
    return
  }

  const printOrder = req.scope.resolve("printOrder") as {
    listPrintJobs: (f: object, o?: object) => Promise<JobInput[]>
  }
  const jobs = await printOrder.listPrintJobs({ order_id: order.id }, { order: { created_at: "ASC" } })

  res.json({ order: toTrackingView(order, jobs) })
}
