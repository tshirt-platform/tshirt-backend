import { model } from "@medusajs/framework/utils"

const PrintJob = model.define("print_job", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  status: model
    .enum(["pending", "processing", "shipped", "delivered", "cancelled"])
    .default("pending"),
  design_png_url: model.text(),
  design_json_url: model.text(),
  tracking_number: model.text().nullable(),
  notes: model.text().nullable(),
  metadata: model.json().nullable(),
})

export default PrintJob
