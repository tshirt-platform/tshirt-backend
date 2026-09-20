import { useEffect, useMemo, useState } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Button, Container, Heading, Text, toast } from "@medusajs/ui"
import {
  DEFAULT_PRINT_CONFIG_META,
  parsePrintConfig,
  type PrintConfigMeta,
} from "@tshirt-platform/shared"
import { ColorsEditor } from "../components/print-config/ColorsEditor"
import { MockupSide } from "../components/print-config/MockupSide"
import { PrintAreaSummary, printAreaError } from "../components/print-config/PrintAreaSummary"
import { SizeChartEditor } from "../components/print-config/SizeChartEditor"
import { getVisionStatus, listMockups, saveProductPrintConfig, type Mockup, type VisionStatus } from "../lib/api"
import { fitSpec } from "../lib/fit-spec"

function validate(config: PrintConfigMeta): string | null {
  const sizes = config.size_chart.map((r) => r.size.trim().toLowerCase())
  if (sizes.some((s) => s === "") || new Set(sizes).size !== sizes.length) return "Tên size không được trống hoặc trùng"
  if (new Set(config.colors.map((c) => c.name.trim().toLowerCase())).size !== config.colors.length) {
    return "Tên màu không được trống hoặc trùng"
  }
  if (!parsePrintConfig(config)) return "Số đo hoặc mã màu chưa hợp lệ (số phải lớn hơn 0, màu dạng #RRGGBB)"
  return printAreaError(config)
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-y-3 px-6 py-4">
    <Heading level="h3">{title}</Heading>
    {children}
  </div>
)

const PrintConfigWidget = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const stored = useMemo(() => parsePrintConfig(product.metadata?.print_config), [product.metadata])
  const [config, setConfig] = useState<PrintConfigMeta>(() =>
    structuredClone(stored ?? DEFAULT_PRINT_CONFIG_META)
  )
  const [mockups, setMockups] = useState<Mockup[]>([])
  const [vision, setVision] = useState<VisionStatus>({ enabled: false, model: null })
  const [mockupError, setMockupError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getVisionStatus().then(setVision).catch(() => setVision({ enabled: false, model: null }))
    listMockups().then(setMockups).catch(() => setMockupError("Không kết nối được service render (cổng 8001)"))
  }, [])

  const error = validate(config)
  const setMockupsFor = (side: "front" | "back", ids: string[]) =>
    setConfig((c) => ({ ...c, mockups: { ...c.mockups, [side]: ids } }))
  const upsertMockup = (m: Mockup) =>
    setMockups((list) => (list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [m, ...list]))

  async function save() {
    setSaving(true)
    try {
      const mockupsClean = Object.fromEntries(Object.entries(config.mockups ?? {}).filter(([, ids]) => ids && ids.length > 0))
      await saveProductPrintConfig(product.id, {
        ...(product.metadata ?? {}),
        print_config: { ...config, mockups: mockupsClean },
      })
      toast.success("Đã lưu cấu hình in")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không lưu được")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Cấu hình in</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {stored ? "Số đo của sản phẩm này quyết định khung thiết kế và khổ in." : "Sản phẩm chưa có cấu hình, đang hiển thị số đo mặc định."}
          </Text>
        </div>
        <Button size="small" onClick={save} isLoading={saving} disabled={error !== null}>Lưu</Button>
      </div>

      {error && (
        <div className="text-ui-fg-error px-6 py-3 text-sm">{error}</div>
      )}

      <Section title="Số đo áo">
        <SizeChartEditor
          rows={config.size_chart}
          neckFront={config.neck_drop_front_cm}
          neckBack={config.neck_drop_back_cm}
          onRows={(size_chart) => setConfig((c) => ({ ...c, size_chart }))}
          onNeck={(front, back) => setConfig((c) => ({ ...c, neck_drop_front_cm: front, neck_drop_back_cm: back }))}
        />
      </Section>

      <Section title="Khổ in tính được">
        <PrintAreaSummary config={config} />
      </Section>

      <Section title="Màu vải">
        <ColorsEditor colors={config.colors} onChange={(colors) => setConfig((c) => ({ ...c, colors }))} />
      </Section>

      <Section title="Ảnh mockup xem trước">
        {mockupError ? (
          <p className="text-ui-fg-error text-sm">{mockupError}</p>
        ) : (
          <div className="flex flex-col gap-y-4">
            <p className="text-ui-fg-subtle text-sm">
              {vision.enabled
                ? `Tải ảnh lên là xong: AI (${vision.model}) tự tách áo, tìm điểm chuẩn và góc xoay. Bản xem thử bên dưới là kết quả thật; chỉ chỉnh tay khi thấy sai.`
                : "Tải ảnh lên, hệ thống tự đặt vùng in theo mask. Muốn AI tự phân tích cho chính xác hơn: điền VISION_API_KEY và VISION_MODEL vào tshirt-render/.env rồi khởi động lại service render."}
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {(["front", "back"] as const).map((side) => (
                <MockupSide
                  key={side}
                  side={side}
                  ids={config.mockups?.[side] ?? []}
                  mockups={mockups}
                  spec={fitSpec(config, side)}
                  colors={config.colors}
                  aiEnabled={vision.enabled}
                  onIds={(ids) => setMockupsFor(side, ids)}
                  onMockupChanged={upsertMockup}
                />
              ))}
            </div>
          </div>
        )}
      </Section>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: "product.details.after" })

export default PrintConfigWidget
