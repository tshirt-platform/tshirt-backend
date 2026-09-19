import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import type { DesignSide, GarmentSnapshot, PrintPlacement } from "@tshirt-platform/shared"

export type DesignItem = {
  order_item_id: string
  side: DesignSide
  quantity: number
  design_png_url: string
  design_json_url: string
  preview_url?: string
  placement?: PrintPlacement
  garment?: GarmentSnapshot
}

export type ExtractDesignDataOutput = {
  order_id: string
  items: DesignItem[]
}

type OrderInput = {
  id: string
  items?: Array<{
    id: string
    quantity?: number
    metadata?: Record<string, unknown> | null
  }>
}

const SIDES: readonly string[] = ["front", "back"]

function isSide(v: unknown): v is DesignSide {
  return typeof v === "string" && SIDES.includes(v)
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v !== ""
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

// One entry per printed side. Line items saved before multi-side designs carry
// design_png_url/design_json_url directly, and are read as a single side.
export function extractDesignItems(order: OrderInput): ExtractDesignDataOutput {
  const items: DesignItem[] = []

  for (const item of order.items ?? []) {
    const meta = item.metadata
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1
    const missing = () =>
      new Error(`Missing design metadata on order item ${item.id}`)

    if (Array.isArray(meta?.designs) && meta.designs.length > 0) {
      const garment = asRecord(meta.garment) as GarmentSnapshot | null
      for (const raw of meta.designs) {
        const d = asRecord(raw)
        if (!d || !isSide(d.side) || !isNonEmptyString(d.png_url) || !isNonEmptyString(d.json_url)) {
          throw missing()
        }
        items.push({
          order_item_id: item.id,
          side: d.side,
          quantity,
          design_png_url: d.png_url,
          design_json_url: d.json_url,
          ...(isNonEmptyString(d.preview_url) ? { preview_url: d.preview_url } : {}),
          ...(asRecord(d.placement) ? { placement: d.placement as PrintPlacement } : {}),
          ...(garment ? { garment } : {}),
        })
      }
      continue
    }

    if (!isNonEmptyString(meta?.design_png_url) || !isNonEmptyString(meta?.design_json_url)) {
      throw missing()
    }
    items.push({
      order_item_id: item.id,
      side: isSide(meta.design_side) ? meta.design_side : "front",
      quantity,
      design_png_url: meta.design_png_url,
      design_json_url: meta.design_json_url,
    })
  }

  return { order_id: order.id, items }
}

export const extractDesignDataStep = createStep(
  "extract-design-data",
  async (input: {
    order: OrderInput
  }): Promise<StepResponse<ExtractDesignDataOutput>> =>
    new StepResponse(extractDesignItems(input.order))
)
