import { Button, Input, Switch } from "@medusajs/ui"
import type { GarmentColor } from "@tshirt-platform/shared"

type Props = {
  colors: GarmentColor[]
  onChange: (colors: GarmentColor[]) => void
}

const HEADERS = ["Tên màu", "Màu hiển thị", "Vải tối", "Cần lót trắng", "Mã NCC (Pantone TCX)", ""]

export function ColorsEditor({ colors, onChange }: Props) {
  const update = (i: number, patch: Partial<GarmentColor>) =>
    onChange(colors.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  return (
    <div className="flex flex-col gap-y-3">
      <p className="text-ui-fg-subtle text-sm">
        Màu hiển thị chỉ để xem trên màn hình. Mã nhà cung cấp mới là thứ dùng để đặt vải và gửi cho xưởng in.
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-ui-fg-subtle">
            {HEADERS.map((h) => (
              <th key={h} className="pb-2 pr-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {colors.map((c, i) => (
            <tr key={i}>
              <td className="pb-2 pr-2">
                <Input size="small" value={c.name} onChange={(e) => update(i, { name: e.target.value })} />
              </td>
              <td className="pb-2 pr-2">
                <div className="flex items-center gap-x-2">
                  <input
                    type="color"
                    aria-label={`Màu ${c.name}`}
                    value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#000000"}
                    onChange={(e) => update(i, { hex: e.target.value.toUpperCase() })}
                    className="size-8 cursor-pointer rounded border"
                  />
                  <Input size="small" className="w-24" value={c.hex} onChange={(e) => update(i, { hex: e.target.value })} />
                </div>
              </td>
              <td className="pb-2 pr-2">
                <Switch checked={c.is_dark} onCheckedChange={(v) => update(i, { is_dark: v })} />
              </td>
              <td className="pb-2 pr-2">
                <Switch checked={c.needs_underbase} onCheckedChange={(v) => update(i, { needs_underbase: v })} />
              </td>
              <td className="pb-2 pr-2">
                <Input
                  size="small"
                  value={c.supplier_code ?? ""}
                  onChange={(e) => update(i, { supplier_code: e.target.value || null })}
                />
              </td>
              <td className="pb-2">
                <Button size="small" variant="secondary" disabled={colors.length <= 1} onClick={() => onChange(colors.filter((_, j) => j !== i))}>
                  Xoá
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <Button
          size="small"
          variant="secondary"
          onClick={() => onChange([...colors, { name: "", hex: "#FFFFFF", is_dark: false, needs_underbase: true }])}
        >
          Thêm màu
        </Button>
      </div>
    </div>
  )
}
