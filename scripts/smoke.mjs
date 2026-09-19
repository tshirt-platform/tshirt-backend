#!/usr/bin/env node
/**
 * End-to-end check of the storefront flow against a running backend:
 *   upload a design -> cart -> shipping -> COD checkout -> order lookup -> print job.
 *
 *   BACKEND_URL=http://localhost:9000 PUBLISHABLE_KEY=pk_... node scripts/smoke.mjs
 *
 * It places a real order with the email smoke@example.com, so run it against
 * development or staging only.
 */
const BASE = (process.env.BACKEND_URL ?? "http://localhost:9000").replace(/\/+$/, "")
const KEY = process.env.PUBLISHABLE_KEY
if (!KEY) {
  console.error("Set PUBLISHABLE_KEY to the storefront's publishable API key")
  process.exit(2)
}

const EMAIL = "smoke@example.com"
let failures = 0

const headers = { "x-publishable-api-key": KEY }
const json = { ...headers, "content-type": "application/json" }

async function call(method, path, { body, raw, head = json } = {}) {
  const res = await fetch(`${BASE}${path}`, { method, headers: head, body: raw ?? (body ? JSON.stringify(body) : undefined) })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data }
}

async function step(name, fn) {
  try {
    const detail = await fn()
    console.log(`  ok   ${name}${detail ? ` (${detail})` : ""}`)
  } catch (e) {
    failures += 1
    console.log(`  FAIL ${name}: ${e.message}`)
  }
}

function expect(cond, message) {
  if (!cond) throw new Error(message)
}

// A 1x1 PNG, a scene and a JPEG header: enough to pass the upload checks
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64")
const SCENE = JSON.stringify({ version: "7", objects: [{ type: "textbox", text: "smoke" }] })
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9])

const designId = crypto.randomUUID()
const ctx = {}

console.log(`Smoke test against ${BASE}`)

await step("health", async () => {
  const r = await fetch(`${BASE}/health`)
  expect(r.status === 200, `status ${r.status}`)
})

await step("store rejects a request without the publishable key", async () => {
  const r = await call("GET", "/store/products", { head: {} })
  expect(r.status === 400 || r.status === 401, `status ${r.status}`)
})

await step("list products with prices", async () => {
  const { data: regions } = await call("GET", "/store/regions")
  ctx.region = regions.regions?.[0]?.id
  expect(ctx.region, "no region")
  const r = await call("GET", `/store/products?limit=1&region_id=${ctx.region}&fields=%2Bvariants.calculated_price`)
  expect(r.status === 200 && r.data.products?.length > 0, `status ${r.status}, no products`)
  const variant = r.data.products[0].variants?.[0]
  expect(variant?.id, "product has no variant")
  ctx.variant = variant.id
  return `${r.data.products[0].title}`
})

await step("upload print PNG, scene and preview", async () => {
  const put = (kind, body) => call("PUT", `/store/designs/${designId}/front/${kind}`, { raw: body, head: headers })
  const [png, scene, jpg] = await Promise.all([put("png", PNG), put("json", SCENE), put("jpg", JPEG)])
  for (const [name, r] of [["png", png], ["json", scene], ["jpg", jpg]]) {
    expect(r.status === 201 && r.data.url, `${name}: status ${r.status} ${JSON.stringify(r.data)}`)
  }
  ctx.urls = { png: png.data.url, json: scene.data.url, jpg: jpg.data.url }
})

await step("uploads reject a file that is not what it claims", async () => {
  const r = await call("PUT", `/store/designs/${designId}/front/png`, { raw: "<html>", head: headers })
  expect(r.status === 400, `status ${r.status}`)
})

await step("scene reads back through the backend", async () => {
  const r = await call("GET", `/store/designs/${designId}/front/json`)
  expect(r.status === 200 && r.data.objects?.[0]?.text === "smoke", `status ${r.status}`)
})

await step("stored files are publicly served", async () => {
  const r = await fetch(ctx.urls.png)
  expect(r.status === 200, `${ctx.urls.png} answered ${r.status}`)
})

