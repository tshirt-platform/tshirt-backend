import { Readable } from "node:stream"

const storage = { put: jest.fn(), get: jest.fn() }
jest.mock("../../../../src/lib/design-storage/storage", () => ({
  ...jest.requireActual("../../../../src/lib/design-storage/storage"),
  getDesignStorage: () => storage,
}))

import { GET, PUT } from "../../../../src/api/store/designs/[designId]/[side]/[kind]/route"

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)])
const params = { designId: "ece4b0c2-b387", side: "front", kind: "png" }

function makeRes() {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }
}
function makeReq(body: Buffer | null, over: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const stream = Readable.from(body ? [body] : [])
  return Object.assign(stream, { params, headers, ...over })
}

beforeEach(() => {
  storage.put.mockReset().mockResolvedValue("https://files/designs/ece4b0c2-b387/front.png")
  storage.get.mockReset()
  jest.spyOn(console, "error").mockImplementation(() => undefined)
})
afterEach(() => jest.restoreAllMocks())

describe("PUT /store/designs/:designId/:side/:kind", () => {
  it("stores a valid file under a server-built key and returns its URL", async () => {
    const res = makeRes()
    await PUT(makeReq(PNG) as never, res as never)

    expect(storage.put).toHaveBeenCalledWith("designs/ece4b0c2-b387/front.png", PNG, "image/png")
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ url: "https://files/designs/ece4b0c2-b387/front.png" })
  })

  it("ignores the client's Content-Type: the kind decides", async () => {
    await PUT(makeReq(PNG, {}, { "content-type": "text/html" }) as never, makeRes() as never)
    expect(storage.put.mock.calls[0][2]).toBe("image/png")
  })

  it("rejects a bad reference without touching storage", async () => {
    const res = makeRes()
    await PUT(makeReq(PNG, { params: { ...params, designId: "../x" } }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(storage.put).not.toHaveBeenCalled()
  })

  it("rejects bytes that are not the declared type", async () => {
    const res = makeRes()
    await PUT(makeReq(Buffer.from("<html>")) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(storage.put).not.toHaveBeenCalled()
  })

  it("turns an oversized upload away by its declared length", async () => {
    const res = makeRes()
    await PUT(makeReq(PNG, {}, { "content-length": String(41 * 1024 * 1024) }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(413)
    expect(storage.put).not.toHaveBeenCalled()
  })

  it("stops reading a stream that outgrows the limit even when the header lied", async () => {
    const res = makeRes()
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0x20)
    await PUT(makeReq(big, { params: { ...params, kind: "json" } }, { "content-length": "10" }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(413)
  })

  it("answers 502 when the bucket fails, without leaking the reason", async () => {
    storage.put.mockRejectedValue(new Error("secret bucket detail"))
    const res = makeRes()
    await PUT(makeReq(PNG) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(502)
    expect(JSON.stringify(res.json.mock.calls)).not.toContain("secret")
  })
})

describe("GET /store/designs/:designId/:side/:kind", () => {
  it("returns the stored scene", async () => {
    storage.get.mockResolvedValue(Buffer.from('{"objects":[]}'))
    const res = makeRes()
    await GET({ params: { ...params, kind: "json" } } as never, res as never)

    expect(storage.get).toHaveBeenCalledWith("designs/ece4b0c2-b387/front.json")
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/json")
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it("does not serve images or unknown scenes through this route", async () => {
    const res = makeRes()
    await GET({ params } as never, res as never)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(storage.get).not.toHaveBeenCalled()

    storage.get.mockResolvedValue(null)
    const res2 = makeRes()
    await GET({ params: { ...params, kind: "json" } } as never, res2 as never)
    expect(res2.status).toHaveBeenCalledWith(404)
  })
})
