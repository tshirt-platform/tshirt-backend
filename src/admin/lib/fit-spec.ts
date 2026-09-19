import { derivePrintArea, toGarmentMeasurements, type DesignSide, type PrintConfigMeta } from "@tshirt-platform/shared"
import type { FitSpec } from "./api"

/** The size worn in a mockup photo when the admin has not said: the middle of the chart */
export function defaultReferenceSize(config: PrintConfigMeta): string {
  const rows = config.size_chart
  return rows[Math.floor((rows.length - 1) / 2)]?.size ?? ""
}

/**
 * What the render service needs to place the print at its real size. The photo shows one
 * reference size, so its body length is what turns millimetres into pixels.
 */
export function fitSpec(config: PrintConfigMeta, side: DesignSide, referenceSize: string): FitSpec | null {
  const row = config.size_chart.find((r) => r.size === referenceSize) ?? config.size_chart[0]
  if (!row) return null
  try {
    const area = derivePrintArea(toGarmentMeasurements(config), side)
    return {
      print_width_mm: area.widthMm,
      print_height_mm: area.heightMm,
      top_offset_mm: area.topOffsetMm,
      garment_length_mm: row.length * 10,
    }
  } catch {
    return null
  }
}
