import { derivePrintArea, toGarmentMeasurements, type DesignSide, type PrintConfigMeta } from "@tshirt-platform/shared"
import type { FitSpec } from "./api"

/**
 * What the render service needs to place the print at its real size, by the editor's own rule:
 * the body across the chest is the flat chest width of the chart (the smallest chest), so the
 * print is the same share of the body in every photo and in the editor.
 */
export function fitSpec(config: PrintConfigMeta, side: DesignSide): FitSpec | null {
  try {
    const area = derivePrintArea(toGarmentMeasurements(config), side)
    return {
      print_width_mm: area.widthMm,
      print_height_mm: area.heightMm,
      top_offset_mm: area.topOffsetMm,
      body_width_mm: area.flatWidthMm,
    }
  } catch {
    return null
  }
}
