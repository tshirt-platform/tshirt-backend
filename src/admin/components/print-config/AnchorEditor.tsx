import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@medusajs/ui"
import { anchorQuad, type Anchors, type Point } from "../../lib/anchor-quad"
import { getAnchors, mockupImageUrl, saveAnchors, type FitSpec, type Mockup } from "../../lib/api"

type Props = {
  mockup: Mockup
  spec: FitSpec | null
  onSaved: (m: Mockup) => void
  onClose: () => void
}

const KEYS = ["hps", "left", "right"] as const
type Key = (typeof KEYS)[number]
const LABEL: Record<Key, string> = { hps: "1 Vai", left: "2 Trái", right: "3 Phải" }

const clamp = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Three points fix where the print lands on a photo, by the same rule as the editor:
 * the shoulder point, and the two edges of the body across the chest.
 */
export function AnchorEditor({ mockup, spec, onSaved, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [guess, setGuess] = useState<Anchors | null>(null)
  const [points, setPoints] = useState<Anchors | null>(null)
  const [drag, setDrag] = useState<Key | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAnchors(mockup.id)
      .then(({ anchors }) => {
        setGuess(anchors)
        setPoints(anchors)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Không tải được điểm chuẩn"))
  }, [mockup.id])

  const size = { width: mockup.width, height: mockup.height }
  const quad = useMemo(() => (points && spec ? anchorQuad(points, spec, size) : null), [points, spec, size.width, size.height])
  const outside = quad?.some(([x, y]) => x < 0 || x > 1 || y < 0 || y > 1) ?? false

  function move(e: React.PointerEvent) {
    if (!drag || !box.current || !points) return
    const r = box.current.getBoundingClientRect()
    const next: Point = [clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)]
    setPoints({ ...points, [drag]: next })
  }

  async function save() {
    if (!points || !spec) return
    setSaving(true)
    setError(null)
    try {
      onSaved(await saveAnchors(mockup.id, points, spec))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="font-medium">Đặt 3 điểm chuẩn</div>
      <p className="text-ui-fg-subtle text-sm">
        Kéo 3 điểm về đúng chỗ trên áo. <b>1 Vai</b>: điểm cao nhất của vai, sát cổ áo. <b>2 Trái</b> và <b>3 Phải</b>: hai mép
        thân áo ngang ngực, ngay dưới nách (không tính tay áo). Áo treo nghiêng thì để hai điểm 2 và 3 nghiêng theo. Khung xanh
        là chỗ hình in sẽ nằm, cùng kích thước thật như trong editor.
      </p>
      {!spec && <p className="text-ui-fg-error text-sm">Số đo áo chưa hợp lệ nên chưa tính được khổ in.</p>}
      {!points && !error && <p className="text-ui-fg-subtle text-sm">Đang tải…</p>}

      {points && (
        <div
          ref={box}
          className="relative w-full max-w-xl touch-none select-none overflow-hidden rounded-lg border"
          onPointerMove={move}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mockupImageUrl(mockup.id, mockup.version)} alt={mockup.name} className="block w-full" draggable={false} />
          <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 1 1" preserveAspectRatio="none">
            <line x1={points.left[0]} y1={points.left[1]} x2={points.right[0]} y2={points.right[1]} stroke="#f59e0b" strokeWidth={0.003} strokeDasharray="0.01 0.008" />
            {quad && (
              <polygon
                points={quad.map((p) => p.join(",")).join(" ")}
                fill="rgba(14,165,233,0.18)"
                stroke={outside ? "#ef4444" : "#0ea5e9"}
                strokeWidth={0.004}
              />
            )}
          </svg>
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-label={LABEL[k]}
              onPointerDown={(e) => {
                e.preventDefault()
                setDrag(k)
              }}
              style={{ left: `${points[k][0] * 100}%`, top: `${points[k][1] * 100}%` }}
              className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded-full border-2 border-white bg-amber-500 text-xs font-bold text-white shadow"
            >
              {LABEL[k][0]}
            </button>
          ))}
        </div>
      )}

      {points && !quad && spec && (
        <p className="text-ui-fg-error text-sm">Điểm 2 phải nằm bên trái điểm 3 và hai điểm không được quá sát nhau.</p>
      )}
      {outside && <p className="text-ui-fg-error text-sm">Hình in bị tràn ra ngoài ảnh ở kích thước này: kiểm tra lại 3 điểm.</p>}

      <div className="flex flex-wrap gap-2">
        <Button size="small" onClick={save} isLoading={saving} disabled={!points || !spec || !quad || outside}>Lưu 3 điểm</Button>
        <Button size="small" variant="secondary" disabled={!guess} onClick={() => setPoints(guess)}>Về gợi ý tự động</Button>
        <Button size="small" variant="secondary" onClick={onClose}>Đóng</Button>
      </div>
      {error && <p className="text-ui-fg-error text-sm">{error}</p>}
    </div>
  )
}
