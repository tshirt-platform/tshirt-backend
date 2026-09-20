import { useState } from "react"
import { Button } from "@medusajs/ui"
import type { Mockup } from "../../lib/api"

type Props = {
  mockup: Mockup
  disabled: boolean
  onSave: (wrapDeg: number, yawDeg: number) => void
}

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0))

/** A shirt on a body is a curve, not a flat sheet: how much the print wraps and where the body faces */
export function CurveControls({ mockup, disabled, onSave }: Props) {
  const [wrap, setWrap] = useState(mockup.wrap_deg ?? 0)
  const [yaw, setYaw] = useState(mockup.yaw_deg ?? 0)
  const tooFar = Math.abs(yaw) + wrap / 2 > 88

  return (
    <div className="flex flex-col gap-y-2 text-sm">
      <div className="text-ui-fg-subtle">
        Độ cong: 0 cho áo trải phẳng; áo có người mặc khoảng 60-90. Góc xoay: âm khi ngực người mẫu quay sang trái ảnh, dương khi quay sang phải.
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-y-1">
          Độ cong (°)
          <input
            type="number"
            min={0}
            max={140}
            value={wrap}
            onChange={(e) => setWrap(clampNum(e.target.valueAsNumber, 0, 140))}
            className="bg-ui-bg-field h-8 w-24 rounded-md border px-2"
          />
        </label>
        <label className="flex flex-col gap-y-1">
          Góc xoay (°)
          <input
            type="number"
            min={-80}
            max={80}
            value={yaw}
            onChange={(e) => setYaw(clampNum(e.target.valueAsNumber, -80, 80))}
            className="bg-ui-bg-field h-8 w-24 rounded-md border px-2"
          />
        </label>
        <Button size="small" variant="secondary" disabled={disabled || tooFar} onClick={() => onSave(wrap, yaw)}>
          Lưu độ cong
        </Button>
      </div>
      {tooFar && <p className="text-ui-fg-error">Độ cong và góc xoay quá lớn: hình in sẽ quay khuất khỏi thân áo.</p>}
    </div>
  )
}
