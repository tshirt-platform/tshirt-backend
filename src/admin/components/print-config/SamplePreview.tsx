import { useState } from "react"
import { mockupSampleUrl, type Mockup } from "../../lib/api"

type Props = {
  mockup: Mockup
  colors: { name: string; hex: string }[]
}

const FALLBACK = [{ name: "Trắng", hex: "#F4F4F0" }, { name: "Đen", hex: "#1A1A1A" }]

/** The photo as customers will see it: a sample design on it, in a colour the admin can switch */
export function SamplePreview({ mockup, colors }: Props) {
  const choices = (colors.length > 0 ? colors : FALLBACK).slice(0, 10)
  const [hex, setHex] = useState(choices[0].hex)
  const [failed, setFailed] = useState<string | null>(null)
  const url = mockupSampleUrl(mockup.id, mockup.version, hex)

  return (
    <div className="flex flex-col gap-y-2">
      <div className="relative flex h-64 w-48 items-center justify-center overflow-hidden rounded border bg-ui-bg-subtle">
        {mockup.quad && failed !== url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={url} src={url} alt={`Xem thử ${mockup.name}`} className="max-h-full max-w-full object-contain" onError={() => setFailed(url)} />
        ) : (
          <p className="text-ui-fg-subtle px-3 text-center text-xs">
            {mockup.quad ? "Không dựng được bản xem thử. Kiểm tra vùng áo và vùng in." : "Đặt vùng in để xem thử."}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Màu áo xem thử">
        {choices.map((c) => (
          <button
            key={c.hex + c.name}
            type="button"
            title={c.name}
            aria-label={c.name}
            aria-pressed={c.hex === hex}
            onClick={() => setHex(c.hex)}
            style={{ backgroundColor: c.hex }}
            className={`size-5 rounded-full border ${c.hex === hex ? "ring-2 ring-blue-500" : ""}`}
          />
        ))}
      </div>
    </div>
  )
}
