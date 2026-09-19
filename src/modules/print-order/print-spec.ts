import type { DesignSide, PrintPlacement } from "@tshirt-platform/shared"

export const SPEC_VERSION = "1.0"

export type JobForSpec = {
  id: string
  order_id: string
  side?: DesignSide | null
  quantity?: number | null
  garment_size?: string | null
  color_name?: string | null
  color_hex?: string | null
  supplier_color_code?: string | null
  needs_underbase?: boolean | null
  placement?: PrintPlacement | null
  design_png_url: string
  preview_url?: string | null
  notes?: string | null
}

export type PrintSpec = {
  spec_version: string
  order_no: string
  item_no: number
  job_id: string
  garment: {
    size: string | null
    color_name: string | null
    color_hex: string | null
    supplier_color_code: string | null
    quantity: number
  }
  prints: Array<{
    side: DesignSide
    method: "DTG"
    white_underbase: boolean
    artwork_file: string
    artwork_px: { width: number; height: number } | null
    dpi: number | null
    print_size_mm: { width: number; height: number } | null
    placement: {
      reference: "HPS"
      top_offset_mm: number
      horizontal: "center"
      horizontal_offset_mm: number
    } | null
  }>
  proof_file: string | null
  /** Things the print shop must confirm before printing */
  warnings: string[]
}

/** Upper-case letters and digits only: "Xám đậm" -> "XAMDAM", "BLK-01" -> "BLK01" */
export function fileToken(value: string): string {
  return value
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
}

export function colorToken(job: Pick<JobForSpec, "color_name" | "supplier_color_code">): string {
  return fileToken(job.supplier_color_code || job.color_name || "") || "NOCOLOR"
}

export function artworkFileName(orderNo: string, itemNo: number, job: JobForSpec): string {
  const size = fileToken(job.garment_size ?? "") || "NOSIZE"
  const order = fileToken(orderNo) || "ORDER"
  return `${order}-${itemNo}-${size}-${colorToken(job)}-${job.side ?? "front"}.png`
}

export function proofFileName(job: JobForSpec): string {
  return `proof-${job.side ?? "front"}.jpg`
}

export function buildPrintSpec(input: {
  orderNo: string
  itemNo: number
  job: JobForSpec
}): PrintSpec {
  const { orderNo, itemNo, job } = input
  const side = job.side ?? "front"
  const warnings: string[] = []

  if (!job.placement) warnings.push("No print placement recorded: confirm position and size with the customer")
  if (!job.garment_size) warnings.push("No garment size recorded")
  if (!job.color_name) warnings.push("No garment colour recorded")
  if (job.needs_underbase == null) warnings.push("Underbase requirement unknown: treat as required on non-white garments")

  const p = job.placement
  return {
    spec_version: SPEC_VERSION,
    order_no: orderNo,
    item_no: itemNo,
    job_id: job.id,
    garment: {
      size: job.garment_size ?? null,
      color_name: job.color_name ?? null,
      color_hex: job.color_hex ?? null,
      supplier_color_code: job.supplier_color_code ?? null,
      quantity: job.quantity && job.quantity > 0 ? job.quantity : 1,
    },
    prints: [
      {
        side,
        method: "DTG",
        white_underbase: job.needs_underbase === true,
        artwork_file: artworkFileName(orderNo, itemNo, job),
        artwork_px: p ? p.artwork_px : null,
        dpi: p ? p.dpi : null,
        print_size_mm: p ? p.print_size_mm : null,
        placement: p
          ? {
              reference: "HPS",
              top_offset_mm: p.top_offset_mm,
              horizontal: "center",
              horizontal_offset_mm: p.horizontal_offset_mm,
            }
          : null,
      },
    ],
    proof_file: job.preview_url ? proofFileName(job) : null,
    warnings,
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const SIDE_LABEL: Record<DesignSide, string> = { front: "Mặt trước", back: "Mặt sau" }

/** Printable work order; every value is escaped because customers influence them */
export function buildWorkOrderHtml(spec: PrintSpec, notes?: string | null): string {
  const print = spec.prints[0]
  const row = (label: string, value: unknown) =>
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value ?? "—")}</td></tr>`
  const mm = (n?: number) => (n == null ? "—" : `${n} mm`)

  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<title>Phiếu sản xuất ${escapeHtml(spec.order_no)}-${spec.item_no}</title>
<style>
body{font:14px/1.5 system-ui,sans-serif;margin:32px;color:#111}
h1{font-size:20px;margin:0 0 4px}
table{border-collapse:collapse;margin:16px 0;width:100%;max-width:640px}
th,td{border:1px solid #bbb;padding:6px 10px;text-align:left}th{width:220px;background:#f4f4f0}
.warn{background:#fff4d6;border:1px solid #e2b93b;padding:8px 12px;max-width:640px}
</style></head><body>
<h1>Phiếu sản xuất · Đơn ${escapeHtml(spec.order_no)} · Mục ${spec.item_no}</h1>
<div>Mã job: ${escapeHtml(spec.job_id)}</div>
<h2>Áo</h2>
<table>
${row("Số lượng", spec.garment.quantity)}
${row("Size", spec.garment.size)}
${row("Màu", spec.garment.color_name)}
${row("Mã màu nhà cung cấp", spec.garment.supplier_color_code)}
${row("Màu hiển thị (chỉ tham khảo)", spec.garment.color_hex)}
</table>
<h2>In · ${escapeHtml(SIDE_LABEL[print.side])}</h2>
<table>
${row("Phương pháp", print.method)}
${row("Lớp lót trắng", print.white_underbase ? "CÓ" : "Không")}
${row("File in", print.artwork_file)}
${row("Kích thước file", print.artwork_px ? `${print.artwork_px.width} × ${print.artwork_px.height} px @ ${print.dpi} DPI` : null)}
${row("Kích thước in", print.print_size_mm ? `${print.print_size_mm.width} × ${print.print_size_mm.height} mm` : null)}
${row("Vị trí", print.placement ? `Căn giữa ngang; cạnh trên cách điểm cao nhất của vai (HPS) ${mm(print.placement.top_offset_mm)}` : null)}
${row("Ảnh đối chiếu", spec.proof_file)}
</table>
${notes ? `<h2>Ghi chú</h2><p>${escapeHtml(notes)}</p>` : ""}
${spec.warnings.length ? `<div class="warn"><strong>Cần xác nhận trước khi in</strong><ul>${spec.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>` : ""}
</body></html>
`
}

type JobRef = { id: string; order_item_id?: string | null; created_at?: Date | string | null }

/** 1-based position of a job's line item among the order's line items, by creation order */
export function itemNumber(jobs: JobRef[], job: JobRef): number {
  const time = (j: JobRef) => (j.created_at ? new Date(j.created_at).getTime() : 0)
  const ordered = [...jobs].sort((a, b) => time(a) - time(b) || a.id.localeCompare(b.id))
  const items: string[] = []
  for (const j of ordered) {
    const key = j.order_item_id ?? j.id
    if (!items.includes(key)) items.push(key)
  }
  const index = items.indexOf(job.order_item_id ?? job.id)
  return index === -1 ? 1 : index + 1
}
