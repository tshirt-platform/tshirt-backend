const query = { graph: jest.fn() }
const printOrder = { listPrintJobs: jest.fn() }

import { POST } from "../../../../src/api/store/order-lookup/route"

function makeRes() {
  return { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
let n = 0
function makeReq(body: unknown, ip?: string) {
  return {
    body,
    ip: ip ?? `10.0.0.${++n}`,
    scope: { resolve: (k: string) => (k === "query" ? query : printOrder) },
  }
}

const stored = {
  id: "order_01M2W34KH8KSKT3YT8763ZZDT7",
  display_id: 2,
  email: "khach@example.com",
  created_at: "2026-09-19T05:44:56.000Z",
  currency_code: "vnd",
  shipping_total: 35000,
  items: [{ id: "li_1", title: "Tee", quantity: 1, unit_price: 100 }],
}

beforeEach(() => {
  query.graph.mockReset().mockResolvedValue({ data: [stored] })
  printOrder.listPrintJobs.mockReset().mockResolvedValue([{ id: "pj_1", status: "pending", side: "front", order_item_id: "li_1" }])
})

describe("POST /store/order-lookup", () => {
  it("finds an order by its short number and email", async () => {
    const res = makeRes()
    await POST(makeReq({ order: "#2", email: "Khach@Example.com" }) as never, res as never)

    expect(query.graph.mock.calls[0][0].filters).toEqual({ display_id: 2 })
    const { order } = res.json.mock.calls[0][0]
    expect(order).toMatchObject({ id: stored.id, display_id: 2, total: 35100 })
    expect(order.jobs[0]).toMatchObject({ status: "pending" })
  })

  it("finds an order by its full id", async () => {
    await POST(makeReq({ order: stored.id, email: stored.email }) as never, makeRes() as never)
    expect(query.graph.mock.calls[0][0].filters).toEqual({ id: stored.id })
  })

  it("answers a wrong email and an unknown order in the same way", async () => {
    const wrongEmail = makeRes()
    await POST(makeReq({ order: "#2", email: "other@example.com" }) as never, wrongEmail as never)
    query.graph.mockResolvedValue({ data: [] })
    const unknown = makeRes()
    await POST(makeReq({ order: "#999", email: "khach@example.com" }) as never, unknown as never)

    expect(wrongEmail.status).toHaveBeenCalledWith(404)
    expect(unknown.status).toHaveBeenCalledWith(404)
    expect(wrongEmail.json.mock.calls[0][0]).toEqual(unknown.json.mock.calls[0][0])
    expect(printOrder.listPrintJobs).not.toHaveBeenCalled()
  })

  it("rejects malformed input before querying", async () => {
    for (const body of [{}, { order: "abc", email: "a@b.c" }, { order: "#2" }, { order: "#2", email: "x" }, null]) {
      const res = makeRes()
      await POST(makeReq(body) as never, res as never)
      expect(res.status).toHaveBeenCalledWith(400)
    }
    expect(query.graph).not.toHaveBeenCalled()
  })

  it("limits repeated attempts from one address", async () => {
    const codes: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = makeRes()
      await POST(makeReq({ order: "#2", email: "wrong@example.com" }, "9.9.9.9") as never, res as never)
      codes.push(res.status.mock.calls[0][0])
    }
    expect(codes.slice(0, 10).every((c) => c === 404)).toBe(true)
    expect(codes.slice(10)).toEqual([429, 429])
  })
})
