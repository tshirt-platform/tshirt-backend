import { Module } from "@medusajs/framework/utils"
import PrintOrderService from "./service"

export const PRINT_ORDER_MODULE = "printOrder"

export default Module(PRINT_ORDER_MODULE, {
  service: PrintOrderService,
})
