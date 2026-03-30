import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

type ExtractDesignDataInput = {
  order: {
    id: string
    items: Array<{
      id: string
      metadata: Record<string, unknown> | null
    }>
  }
}

type DesignItem = {
  design_png_url: string
  design_json_url: string
}

type ExtractDesignDataOutput = {
  order_id: string
  items: DesignItem[]
}

export const extractDesignDataStep = createStep(
  "extract-design-data",
  async (
    { order }: ExtractDesignDataInput
  ): Promise<StepResponse<ExtractDesignDataOutput>> => {
    const items: DesignItem[] = order.items.map((item) => {
      const meta = item.metadata
      if (!meta?.design_png_url || !meta?.design_json_url) {
        throw new Error(
          `Missing design metadata on order item ${item.id}`
        )
      }

      return {
        design_png_url: meta.design_png_url as string,
        design_json_url: meta.design_json_url as string,
      }
    })

    return new StepResponse({ order_id: order.id, items })
  }
)
