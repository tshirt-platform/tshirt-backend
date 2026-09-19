import { Readable } from "node:stream"
import { forward, isValidTemplateId, templateRoute } from "../../../../src/api/admin/mockups/proxy"

const fetchMock = jest.fn()
const realFetch = global.fetch

function makeRes() {
  return {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  }
}

function makeReq(over: Record<string, unknown> = {}) {
  return { params: {}, headers: {}, body: undefined, ...over }
}

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
  delete process.env.RENDER_API_KEY
  delete process.env.RENDER_SERVICE_URL
})
afterAll(() => {
  global.fetch = realFetch
})

describe("isValidTemplateId", () => {
  it("accepts only the service's 12 hex characters", () => {
    expect(isValidTemplateId("2ea1b397cc73")).toBe(true)
    for (const bad of ["", "2EA1B397CC73", "2ea1b397cc7", "../../etc/pass", "2ea1b397cc73/x", null, undefined, 12]) {
      expect(isValidTemplateId(bad)).toBe(false)
    }
  })
})

describe("forward", () => {
  it("relays the upstream status, type and body", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: "a" }]), { status: 200, headers: { "content-type": "application/json" } })
    )
    const res = makeRes()
    await forward(makeReq() as never, res as never, "/templates", "GET")

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8001/templates")
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/json")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(String(res.send.mock.calls[0][0])).toContain('"id":"a"')
  })

  it("uses the configured service url and API key", async () => {
    process.env.RENDER_SERVICE_URL = "http://render:8001/"
    process.env.RENDER_API_KEY = "secret"
    fetchMock.mockResolvedValue(new Response("ok"))
    await forward(makeReq() as never, makeRes() as never, "/templates", "GET")

    expect(fetchMock.mock.calls[0][0]).toBe("http://render:8001/templates")
    expect(fetchMock.mock.calls[0][1].headers["X-Api-Key"]).toBe("secret")
  })

  it("passes a parsed JSON body along", async () => {
    fetchMock.mockResolvedValue(new Response("{}"))
    await forward(makeReq({ body: { points: [[0, 0]] } }) as never, makeRes() as never, "/x", "PUT", "json")

    const init = fetchMock.mock.calls[0][1]
    expect(init.headers["Content-Type"]).toBe("application/json")
    expect(init.body).toBe('{"points":[[0,0]]}')
  })

  it("streams a multipart upload without buffering it", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 201 }))
    const req = Object.assign(Readable.from([Buffer.from("part")]), {
      params: {},
      headers: { "content-type": "multipart/form-data; boundary=abc", "content-length": "1000" },
    })
    const res = makeRes()
    await forward(req as never, res as never, "/templates", "POST", "raw")

    const init = fetchMock.mock.calls[0][1]
    expect(init.duplex).toBe("half")
    expect(init.headers["Content-Type"]).toBe("multipart/form-data; boundary=abc")
    expect(init.body).toBeDefined()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it("refuses uploads that are too big or not multipart", async () => {
    const big = makeRes()
    await forward(
      makeReq({ headers: { "content-type": "multipart/form-data; boundary=a", "content-length": String(31 * 1024 * 1024) } }) as never,
      big as never, "/templates", "POST", "raw"
    )
    expect(big.status).toHaveBeenCalledWith(413)

    const wrong = makeRes()
    await forward(makeReq({ headers: { "content-type": "application/json" } }) as never, wrong as never, "/templates", "POST", "raw")
    expect(wrong.status).toHaveBeenCalledWith(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("reports an unreachable service as 502", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    const res = makeRes()
    await forward(makeReq() as never, res as never, "/templates", "GET")
    expect(res.status).toHaveBeenCalledWith(502)
  })
})

describe("templateRoute", () => {
  it("builds the upstream path from a valid id", async () => {
    fetchMock.mockResolvedValue(new Response("{}"))
    await templateRoute("/quad", "PUT", "json")(makeReq({ params: { id: "2ea1b397cc73" } }) as never, makeRes() as never)
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8001/templates/2ea1b397cc73/quad")
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT")
  })

  it("never forwards an id that could rewrite the path", async () => {
    const res = makeRes()
    await templateRoute("", "DELETE")(makeReq({ params: { id: "../../health" } }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
