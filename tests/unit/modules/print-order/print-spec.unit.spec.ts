import {
  artworkFileName,
  buildPrintSpec,
  buildWorkOrderHtml,
  colorToken,
  escapeHtml,
  fileToken,
  itemNumber,
  type JobForSpec,
} from "../../../../src/modules/print-order/print-spec"

const placement = {
  side: "front" as const,
  print_size_mm: { width: 264, height: 336 },
  artwork_px: { width: 3118, height: 3969 },
  dpi: 300,
  reference: "HPS" as const,
  top_offset_mm: 130,
  horizontal_offset_mm: 0,
}

const job: JobForSpec = {
  id: "pj_1",
  order_id: "order_1",
  side: "front",
  quantity: 2,
  garment_size: "L",
  color_name: "Đen",
  color_hex: "#1A1A1A",
  supplier_color_code: "BLK-01",
  needs_underbase: true,
  placement,
  design_png_url: "https://s3/x/front.png",
  preview_url: "https://s3/x/front.jpg",
}

describe("fileToken", () => {
  it.each([
    ["Xám đậm", "XAMDAM"],
    ["BLK-01", "BLK01"],
    ["Đỏ", "DO"],
    ["  Xanh dương ", "XANHDUONG"],
    ["../../etc", "ETC"],
    ["", ""],
  ])("%j -> %j", (input, expected) => expect(fileToken(input)).toBe(expected))
})

describe("naming standard", () => {
  it("builds {order}-{item}-{size}-{colour}-{side}.png", () => {
    expect(artworkFileName("1001", 1, job)).toBe("1001-1-L-BLK01-front.png")
    expect(artworkFileName("1001", 2, { ...job, side: "back", garment_size: "XXL" })).toBe("1001-2-XXL-BLK01-back.png")
  })

  it("falls back to the colour name, then to a placeholder", () => {
    expect(colorToken({ color_name: "Xám đậm", supplier_color_code: null })).toBe("XAMDAM")
    expect(colorToken({ color_name: null, supplier_color_code: null })).toBe("NOCOLOR")
  })

  it("never lets an order number or size escape the file name", () => {
    const name = artworkFileName("../../evil", 1, { ...job, garment_size: "L/../x" })
    expect(name).toBe("EVIL-1-LX-BLK01-front.png")
    expect(name).not.toMatch(/[/\\.]{2}/)
  })
})

describe("buildPrintSpec", () => {
  it("describes the garment, the print and where it goes", () => {
    const spec = buildPrintSpec({ orderNo: "1001", itemNo: 1, job })
    expect(spec).toEqual({
      spec_version: "1.0",
      order_no: "1001",
      item_no: 1,
      job_id: "pj_1",
      garment: { size: "L", color_name: "Đen", color_hex: "#1A1A1A", supplier_color_code: "BLK-01", quantity: 2 },
      prints: [
        {
          side: "front",
          method: "DTG",
          white_underbase: true,
          artwork_file: "1001-1-L-BLK01-front.png",
          artwork_px: { width: 3118, height: 3969 },
          dpi: 300,
          print_size_mm: { width: 264, height: 336 },
          placement: { reference: "HPS", top_offset_mm: 130, horizontal: "center", horizontal_offset_mm: 0 },
        },
      ],
      proof_file: "proof-front.jpg",
      warnings: [],
    })
  })

  it("flags a legacy job that has no placement or garment data", () => {
    const spec = buildPrintSpec({
      orderNo: "1001",
      itemNo: 1,
      job: { id: "pj_9", order_id: "o", design_png_url: "https://s3/a.png" },
    })
    expect(spec.prints[0].placement).toBeNull()
    expect(spec.prints[0].print_size_mm).toBeNull()
    expect(spec.proof_file).toBeNull()
    expect(spec.warnings).toHaveLength(4)
    expect(spec.garment.quantity).toBe(1)
  })

  it("only asks for an underbase when the job says so", () => {
    expect(buildPrintSpec({ orderNo: "1", itemNo: 1, job: { ...job, needs_underbase: false } }).prints[0].white_underbase).toBe(false)
    expect(buildPrintSpec({ orderNo: "1", itemNo: 1, job: { ...job, needs_underbase: null } }).prints[0].white_underbase).toBe(false)
  })
})

describe("escapeHtml", () => {
  it("neutralises markup", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;"
    )
    expect(escapeHtml(null)).toBe("")
  })
})

describe("buildWorkOrderHtml", () => {
  it("shows the facts a printer needs", () => {
    const html = buildWorkOrderHtml(buildPrintSpec({ orderNo: "1001", itemNo: 1, job }))
    expect(html).toContain("Đơn 1001")
    expect(html).toContain("264 × 336 mm")
    expect(html).toContain("3118 × 3969 px @ 300 DPI")
    expect(html).toContain("130 mm")
    expect(html).toContain("CÓ")
    expect(html).toContain("1001-1-L-BLK01-front.png")
  })

  it("escapes customer-controlled values", () => {
    const spec = buildPrintSpec({
      orderNo: "1001",
      itemNo: 1,
      job: { ...job, color_name: `<img src=x onerror=alert(1)>`, supplier_color_code: null },
    })
    const html = buildWorkOrderHtml(spec, `<script>steal()</script>`)
    expect(html).not.toContain("<img src=x")
    expect(html).not.toContain("<script>steal")
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
  })

  it("lists what must be confirmed", () => {
    const html = buildWorkOrderHtml(
      buildPrintSpec({ orderNo: "1", itemNo: 1, job: { id: "p", order_id: "o", design_png_url: "u" } })
    )
    expect(html).toContain("Cần xác nhận trước khi in")
    expect(html).toContain("No print placement recorded")
  })
})

describe("itemNumber", () => {
  const at = (id: string, item: string | null, t: string) => ({ id, order_item_id: item, created_at: t })

  it("numbers line items in creation order, sharing a number across sides", () => {
    const jobs = [
      at("pj_3", "item_b", "2026-01-01T00:00:02Z"),
      at("pj_1", "item_a", "2026-01-01T00:00:00Z"),
      at("pj_2", "item_a", "2026-01-01T00:00:01Z"),
    ]
    expect(itemNumber(jobs, jobs[1])).toBe(1)
    expect(itemNumber(jobs, jobs[2])).toBe(1)
    expect(itemNumber(jobs, jobs[0])).toBe(2)
  })

  it("treats legacy jobs without an item id as their own line", () => {
    const jobs = [at("pj_1", null, "2026-01-01T00:00:00Z"), at("pj_2", null, "2026-01-01T00:00:01Z")]
    expect(itemNumber(jobs, jobs[1])).toBe(2)
  })
})
