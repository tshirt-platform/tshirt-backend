import { useRef, useState } from "react"
import { Button } from "@medusajs/ui"
import { mockupImageUrl, mockupMaskUrl, type Mockup } from "../../lib/api"

type Point = [number, number]

type Props = {
  mockup: Mockup
  title: string
  help: string
  /** Show what is already cut out, to see what needs fixing */
  showMask?: boolean
  onSave: (outlines: number[][][]) => Promise<Mockup>
  onSaved: (m: Mockup) => void
  onClose: () => void
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const RADIUS = 0.012

/** Click around the shape to outline it, drag a corner to move it, double-click a corner to remove it */
export function OutlineEditor({ mockup, title, help, showMask, onSave, onSaved, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [shapes, setShapes] = useState<Point[][]>([[]])
  const [drag, setDrag] = useState<{ shape: number; point: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = shapes.length - 1

  const at = (e: { clientX: number; clientY: number }): Point => {
    const r = box.current!.getBoundingClientRect()
    return [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)]
  }

  function onBackground(e: React.PointerEvent) {
    if (drag) return
    setShapes((s) => s.map((pts, i) => (i === active ? [...pts, at(e)] : pts)))
  }

  function move(e: React.PointerEvent) {
    if (!drag) return
    const next = at(e)
    setShapes((s) => s.map((pts, i) => (i === drag.shape ? pts.map((p, j) => (j === drag.point ? next : p)) : pts)))
  }

  async function save() {
    const outlines = shapes.filter((pts) => pts.length >= 3)
    if (outlines.length === 0) {
      setError("Cần ít nhất 3 điểm để khoanh một vùng")
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await onSave(outlines))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="font-medium">{title}</div>
      <p className="text-ui-fg-subtle text-sm">{help}</p>
      <div
        ref={box}
        className="relative w-full max-w-xl cursor-crosshair touch-none select-none overflow-hidden rounded-lg border"
        onPointerDown={onBackground}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mockupImageUrl(mockup.id, mockup.version)} alt={mockup.name} className="block w-full" draggable={false} />
        {showMask && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mockupMaskUrl(mockup.id, mockup.version)} alt="" className="pointer-events-none absolute inset-0 size-full opacity-30 mix-blend-multiply" />
        )}
        <svg className="absolute inset-0 size-full" viewBox="0 0 1 1" preserveAspectRatio="none">
          {shapes.map((pts, i) => (
            <g key={i}>
              <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="rgba(14,165,233,0.25)" stroke="#0ea5e9" strokeWidth={0.003} />
              {pts.map((p, j) => (
                <circle
                  key={j}
                  cx={p[0]}
                  cy={p[1]}
                  r={RADIUS}
                  fill="#0ea5e9"
                  stroke="#fff"
                  strokeWidth={0.003}
                  className="cursor-move"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setDrag({ shape: i, point: j })
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    setShapes((s) => s.map((q, k) => (k === i ? q.filter((_, m) => m !== j) : q)))
                  }}
                />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="small" onClick={save} isLoading={saving}>Lưu vùng</Button>
        <Button size="small" variant="secondary" onClick={() => setShapes((s) => s.map((pts, i) => (i === active ? pts.slice(0, -1) : pts)))}>
          Hoàn tác điểm cuối
        </Button>
        <Button size="small" variant="secondary" onClick={() => setShapes((s) => [...s, []])}>Thêm vùng mới</Button>
        <Button size="small" variant="secondary" onClick={() => setShapes([[]])}>Xoá hết</Button>
        <Button size="small" variant="secondary" onClick={onClose}>Đóng</Button>
      </div>
      {error && <p className="text-ui-fg-error text-sm">{error}</p>}
    </div>
  )
}
