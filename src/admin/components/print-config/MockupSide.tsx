import { useState } from "react"
import type { DesignSide } from "@tshirt-platform/shared"
import { fitQuad, SIDE_LABEL, uploadMockup, type FitSpec, type Mockup } from "../../lib/api"
import { MockupCard } from "./MockupCard"

type Props = {
  side: DesignSide
  ids: string[]
  mockups: Mockup[]
  spec: FitSpec | null
  onIds: (ids: string[]) => void
  onMockupChanged: (m: Mockup) => void
}

/** The preview photos of one side, in the order the storefront shows them */
export function MockupSide({ side, ids, mockups, spec, onIds, onMockupChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const chosen = ids.map((id) => mockups.find((m) => m.id === id)).filter((m): m is Mockup => Boolean(m))
  const unused = mockups.filter((m) => !ids.includes(m.id))

  function move(index: number, delta: -1 | 1) {
    const next = [...ids]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    onIds(next)
  }

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      let m = await uploadMockup(file, file.name.replace(/\.[^.]+$/, ""))
      onMockupChanged(m)
      onIds([...ids, m.id])
      if (spec) {
        try {
          m = await fitQuad(m.id, spec)
          onMockupChanged(m)
        } catch (e) {
          setError(e instanceof Error ? `Chưa đặt được vùng in: ${e.message}` : "Chưa đặt được vùng in")
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được ảnh")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <div className="font-medium">
        {SIDE_LABEL[side]} <span className="text-ui-fg-subtle text-sm font-normal">({chosen.length} ảnh)</span>
      </div>

      {chosen.length === 0 && (
        <p className="text-ui-fg-subtle text-sm">Chưa có ảnh mockup, khách sẽ thấy bản xem trước phẳng.</p>
      )}
      {chosen.map((m, i) => (
        <MockupCard
          key={m.id}
          mockup={m}
          spec={spec}
          position={i}
          total={chosen.length}
          onMove={(d) => move(i, d)}
          onRemove={() => onIds(ids.filter((id) => id !== m.id))}
          onChanged={onMockupChanged}
        />
      ))}

      <div className="flex flex-col gap-y-2 rounded-lg border border-dashed p-3 text-sm">
        <label>
          <span className="text-ui-fg-subtle">Tải ảnh mới (áo trơn, sáng màu, nền đơn sắc, hoặc người mẫu kèm mask): </span>
          <input
            type="file"
            accept="image/jpeg,image/png"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (file) void upload(file)
            }}
          />
        </label>
        {unused.length > 0 && (
          <select
            className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm"
            value=""
            onChange={(e) => e.target.value && onIds([...ids, e.target.value])}
          >
            <option value="">Thêm ảnh đã tải trước đó…</option>
            {unused.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
      </div>
      {error && <p className="text-ui-fg-error text-sm">{error}</p>}
    </div>
  )
}
