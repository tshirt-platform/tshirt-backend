import { parseOrderRef, sameEmail, toTrackingView, type OrderInput } from "../../../../src/lib/order-tracking/lookup"

describe("parseOrderRef", () => {
  it("reads a full id and the short number, with or without the hash", () => {
    expect(parseOrderRef(" order_01M2W34KH8KSKT3YT8763ZZDT7 ")).toEqual({ id: "order_01M2W34KH8KSKT3YT8763ZZDT7" })
    expect(parseOrderRef("#12")).toEqual({ displayId: 12 })
    expect(parseOrderRef("7")).toEqual({ displayId: 7 })
  })

  it.each(["", "order_", "order_short", "12abc", "#", "-1", "1e3", "1234567890", "order_01M2W34KH8KSKT3YT8763ZZDT7; drop"])(
    "rejects %j",
    (bad) => expect(parseOrderRef(bad)).toBeNull()
  )
})

describe("sameEmail", () => {
  it("ignores case and surrounding spaces", () => {
    expect(sameEmail("Khach@Example.com", " khach@example.com ")).toBe(true)
  })

  it("refuses different or missing emails", () => {
    expect(sameEmail("a@x.com", "b@x.com")).toBe(false)
    expect(sameEmail("a@x.com", "")).toBe(false)
    expect(sameEmail(null, "a@x.com")).toBe(false)
    expect(sameEmail(undefined, undefined)).toBe(false)
  })
})

const order: OrderInput = {
  id: "order_1",
  display_id: 2,
  email: "khach@example.com",
  created_at: "2026-09-19T05:44:56.000Z",
  currency_code: "vnd",
  shipping_total: 35000,
  metadata: { note: "Giao buổi sáng", internal: "secret" },
  items: [
    {
      id: "li_1",
      title: "Tee",
      quantity: 2,
      unit_price: 249000,
      metadata: {
        garment: { color_name: "Kem", size: "L" },
        designs: [
          { side: "front", png_url: "https://f/front.png", json_url: "https://f/front.json", preview_url: "https://f/front.jpg" },
          { side: "back", png_url: "https://f/back.png", json_url: "https://f/back.json" },
          { side: "left", png_url: "x" },
        ],
      },
    },
  ],
  shipping_address: { first_name: "Nguyễn Văn A", last_name: "", phone: "0912345678", address_1: "12 Phố Huế", address_2: "Phường Ba Đình", city: "Hà Nội" },
  payment_collections: [{ status: "authorized", payments: [{ provider_id: "pp_system_default" }] }],
}

describe("toTrackingView", () => {
  const jobs = [{ id: "pj_1", order_item_id: "li_1", side: "front", status: "processing", tracking_number: null }]

  it("reads the quantity from the line detail when the line has none", () => {
    const v = toTrackingView(
      { ...order, items: [{ id: "li_9", title: "Tee", unit_price: 100, detail: { quantity: 3 } }] },
      []
    )
    expect(v.items[0].quantity).toBe(3)
    expect(v.subtotal).toBe(300)
  })

  it("recomputes totals from the lines", () => {
    const v = toTrackingView(order, jobs)
    expect(v).toMatchObject({ subtotal: 498000, shipping_total: 35000, total: 533000 })
  })

  it("shows the customer's designs by preview, falling back to the print image, and skips unknown sides", () => {
    const v = toTrackingView(order, jobs)
    expect(v.items[0].designs).toEqual([
      { side: "front", image_url: "https://f/front.jpg" },
      { side: "back", image_url: "https://f/back.png" },
    ])
    expect(v.items[0].garment).toEqual({ color_name: "Kem", size: "L" })
  })

  it("keeps print-shop material and internal fields out", () => {
    const json = JSON.stringify(toTrackingView(order, [{ ...jobs[0], notes: "internal", design_png_url: "x" } as never]))
    expect(json).not.toContain("json_url")
    expect(json).not.toContain("secret")
    expect(json).not.toContain("internal")
    expect(json).not.toContain("khach@example.com")
  })

  it("describes payment, address, note and jobs", () => {
    const v = toTrackingView(order, jobs)
    expect(v.payment).toEqual({ method: "cod", status: "authorized" })
    expect(v.shipping_address).toEqual({ name: "Nguyễn Văn A", phone: "0912345678", line: "12 Phố Huế", ward: "Phường Ba Đình", province: "Hà Nội" })
    expect(v.note).toBe("Giao buổi sáng")
    expect(v.jobs).toEqual([{ id: "pj_1", order_item_id: "li_1", side: "front", status: "processing", tracking_number: null }])
  })

  it("copes with an order that has no address, payment or items", () => {
    const v = toTrackingView({ id: "o", display_id: 1, created_at: "2026-01-01", currency_code: "vnd" }, [])
    expect(v).toMatchObject({ items: [], total: 0, shipping_address: null, payment: { method: "cod", status: "not_paid" }, note: null })
  })
})
