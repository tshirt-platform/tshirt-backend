import { useCallback, useEffect, useState } from "react"
import { Badge, Button, Switch } from "@medusajs/ui"
import {
  listLayers,
  mockupImageUrl,
  mockupLayerUrl,
  rebuildLayers,
  setLayerEnabled,
  type Layer,
  type Mockup,
} from "../../lib/api"

const LABEL: Record<Layer["kind"], string> = {
  photo: "Ảnh gốc",
  garment: "Vải áo",
  shading: "Sáng tối",
  creases: "Nếp gấp",
  print: "Hình in",
  arm: "Cánh tay",
  hair: "Tóc",
  bag: "Túi, phụ kiện",
  scarf: "Khăn",
  manual: "Lớp che tự vẽ",
  other: "Vật che khác",
}

const NOTE: Partial<Record<Layer["kind"], string>> = {
  photo: "Toàn bộ ảnh chụp, chưa tách",
  garment: "Chỉ vùng này được đổi màu và in lên",
  shading: "Ánh sáng và bóng của vải, dùng khi đổi màu áo",
  creases: "Nếp nhăn, dùng để uốn hình in theo vải",
  print: "Hình in đã đặt, vẽ thử bằng mẫu có sẵn",
  manual: "Vùng che do bạn tự khoanh, không tách được từng phần",
}

const SIDE: Record<string, string> = { left: "bên trái ảnh", right: "bên phải ảnh" }

/** Transparent parts of a layer should read as transparent, not as white */
const CHECKER = {
  backgroundImage:
    "linear-gradient(45deg,#e5e5e5 25%,transparent 25%),linear-gradient(-45deg,#e5e5e5 25%,transparent 25%)," +
    "linear-gradient(45deg,transparent 75%,#e5e5e5 75%),linear-gradient(-45deg,transparent 75%,#e5e5e5 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
}

function describe(layer: Layer): string {
  const name = LABEL[layer.kind] ?? layer.name
  return layer.side ? `${name} (${SIDE[layer.side] ?? layer.side})` : name
}

type Props = {
  mockup: Mockup
  onChanged: (m: Mockup) => void
}

/**
 * The photo taken apart, the way a mockup file in an image editor is built: the fabric, its
 * light, its creases, the print, then whatever lies in front of the print. An admin can see
 * each layer on its own and switch off a part the segmentation got wrong.
 */
export function LayerStack({ mockup, onChanged }: Props) {
  const [layers, setLayers] = useState<Layer[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLayers(await listLayers(mockup.id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được danh sách lớp")
    }
  }, [mockup.id])

  useEffect(() => {
    void load()
  }, [load, mockup.version])

  async function run(task: () => Promise<Mockup>) {
    setBusy(true)
    setError(null)
    try {
      onChanged(await task())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại")
    } finally {
      setBusy(false)
    }
  }

  const covers = layers?.filter((l) => !l.fixed) ?? []
  const off = covers.filter((l) => !l.enabled).length

  return (
    <div className="flex flex-col gap-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ui-fg-subtle text-sm">
          {layers ? `${layers.length} lớp` : "Đang đọc lớp…"}
          {covers.length > 0 && ` · ${covers.length} vật che${off > 0 ? `, ${off} đang tắt` : ""}`}
        </span>
        <Button size="small" variant="secondary" disabled={busy} onClick={() => void run(() => rebuildLayers(mockup.id))}>
          Tách lại bằng Python
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {[...(layers ?? [])].reverse().map((layer) => (
          <div key={layer.name} className="flex flex-col gap-y-1 rounded-lg border p-2">
            <div className="flex items-start justify-between gap-x-2">
              <div className="text-sm font-medium">{describe(layer)}</div>
              {!layer.fixed && (
                <Switch
                  size="small"
                  checked={layer.enabled}
                  disabled={busy}
                  onCheckedChange={(on) => void run(() => setLayerEnabled(mockup.id, layer.name, on))}
                />
              )}
            </div>
            {layer.ready ? (
              <div className="relative overflow-hidden rounded border" style={CHECKER}>
                {/* The photo, barely visible, so a small layer can be placed in the picture */}
                {layer.name !== "photo" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mockupImageUrl(mockup.id, mockup.version)}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-44 w-full object-contain opacity-15"
                  />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mockupLayerUrl(mockup.id, layer.name, mockup.version)}
                  alt={describe(layer)}
                  className="relative h-44 w-full object-contain"
                  style={{ opacity: layer.enabled ? 1 : 0.35 }}
                />
              </div>
            ) : (
              <div className="text-ui-fg-subtle flex h-44 items-center justify-center rounded border text-xs">
                Chưa đặt vùng in
              </div>
            )}
            <div className="text-ui-fg-subtle text-xs">
              {NOTE[layer.kind] ?? (layer.area !== undefined ? `Che ${(layer.area * 100).toFixed(1)}% ảnh` : "")}
            </div>
            {!layer.fixed && !layer.enabled && <Badge size="2xsmall" color="grey">đã tắt</Badge>}
          </div>
        ))}
      </div>

      {layers?.length === 0 && <p className="text-ui-fg-subtle text-sm">Ảnh này chưa được tách lớp.</p>}
      {error && <p className="text-ui-fg-error text-sm">{error}</p>}
    </div>
  )
}
