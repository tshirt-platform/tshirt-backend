import { model } from "@medusajs/framework/utils"
import { PRINT_JOB_STATUSES } from "@tshirt-platform/shared"

// One job per printed side of an order line item. Garment and placement columns are
// nullable so jobs created before they existed stay valid.
const PrintJob = model.define("print_job", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  order_item_id: model.text().nullable(),
  status: model.enum([...PRINT_JOB_STATUSES]).default("pending"),
  side: model.enum(["front", "back"]).nullable(),
  quantity: model.number().default(1),
  garment_size: model.text().nullable(),
  color_name: model.text().nullable(),
  color_hex: model.text().nullable(),
  supplier_color_code: model.text().nullable(),
  needs_underbase: model.boolean().nullable(),
  placement: model.json().nullable(),
  design_png_url: model.text(),
  design_json_url: model.text(),
  preview_url: model.text().nullable(),
  tracking_number: model.text().nullable(),
  notes: model.text().nullable(),
  metadata: model.json().nullable(),
})
  // Order tracking and the print package look jobs up by order; the admin list filters by status
  .indexes([{ on: ["order_id"] }, { on: ["status"] }])

export default PrintJob
