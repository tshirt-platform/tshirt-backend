import { createHash, timingSafeEqual } from "node:crypto"

export type OrderRef = { id: string } | { displayId: number }

/** Accepts the full order id, or the short number shown to customers ("#12" or "12") */
export function parseOrderRef(input: string): OrderRef | null {
  const text = input.trim()
  if (/^order_[0-9A-Za-z]{10,40}$/.test(text)) return { id: text }
  const short = /^#?(\d{1,9})$/.exec(text)
  return short ? { displayId: Number(short[1]) } : null
}

const digest = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest()

/** Compares emails without stopping at the first differing character */
export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return timingSafeEqual(digest(a), digest(b))
}

interface OrderItemInput {
  id: string
  title: string
  quantity?: number
  detail?: { quantity?: number } | null
  unit_price: number
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
}

export interface OrderInput {
  id: string
  display_id: number
  email?: string | null
  created_at: string | Date
  currency_code: string
  shipping_total?: number | null
  items?: OrderItemInput[] | null
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
  } | null
  payment_collections?: { status?: string | null; payments?: { provider_id?: string | null }[] | null }[] | null
  metadata?: Record<string, unknown> | null
}

export interface JobInput {
  id: string
  order_item_id?: string | null
  side?: string | null
  status: string
  tracking_number?: string | null
}

function designsOf(metadata: OrderItemInput["metadata"]) {
  const list = metadata && Array.isArray(metadata.designs) ? (metadata.designs as Record<string, unknown>[]) : []
  return list
    .filter((d) => (d.side === "front" || d.side === "back") && typeof d.png_url === "string")
    .map((d) => ({
      side: d.side as "front" | "back",
      image_url: typeof d.preview_url === "string" ? d.preview_url : (d.png_url as string),
    }))
}

/**
 * What a customer may see of an order they proved they own. Notes and design files
 * meant for the print shop stay out; totals are recomputed from the lines because the
 * order query does not sum them.
 */
export function toTrackingView(order: OrderInput, jobs: JobInput[]) {
  const items = (order.items ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    quantity: i.quantity ?? i.detail?.quantity ?? 0,
    unit_price: i.unit_price,
    thumbnail: i.thumbnail ?? null,
    designs: designsOf(i.metadata),
    garment: (i.metadata?.garment as Record<string, unknown> | undefined) ?? null,
  }))
  const subtotal = items.reduce((n, i) => n + i.unit_price * i.quantity, 0)
  const shipping = order.shipping_total ?? 0
  const address = order.shipping_address
  const collection = order.payment_collections?.[0]
  const provider = collection?.payments?.[0]?.provider_id

  return {
    id: order.id,
    display_id: order.display_id,
    created_at: new Date(order.created_at).toISOString(),
    currency_code: order.currency_code,
    items,
    subtotal,
    shipping_total: shipping,
    total: subtotal + shipping,
    shipping_address: address
      ? {
          name: [address.first_name, address.last_name].filter(Boolean).join(" "),
          phone: address.phone ?? "",
          line: address.address_1 ?? "",
          ward: address.address_2 ?? "",
          province: address.city ?? "",
        }
      : null,
    payment: {
      method: !provider || provider === "pp_system_default" ? "cod" : provider,
      status: collection?.status ?? "not_paid",
    },
    note: typeof order.metadata?.note === "string" ? order.metadata.note : null,
    jobs: jobs.map((j) => ({
      id: j.id,
      order_item_id: j.order_item_id ?? null,
      side: j.side ?? null,
      status: j.status,
      tracking_number: j.tracking_number ?? null,
    })),
  }
}
