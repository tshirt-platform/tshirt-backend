describe("extractDesignDataStep", () => {
  function runExtractDesignData(order: {
    id: string
    items: Array<{
      id: string
      metadata: Record<string, unknown> | null
    }>
  }) {
    const items = order.items.map((item) => {
      const meta = item.metadata
      if (!meta?.design_png_url || !meta?.design_json_url) {
        throw new Error(
          `Missing design metadata on order item ${item.id}`
        )
      }
      return {
        design_png_url: meta.design_png_url as string,
        design_json_url: meta.design_json_url as string,
      }
    })

    return { order_id: order.id, items }
  }

  it("extracts design URLs from order item metadata", () => {
    const order = {
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
          },
        },
      ],
    }

    const result = runExtractDesignData(order)

    expect(result.order_id).toBe("order_123")
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual({
      design_png_url: "https://s3.example.com/front.png",
      design_json_url: "https://s3.example.com/front.json",
    })
    expect(result.items[1]).toEqual({
      design_png_url: "https://s3.example.com/back.png",
      design_json_url: "https://s3.example.com/back.json",
    })
  })

  it("throws on missing design metadata", () => {
    const order = {
      id: "order_123",
      items: [
        { id: "item_1", metadata: null },
      ],
    }

    expect(() => runExtractDesignData(order)).toThrow(
      "Missing design metadata on order item item_1"
    )
  })

  it("throws when design_png_url is missing", () => {
    const order = {
      id: "order_123",
      items: [
        {
          id: "item_1",
          metadata: {
            design_json_url: "https://s3.example.com/front.json",
          },
        },
      ],
    }

    expect(() => runExtractDesignData(order)).toThrow(
      "Missing design metadata on order item item_1"
    )
  })

  it("throws when design_json_url is missing", () => {
    const order = {
      id: "order_123",
      items: [
        {
          id: "item_1",
          metadata: {
            design_png_url: "https://s3.example.com/front.png",
          },
        },
      ],
    }

    expect(() => runExtractDesignData(order)).toThrow(
      "Missing design metadata on order item item_1"
    )
  })
})
