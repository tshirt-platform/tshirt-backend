import middlewares from "../../../src/api/middlewares"

type Route = { matcher: unknown; methods?: string[]; method?: string[]; bodyParser?: unknown; middlewares?: unknown[] }
const routes = (middlewares as unknown as { routes: Route[] }).routes

describe("api middlewares", () => {
  it("only uses string matchers, which is all this Medusa version's router accepts", () => {
    for (const r of routes) expect(typeof r.matcher).toBe("string")
  })

  it("requires an admin session for print orders and mockups", () => {
    for (const path of ["/admin/print-orders*", "/admin/mockups*"]) {
      const route = routes.find((r) => r.matcher === path)
      expect(route?.middlewares).toHaveLength(1)
    }
  })

  it("leaves upload bodies unparsed so they can be streamed", () => {
    const raw = routes.filter((r) => r.bodyParser === false).map((r) => `${(r.methods ?? r.method)?.join(",")}:${r.matcher}`)
    expect(raw.sort()).toEqual([
      "POST:/admin/mockups",
      "PUT:/admin/mockups/:id/mask",
      "PUT:/admin/mockups/:id/occlusion",
      "PUT:/store/designs/:designId/:side/:kind",
    ])
  })

  it("keeps the JSON parser on the quad route", () => {
    expect(routes.some((r) => String(r.matcher).includes("quad") && r.bodyParser === false)).toBe(false)
  })
})
