import { z } from "zod"

const PRINT_JOB_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const

export const printOrderQuerySchema = z.object({
  status: z.enum(PRINT_JOB_STATUSES).optional(),
  order_id: z.string().optional(),
  offset: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const updatePrintJobSchema = z.object({
  status: z.enum(PRINT_JOB_STATUSES),
  tracking_number: z.string().optional(),
  notes: z.string().optional(),
})

export type PrintOrderQuery = z.infer<typeof printOrderQuerySchema>
export type UpdatePrintJobBody = z.infer<typeof updatePrintJobSchema>
