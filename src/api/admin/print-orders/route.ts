import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { printOrderQuerySchema } from "./validators"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = printOrderQuerySchema.parse(req.query)
  const printOrderService = req.scope.resolve("printOrder")

  const filters: Record<string, unknown> = {}
  if (query.status) {
    filters.status = query.status
  }
  if (query.order_id) {
    filters.order_id = query.order_id
  }

  const [printJobs, count] = await printOrderService.listAndCountPrintJobs(
    filters,
    { skip: query.offset, take: query.limit, order: { created_at: "DESC" } }
  )

  res.json({
    print_jobs: printJobs,
    count,
    offset: query.offset,
    limit: query.limit,
  })
}
