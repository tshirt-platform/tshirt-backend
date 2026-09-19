import {
  allowedFileOrigins,
  fetchDesignFile,
  isAllowedFileUrl,
  DisallowedFileUrlError,
} from "../../../../src/modules/print-order/file-fetch"

const ORIGINS = ["https://cdn.example.com", "http://localhost:3000"]

describe("isAllowedFileUrl", () => {
  it("accepts files on an allowed origin", () => {
    expect(isAllowedFileUrl("https://cdn.example.com/designs/x/front.png", ORIGINS)).toBe(true)
    expect(isAllowedFileUrl("http://localhost:3000/api/files/designs/x/front.png", ORIGINS)).toBe(true)
  })

  it.each([
    ["an internal metadata service", "http://169.254.169.254/latest/meta-data"],
    ["a private host", "http://10.0.0.5/secret.png"],
    ["another port on an allowed host", "http://localhost:9000/admin"],
    ["a look-alike host", "https://cdn.example.com.evil.io/a.png"],
    ["a userinfo trick", "https://cdn.example.com@evil.io/a.png"],
    ["credentials in the url", "https://user:pw@cdn.example.com/a.png"],
    ["a non-http scheme", "file:///etc/passwd"],
    ["a scheme change", "ftp://cdn.example.com/a.png"],
    ["garbage", "not a url"],
    ["an empty string", ""],
  ])("rejects %s", (_label, url) => {
    expect(isAllowedFileUrl(url, ORIGINS)).toBe(false)
  })

  it("rejects everything when no origin is allowed", () => {
    expect(isAllowedFileUrl("https://cdn.example.com/a.png", [])).toBe(false)
  })
})

describe("allowedFileOrigins", () => {
  const env = process.env.NODE_ENV

  afterEach(() => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = env
  })

  it("reads a comma separated list and normalises it to origins", () => {
    expect(allowedFileOrigins("https://cdn.example.com/designs, http://localhost:3000/")).toEqual([
      "https://cdn.example.com",
      "http://localhost:3000",
    ])
  })

  it("defaults to the local store in development and to nothing in production", () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = "development"
    expect(allowedFileOrigins("")).toEqual(["http://localhost:3000"])
    ;(process.env as Record<string, string | undefined>).NODE_ENV = "production"
    expect(allowedFileOrigins("")).toEqual([])
  })
})

describe("fetchDesignFile", () => {
  const fetchMock = jest.fn()
  const realFetch = global.fetch

  beforeEach(() => {
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })
  afterAll(() => {
    global.fetch = realFetch
  })

  it("downloads an allowed file", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    const bytes = await fetchDesignFile("https://cdn.example.com/a.png", ORIGINS)
    expect(Array.from(bytes)).toEqual([1, 2, 3])
    expect(fetchMock.mock.calls[0][1].redirect).toBe("manual")
  })

  it("never calls out for a disallowed url", async () => {
    await expect(fetchDesignFile("http://169.254.169.254/x", ORIGINS)).rejects.toBeInstanceOf(DisallowedFileUrlError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("treats an upstream error or a redirect as a failure", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 404 }))
    await expect(fetchDesignFile("https://cdn.example.com/a.png", ORIGINS)).rejects.toThrow("404")
    fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://evil" } }))
    await expect(fetchDesignFile("https://cdn.example.com/a.png", ORIGINS)).rejects.toThrow("302")
  })

  it("refuses a file that declares itself too large", async () => {
    fetchMock.mockResolvedValue(new Response("x", { status: 200, headers: { "content-length": String(200 * 1024 * 1024) } }))
    await expect(fetchDesignFile("https://cdn.example.com/a.png", ORIGINS)).rejects.toThrow("too large")
  })
})
