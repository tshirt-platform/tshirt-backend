import { extractDesignItems } from "../../../src/workflows/steps/extract-design-data"

const garment = {
  size: "L",
  color_name: "Đen",
  color_hex: "#1A1A1A",
  needs_underbase: true,
  supplier_color_code: null,
}

const placement = (side: "front" | "back") => ({
  side,
  print_size_mm: { width: 264, height: 336 },
  artwork_px: { width: 3118, height: 3969 },
  dpi: 300,
  reference: "HPS",
  top_offset_mm: side === "front" ? 130 : 75,
  horizontal_offset_mm: 0,
})

const design = (side: "front" | "back") => ({
  side,
  png_url: `https://s3.example.com/${side}.png`,
  json_url: `https://s3.example.com/${side}.json`,
  preview_url: `https://s3.example.com/${side}.jpg`,
  placement: placement(side),
})

describe("extractDesignItems", () => {
  describe("multi-side designs", () => {
    it("returns one entry per printed side with garment and placement", () => {
      const result = extractDesignItems({
        id: "order_1",
        items: [
          {
            id: "item_1",
            quantity: 2,
            metadata: { designs: [design("front"), design("back")], garment },
          },
        ],
      })

      expect(result.order_id).toBe("order_1")
      expect(result.items).toHaveLength(2)
      expect(result.items[0]).toEqual({
        order_item_id: "item_1",
        side: "front",
        quantity: 2,
        design_png_url: "https://s3.example.com/front.png",
        design_json_url: "https://s3.example.com/front.json",
        preview_url: "https://s3.example.com/front.jpg",
        placement: placement("front"),
        garment,
      })
      expect(result.items[1].side).toBe("back")
      expect(result.items[1].placement?.top_offset_mm).toBe(75)
    })

    it("works without the optional preview, placement and garment", () => {
      const result = extractDesignItems({
        id: "order_1",
        items: [
          {
            id: "item_1",
            metadata: {
              designs: [{ side: "front", png_url: "https://s3/a.png", json_url: "https://s3/a.json" }],
            },
          },
        ],
      })
      expect(result.items[0]).toEqual({
        order_item_id: "item_1",
        side: "front",
        quantity: 1,
        design_png_url: "https://s3/a.png",
        design_json_url: "https://s3/a.json",
      })
    })

    it.each([
      ["a design without a png url", { side: "front", json_url: "https://s3/a.json" }],
      ["a design without a json url", { side: "front", png_url: "https://s3/a.png" }],
      ["an unknown side", { side: "left", png_url: "https://s3/a.png", json_url: "https://s3/a.json" }],
      ["an empty url", { side: "front", png_url: "", json_url: "https://s3/a.json" }],
      ["a non-object entry", "front"],
    ])("rejects %s", (_label, bad) => {
      expect(() =>
        extractDesignItems({ id: "o", items: [{ id: "item_1", metadata: { designs: [bad] } }] })
      ).toThrow("Missing design metadata on order item item_1")
    })
  })

  describe("legacy single-side metadata", () => {
    it("reads the flat url fields", () => {
      const result = extractDesignItems({
        id: "order_123",
        items: [
          {
            id: "item_1",
            metadata: {
              design_png_url: "https://s3.example.com/front.png",
              design_json_url: "https://s3.example.com/front.json",
            },
          },
          {
            id: "item_2",
            metadata: {
              design_png_url: "https://s3.example.com/back.png",
              design_json_url: "https://s3.example.com/back.json",
              design_side: "back",
            },
          },
        ],
      })

      expect(result.items.map((i) => [i.order_item_id, i.side])).toEqual([
        ["item_1", "front"],
        ["item_2", "back"],
      ])
      expect(result.items[0].design_png_url).toBe("https://s3.example.com/front.png")
    })

    it("throws on missing metadata", () => {
      expect(() =>
        extractDesignItems({ id: "order_123", items: [{ id: "item_1", metadata: null }] })
      ).toThrow("Missing design metadata on order item item_1")
    })

    it("throws when either url is missing", () => {
      expect(() =>
        extractDesignItems({
          id: "o",
          items: [{ id: "item_1", metadata: { design_json_url: "https://s3/x.json" } }],
        })
      ).toThrow("Missing design metadata on order item item_1")
      expect(() =>
        extractDesignItems({
          id: "o",
          items: [{ id: "item_1", metadata: { design_png_url: "https://s3/x.png" } }],
        })
      ).toThrow("Missing design metadata on order item item_1")
    })
  })

  it("defaults the quantity to 1 and tolerates an order without items", () => {
    expect(extractDesignItems({ id: "o" }).items).toEqual([])
    const r = extractDesignItems({
      id: "o",
      items: [{ id: "i", quantity: 0, metadata: { designs: [design("front")] } }],
    })
    expect(r.items[0].quantity).toBe(1)
  })
})
