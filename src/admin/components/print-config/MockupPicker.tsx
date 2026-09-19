import { useState } from "react"
import { Badge, Button } from "@medusajs/ui"
import type { DesignSide } from "@tshirt-platform/shared"
import {
  mockupImageUrl,
  replaceMaskLayer,
  SIDE_LABEL,
  uploadMockup,
  type Mockup,
} from "../../lib/api"
import { QuadEditor } from "./QuadEditor"

type Props = {
  side: DesignSide
  selectedId: string | undefined
  mockups: Mockup[]
  onSelect: (id: string | undefined) => void
  onMockupChanged: (m: Mockup) => void
}

export function MockupPicker({ side, selectedId, mockups, onSelect, onMockupChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const selected = mockups.find((m) => m.id === selectedId)

  async function run(task: () => Promise<Mockup>, select = false) {
    setBusy(true)
    setError(null)
    try {
      const m = await task()
      onMockupChanged(m)
      if (select) onSelect(m.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại")
    } finally {
      setBusy(false)
    }
  }

  const coverage = selected ? Math.round(selected.mask_coverage * 100) : 0
  const suspicious = selected && (coverage < 5 || coverage > 90)

  return (
    <div className="flex flex-col gap-y-3 rounded-lg border p-3">
      <div className="font-medium">{SIDE_LABEL[side]}</div>

      <select
        className="bg-ui-bg-field h-8 rounded-md border px-2 text-sm"
        value={selectedId ?? ""}
        onChange={(e) => {
          setEditing(false)
          onSelect(e.target.value || undefined)
        }}
      >
        <option value="">Chưa có ảnh mockup (dùng bản xem trước phẳng)</option>
        {mockups.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>

      <label className="text-sm">
        <span className="text-ui-fg-subtle">Tải ảnh áo mới (áo trơn, sáng màu, nền đơn sắc): </span>
        <input
          type="file"
          accept="image/jpeg,image/png"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void run(() => uploadMockup(file, file.name.replace(/\.[^.]+$/, "")), true)
          }}
        />
      </label>

      {selected && (
        <div className="flex flex-col gap-y-2">
          <div className="flex items-start gap-x-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mockupImageUrl(selected.id, selected.version)} alt={selected.name} className="h-32 rounded border" />
            <div className="flex flex-col gap-y-1 text-sm">
              <div className="flex items-center gap-x-2">
                Vùng in: {selected.quad ? <Badge color="green">đã đặt</Badge> : <Badge color="orange">chưa đặt</Badge>}
              </div>
              <div className="text-ui-fg-subtle">Vùng áo nhận diện: {coverage}% ảnh</div>
              <div className="text-ui-fg-subtle">Lớp che (tay, tóc): {selected.has_occlusion ? "có" : "không"}</div>
              {suspicious && (
                <div className="text-ui-fg-error">Nhận diện áo có vẻ sai. Hãy dùng ảnh nền đơn sắc hoặc tải mask tự vẽ.</div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" onClick={() => setEditing((v) => !v)}>
              {selected.quad ? "Chỉnh 4 góc vùng in" : "Đặt 4 góc vùng in"}
            </Button>
          </div>
          <details className="text-sm">
            <summary className="text-ui-fg-subtle cursor-pointer">Nâng cao: thay mask hoặc lớp che</summary>
            <div className="mt-2 flex flex-col gap-y-2">
              {(["mask", "occlusion"] as const).map((layer) => (
                <label key={layer}>
                  <span className="text-ui-fg-subtle">
                    {layer === "mask" ? "Mask áo (trắng = vải): " : "Lớp che (trắng = che hình in): "}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (file) void run(() => replaceMaskLayer(selected.id, layer, file))
                    }}
                  />
                </label>
              ))}
            </div>
          </details>
          {editing && (
            <QuadEditor
              mockup={selected}
              onSaved={(m) => {
                onMockupChanged(m)
                setEditing(false)
              }}
              onClose={() => setEditing(false)}
            />
          )}
        </div>
      )}
      {error && <p className="text-ui-fg-error text-sm">{error}</p>}
    </div>
  )
}
