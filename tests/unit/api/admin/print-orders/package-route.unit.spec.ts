import { GET } from "../../../../../src/api/admin/print-orders/[id]/package/route"

const PNG = new Uint8Array([137, 80, 78, 71, 1])

const job = {
  id: "pj_1",
  order_id: "order_1",
  order_item_id: "item_a",
  side: "front",
  quantity: 1,
  garment_size: "L",
  color_name: "Đen",
  needs_underbase: true,
  design_png_url: "http://localhost:3000/api/files/designs/abc/front.png",
  preview_url: null,
  created_at: "2026-01-01T00:00:00Z",
}

function setup(over: { retrieve?: jest.Mock; displayId?: number | null } = {}) {
  const service = {
    retrievePrintJob: over.retrieve ?? jest.fn().mockResolvedValue(job),
    getByOrderId: jest.fn().mockResolvedValue([job]),
  }
  const query = {
    graph: jest.fn().mockResolvedValue({ data: over.displayId === null ? [] : [{ display_id: over.displayId ?? 1001 }] }),
  }
  const req = {
    params: { id: "pj_1" },
    scope: { resolve: jest.fn((name: string) => (name === "printOrder" ? service : query)) },
  }
  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }
  return { req, res, service, query }
}

describe("GET /admin/print-orders/:id/package", () => {
  const realFetch = global.fetch
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(new Response(PNG, { status: 200 })) as unknown as typeof fetch
  })
  afterAll(() => {
    global.fetch = realFetch
  })

  it("streams a zip named after the order", async () => {
    const { req, res } = setup()
    await GET(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/zip")
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="order_1001-item1-front.zip"')
    expect(Buffer.isBuffer(res.send.mock.calls[0][0])).toBe(true)
  })

  it("falls back to the order id when the order number cannot be read", async () => {
    const { req, res } = setup({ displayId: null })
    await GET(req as never, res as never)
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringContaining("order_ORDER1-item1-front.zip"))
  })

  it("returns 404 for an unknown job", async () => {
    const { req, res } = setup({ retrieve: jest.fn().mockRejectedValue(new Error("not found")) })
    await GET(req as never, res as never)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.send).not.toHaveBeenCalled()
  })

  it("refuses to fetch artwork from a disallowed origin", async () => {
    const evil = { ...job, design_png_url: "http://169.254.169.254/latest/meta-data" }
    const { req, res } = setup({ retrieve: jest.fn().mockResolvedValue(evil) })
    await GET(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(422)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("reports a failed download as a bad gateway", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("x", { status: 500 })) as unknown as typeof fetch
    const { req, res } = setup()
    await GET(req as never, res as never)
    expect(res.status).toHaveBeenCalledWith(502)
  })
})
