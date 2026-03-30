import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { fetchOrderStep } from "./steps/fetch-order"
import { extractDesignDataStep } from "./steps/extract-design-data"
import { createPrintJobStep } from "./steps/create-print-job"

type CreatePrintJobWorkflowInput = {
  order_id: string
}

export const createPrintJobWorkflow = createWorkflow(
  "create-print-job",
  (input: CreatePrintJobWorkflowInput) => {
    const order = fetchOrderStep(input)
    const designData = extractDesignDataStep({ order })
    const result = createPrintJobStep(designData)

    return new WorkflowResponse(result)
  }
)
