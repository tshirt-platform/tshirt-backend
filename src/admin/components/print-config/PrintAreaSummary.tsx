import { derivePrintArea, toGarmentMeasurements, type PrintConfigMeta } from "@tshirt-platform/shared"
import { SIDE_LABEL } from "../../lib/api"

/** What the numbers above produce: the print size, the file size and where it sits */
export function PrintAreaSummary({ config }: { config: PrintConfigMeta }) {
  const measurements = toGarmentMeasurements(config)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {(["front", "back"] as const).map((side) => {
        try {
          const a = derivePrintArea(measurements, side)
          return (
            <div key={side} className="rounded-lg border p-3 text-sm">
              <div className="font-medium">{SIDE_LABEL[side]}</div>
              <div className="text-ui-fg-subtle">
                Khổ in {Math.round(a.widthMm)} × {Math.round(a.heightMm)} mm
              </div>
              <div className="text-ui-fg-subtle">File in {a.widthPx} × {a.heightPx} px @ 300 DPI</div>
              <div className="text-ui-fg-subtle">Cạnh trên cách điểm cao nhất của vai {Math.round(a.topOffsetMm)} mm</div>
            </div>
          )
        } catch (e) {
          return (
            <div key={side} className="border-ui-border-error rounded-lg border p-3 text-sm">
              <div className="font-medium">{SIDE_LABEL[side]}</div>
              <div className="text-ui-fg-error">{e instanceof Error ? e.message : "Số đo không hợp lệ"}</div>
            </div>
          )
        }
      })}
    </div>
  )
}

export function printAreaError(config: PrintConfigMeta): string | null {
  try {
    const m = toGarmentMeasurements(config)
    derivePrintArea(m, "front")
    derivePrintArea(m, "back")
    return null
  } catch (e) {
    return e instanceof Error ? e.message : "Số đo không hợp lệ"
  }
}
