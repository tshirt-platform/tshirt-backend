import { useRef, useState } from "react"
import { Button } from "@medusajs/ui"
import { mockupImageUrl, mockupMaskUrl, saveQuad, type Mockup } from "../../lib/api"

type Point = [number, number]
const DEFAULT_QUAD: Point[] = [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]]
const CORNERS = ["Trái-trên", "Phải-trên", "Phải-dưới", "Trái-dưới"]

const clamp = (v: number) => Math.min(1, Math.max(0, v))

type Props = {
  mockup: Mockup
  onSaved: (m: Mockup) => void
  onClose: () => void
}

/** Drag the four corners onto where the print area appears in the photo */
export function QuadEditor({ mockup, onSaved, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [points, setPoints] = useState<Point[]>((mockup.quad as Point[] | null) ?? DEFAULT_QUAD)
  const [drag, setDrag] = useState<number | null>(null)
  const [showMask, setShowMask] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function move(e: React.PointerEvent) {
    if (drag === null || !box.current) return
    const r = box.current.getBoundingClientRect()
    const next: Point = [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)]
    setPoints((p) => p.map((old, i) => (i === drag ? next : old)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      onSaved(await saveQuad(mockup.id, points))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <p className="text-ui-fg-subtle text-sm">
        Kéo 4 điểm về đúng 4 góc vùng in trên ảnh, theo thứ tự trái-trên, phải-trên, phải-dưới, trái-dưới. Với ảnh áo
        chụp nghiêng, hãy đặt các góc theo hình dạng thật của vùng in trên vải.
      </p>
      <div
        ref={box}
        className="relative w-full max-w-xl touch-none select-none overflow-hidden rounded-lg border"
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mockupImageUrl(mockup.id, mockup.version)} alt={mockup.name} className="block w-full" draggable={false} />
        {showMask && (
          <img
            src={mockupMaskUrl(mockup.id, mockup.version)}
            alt="Vùng áo nhận diện"
            className="pointer-events-none absolute inset-0 size-full opacity-40 mix-blend-multiply"
            style={{ filter: "invert(1) sepia(1) saturate(6) hue-rotate(90deg)" }}
            draggable={false}
          />
        )}
        <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
          <polygon
            points={points.map((p) => p.join(",")).join(" ")}
            fill="rgba(0,170,255,0.18)"
            stroke="#00aaff"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, i) => (
          <button
            key={i}
            type="button"
            aria-label={CORNERS[i]}
            title={CORNERS[i]}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              setDrag(i)
            }}
            style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%` }}
            className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white bg-[#00aaff] text-xs font-bold text-white shadow active:cursor-grabbing"
          >
            {i + 1}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-x-2 text-sm">
        <input type="checkbox" checked={showMask} onChange={(e) => setShowMask(e.target.checked)} />
        Hiện vùng áo hệ thống nhận diện (màu xanh lá)
      </label>
      {error && <p className="text-ui-fg-error text-sm">{error}</p>}
      <div className="flex gap-x-2">
        <Button size="small" onClick={save} isLoading={saving}>Lưu vùng in</Button>
        <Button size="small" variant="secondary" onClick={onClose}>Đóng</Button>
      </div>
    </div>
  )
}
