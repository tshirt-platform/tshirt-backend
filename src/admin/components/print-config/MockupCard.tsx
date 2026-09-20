import { useState } from "react"
import { Badge, Button } from "@medusajs/ui"
import {
  analyzeMockup,
  clearOcclusion,
  mockupImageUrl,
  placeFromGuess,
  replaceMaskLayer,
  saveCurve,
  saveMaskOutline,
  saveOcclusionOutline,
  type FitSpec,
  type Mockup,
} from "../../lib/api"
import { AnchorEditor } from "./AnchorEditor"
import { CurveControls } from "./CurveControls"
import { OutlineEditor } from "./OutlineEditor"
import { QuadEditor } from "./QuadEditor"
import { SamplePreview } from "./SamplePreview"

type Tool = "anchor" | "quad" | "mask" | "occlusion" | null

type Props = {
  mockup: Mockup
  spec: FitSpec | null
  colors: { name: string; hex: string }[]
  aiEnabled: boolean
  position: number
  total: number
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  onChanged: (m: Mockup) => void
}

/** One preview photo of a side: where the print sits on it and how it is cut out */
export function MockupCard({ mockup, spec, colors, aiEnabled, position, total, onMove, onRemove, onChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>(null)

  async function run(task: () => Promise<Mockup>): Promise<Mockup | null> {
    setBusy(true)
    setError(null)
    try {
      const m = await task()
      onChanged(m)
      return m
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại")
      return null
    } finally {
      setBusy(false)
    }
  }

  async function openEditor() {
    // A fresh photo starts from a print of the right proportions, not a default box
    if (!mockup.quad && spec && !(await run(() => placeFromGuess(mockup.id, spec)))) return
    setTool("quad")
  }

  const coverage = Math.round(mockup.mask_coverage * 100)
  const suspicious = coverage < 5 || coverage > 90

  return (
    <div className="flex flex-col gap-y-2 rounded-lg border p-3">
      <div className="flex items-start gap-x-3">
        <div className="flex flex-col gap-y-1">
          <SamplePreview mockup={mockup} colors={colors} />
          <details className="text-xs">
            <summary className="text-ui-fg-subtle cursor-pointer">Ảnh gốc</summary>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mockupImageUrl(mockup.id, mockup.version)} alt={mockup.name} className="mt-1 h-32 rounded border" />
          </details>
        </div>
        <div className="flex flex-1 flex-col gap-y-1 text-sm">
          <div className="font-medium">{position + 1}. {mockup.name}</div>
          <div className="flex items-center gap-x-2">
            Vùng in:{" "}
            {!mockup.quad ? (
              <Badge color="orange">chưa đặt</Badge>
            ) : mockup.anchors_confirmed === false && mockup.analysis ? (
              <Badge color={mockup.analysis.issues.length > 0 ? "orange" : "blue"}>
                AI đã đặt ({Math.round(mockup.analysis.confidence * 100)}%), cần xem lại
              </Badge>
            ) : mockup.anchors_confirmed === false ? (
              <Badge color="orange">tự đoán, cần kiểm tra</Badge>
            ) : (
              <Badge color="green">đã đặt</Badge>
            )}
          </div>
          {mockup.analysis && mockup.analysis.issues.length > 0 && (
            <ul className="text-ui-fg-error list-disc pl-4">
              {mockup.analysis.issues.map((i) => <li key={i}>{i}</li>)}
            </ul>
          )}
          <div className="text-ui-fg-subtle">Vùng áo nhận diện: {coverage}% ảnh</div>
          <div className="text-ui-fg-subtle">Lớp che (tay, tóc): {mockup.has_occlusion ? "có" : "không"}</div>
          {suspicious && (
            <div className="text-ui-fg-error">Nhận diện áo có vẻ sai. Hãy dùng ảnh nền đơn sắc hoặc tải mask tự vẽ.</div>
          )}
        </div>
        <div className="flex flex-col gap-y-1">
          <Button size="small" variant="secondary" disabled={position === 0} onClick={() => onMove(-1)}>Lên</Button>
          <Button size="small" variant="secondary" disabled={position === total - 1} onClick={() => onMove(1)}>Xuống</Button>
          <Button size="small" variant="danger" onClick={onRemove}>Bỏ</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {aiEnabled && (
          <Button size="small" variant="secondary" disabled={busy || !spec} onClick={() => void run(() => analyzeMockup(mockup.id, spec as FitSpec))}>
            Phân tích lại bằng AI
          </Button>
        )}
        <Button size="small" variant="secondary" disabled={busy || !spec} onClick={() => setTool(tool === "anchor" ? null : "anchor")}>
          Chỉnh tay 3 điểm chuẩn
        </Button>
        <Button size="small" variant="secondary" disabled={busy} onClick={() => (tool === "quad" ? setTool(null) : void openEditor())}>
          Tinh chỉnh 4 góc (phối cảnh)
        </Button>
        <Button size="small" variant="secondary" disabled={busy} onClick={() => setTool(tool === "mask" ? null : "mask")}>
          Khoanh vùng áo
        </Button>
        <Button size="small" variant="secondary" disabled={busy} onClick={() => setTool(tool === "occlusion" ? null : "occlusion")}>
          Khoanh vùng che (tay, tóc)
        </Button>
        {mockup.has_occlusion && (
          <Button size="small" variant="secondary" disabled={busy} onClick={() => void run(() => clearOcclusion(mockup.id))}>
            Bỏ vùng che
          </Button>
        )}
      </div>

      <CurveControls mockup={mockup} disabled={busy} onSave={(wrap, yaw) => void run(() => saveCurve(mockup.id, wrap, yaw))} />

      <details className="text-sm">
        <summary className="text-ui-fg-subtle cursor-pointer">Nâng cao: thay mask hoặc lớp che (ảnh người mẫu)</summary>
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
                  if (file) void run(() => replaceMaskLayer(mockup.id, layer, file))
                }}
              />
            </label>
          ))}
        </div>
      </details>

      {tool === "anchor" && (
        <AnchorEditor
          mockup={mockup}
          spec={spec}
          onSaved={(m) => {
            onChanged(m)
            setTool(null)
          }}
          onClose={() => setTool(null)}
        />
      )}
      {tool === "quad" && (
        <QuadEditor
          mockup={mockup}
          onSaved={(m) => {
            onChanged(m)
            setTool(null)
          }}
          onClose={() => setTool(null)}
        />
      )}
      {tool === "mask" && (
        <OutlineEditor
          mockup={mockup}
          title="Khoanh vùng áo"
          help="Bấm quanh chiếc áo (không gồm móc treo, cổ tay, tóc). Chỉ cần khoanh gần đúng, hệ thống tự bám theo mép áo. Kéo điểm để chỉnh, bấm đúp để xoá điểm."
          showMask
          onSave={(outlines) => saveMaskOutline(mockup.id, outlines)}
          onSaved={(m) => {
            onChanged(m)
            setTool(null)
          }}
          onClose={() => setTool(null)}
        />
      )}
      {tool === "occlusion" && (
        <OutlineEditor
          mockup={mockup}
          title="Khoanh vùng che"
          help="Khoanh những phần nằm phía trước hình in: cánh tay, mái tóc, bàn tay. Hình in sẽ không đè lên các vùng này."
          onSave={(outlines) => saveOcclusionOutline(mockup.id, outlines)}
          onSaved={(m) => {
            onChanged(m)
            setTool(null)
          }}
          onClose={() => setTool(null)}
        />
      )}
      {error && <p className="text-ui-fg-error text-sm">{error}</p>}
    </div>
  )
}