await step("cart with a designed line item", async () => {
  const cart = await call("POST", "/store/carts", { body: { region_id: ctx.region } })
  expect(cart.status === 200, `create cart: ${cart.status}`)
  ctx.cart = cart.data.cart.id
  const placement = {
    side: "front", print_size_mm: { width: 264, height: 336 }, artwork_px: { width: 3118, height: 3969 },
    dpi: 300, reference: "HPS", top_offset_mm: 50, horizontal_offset_mm: 0,
  }
  const line = await call("POST", `/store/carts/${ctx.cart}/line-items`, {
    body: {
      variant_id: ctx.variant,
      quantity: 2,
      metadata: {
        garment: { size: "L", color_name: "Kem", color_hex: "#E5DCC8", needs_underbase: false, supplier_color_code: null },
        designs: [{ side: "front", png_url: ctx.urls.png, json_url: ctx.urls.json, preview_url: ctx.urls.jpg, placement }],
      },
    },
  })
  expect(line.status === 200, `add line: ${line.status} ${JSON.stringify(line.data)}`)
})

await step("shipping options and COD checkout", async () => {
  const opts = await call("GET", `/store/shipping-options?cart_id=${ctx.cart}`)
  expect(opts.data.shipping_options?.length > 0, "no shipping options")
  const address = { first_name: "Smoke Test", last_name: "", phone: "0912345678", address_1: "1 Test", address_2: "Phường Ba Đình", city: "Hà Nội", country_code: "vn" }
  const upd = await call("POST", `/store/carts/${ctx.cart}`, { body: { email: EMAIL, shipping_address: address, billing_address: address } })
  expect(upd.status === 200, `update cart: ${upd.status}`)
  const ship = await call("POST", `/store/carts/${ctx.cart}/shipping-methods`, { body: { option_id: opts.data.shipping_options[0].id } })
  expect(ship.status === 200, `shipping method: ${ship.status}`)
  const cart = await call("GET", `/store/carts/${ctx.cart}`)
  const pay = await call("POST", "/store/payment-collections", { body: { cart_id: ctx.cart } })
  expect(pay.status === 200, `payment collection: ${pay.status}`)
  const session = await call("POST", `/store/payment-collections/${pay.data.payment_collection.id}/payment-sessions`, { body: { provider_id: "pp_system_default" } })
  expect(session.status === 200, `payment session: ${session.status}`)
  const done = await call("POST", `/store/carts/${ctx.cart}/complete`)
  expect(done.data.type === "order", `complete: ${JSON.stringify(done.data).slice(0, 200)}`)
  ctx.order = done.data.order
  return `order #${ctx.order.display_id}`
})

await step("order lookup with the right email", async () => {
  const r = await call("POST", "/store/order-lookup", { body: { order: `#${ctx.order.display_id}`, email: EMAIL.toUpperCase() } })
  expect(r.status === 200, `status ${r.status}`)
  const o = r.data.order
  expect(o.items[0].quantity === 2, `quantity ${o.items[0].quantity}`)
  expect(o.total === o.subtotal + o.shipping_total && o.subtotal > 0, `totals ${o.subtotal} + ${o.shipping_total} != ${o.total}`)
  expect(o.items[0].designs[0]?.image_url, "design preview missing")
  expect(!JSON.stringify(o).includes("json_url"), "print-shop URLs leaked")
})

await step("order lookup refuses a wrong email or unknown order the same way", async () => {
  const a = await call("POST", "/store/order-lookup", { body: { order: `#${ctx.order.display_id}`, email: "other@example.com" } })
  const b = await call("POST", "/store/order-lookup", { body: { order: "#999999", email: EMAIL } })
  expect(a.status === 404 && b.status === 404, `${a.status} / ${b.status}`)
  expect(a.data.message === b.data.message, "answers differ, so orders can be enumerated")
})

await step("placing the order created a print job (subscriber ran)", async () => {
  let jobs = []
  for (let i = 0; i < 15 && jobs.length === 0; i++) {
    const r = await call("POST", "/store/order-lookup", { body: { order: `#${ctx.order.display_id}`, email: EMAIL } })
    jobs = r.data.order?.jobs ?? []
    if (jobs.length === 0) await new Promise((r) => setTimeout(r, 1000))
  }
  expect(jobs.length === 1, `${jobs.length} jobs`)
  expect(jobs[0].side === "front" && jobs[0].status === "pending", JSON.stringify(jobs[0]))
})

console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
