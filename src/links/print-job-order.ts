import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import { PRINT_ORDER_MODULE } from "../modules/print-order"

export default defineLink(
  {
    linkable: {
      serviceName: PRINT_ORDER_MODULE,
      field: "printJob",
      entity: "PrintJob",
      linkable: "print_job_id",
      primaryKey: "id",
    },
    isList: true,
  },
  OrderModule.linkable.order
)
