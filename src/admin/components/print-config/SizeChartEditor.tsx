import { Button, Input, Label } from "@medusajs/ui"
import type { SizeChartRow } from "@tshirt-platform/shared"

type Props = {
  rows: SizeChartRow[]
  neckFront: number
  neckBack: number
  onRows: (rows: SizeChartRow[]) => void
  onNeck: (front: number, back: number) => void
}

const NUMERIC = ["shoulder", "chest", "length"] as const
const HEADERS = ["Size", "Vai (cm)", "Vòng ngực (cm)", "Dài (cm)", "Phù hợp", ""]

function num(v: string): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export function SizeChartEditor({ rows, neckFront, neckBack, onRows, onNeck }: Props) {
  const update = (i: number, patch: Partial<SizeChartRow>) =>
    onRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <div className="flex flex-col gap-y-3">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-ui-fg-subtle">
            {HEADERS.map((h) => (
              <th key={h} className="pb-2 pr-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="pb-2 pr-2">
                <Input size="small" value={row.size} onChange={(e) => update(i, { size: e.target.value })} />
              </td>
              {NUMERIC.map((key) => (
                <td key={key} className="pb-2 pr-2">
                  <Input
                    size="small"
                    type="number"
                    value={row[key]}
                    onChange={(e) => update(i, { [key]: num(e.target.value) })}
                  />
                </td>
              ))}
              <td className="pb-2 pr-2">
                <Input size="small" value={row.fit ?? ""} onChange={(e) => update(i, { fit: e.target.value })} />
              </td>
              <td className="pb-2">
                <Button size="small" variant="secondary" disabled={rows.length <= 1} onClick={() => onRows(rows.filter((_, j) => j !== i))}>
                  Xoá
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <Button size="small" variant="secondary" onClick={() => onRows([...rows, { size: "", shoulder: 0, chest: 0, length: 0 }])}>
          Thêm size
        </Button>
      </div>

      <div className="grid max-w-md grid-cols-2 gap-4">
        <div className="flex flex-col gap-y-1">
          <Label size="small">Độ sâu cổ trước (cm)</Label>
          <Input size="small" type="number" value={neckFront} onChange={(e) => onNeck(num(e.target.value), neckBack)} />
        </div>
        <div className="flex flex-col gap-y-1">
          <Label size="small">Độ sâu cổ sau (cm)</Label>
          <Input size="small" type="number" value={neckBack} onChange={(e) => onNeck(neckFront, num(e.target.value))} />
        </div>
      </div>
    </div>
  )
}
