import { clientKey, createRateLimiter } from "../../../src/lib/rate-limit"

describe("createRateLimiter", () => {
  it("allows up to the limit, then refuses with the time left", () => {
    let t = 1000
    const limiter = createRateLimiter(3, 60_000, () => t)
    expect([1, 2, 3].map(() => limiter.hit("a").allowed)).toEqual([true, true, true])

    t = 11_000
    expect(limiter.hit("a")).toEqual({ allowed: false, retryAfterSeconds: 50 })
  })

  it("counts each visitor separately and starts a fresh window after it ends", () => {
    let t = 0
    const limiter = createRateLimiter(1, 1000, () => t)
    expect(limiter.hit("a").allowed).toBe(true)
    expect(limiter.hit("b").allowed).toBe(true)
    expect(limiter.hit("a").allowed).toBe(false)
    t = 1000
    expect(limiter.hit("a").allowed).toBe(true)
  })
})

describe("clientKey", () => {
  it("prefers the request address and never returns an empty key", () => {
    expect(clientKey({ ip: "1.2.3.4" })).toBe("1.2.3.4")
    expect(clientKey({ socket: { remoteAddress: "5.6.7.8" } })).toBe("5.6.7.8")
    expect(clientKey({})).toBe("unknown")
  })
})
