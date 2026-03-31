import { printOrderQuerySchema, updatePrintJobSchema } from "../../../../../src/api/admin/print-orders/validators"

describe("printOrderQuerySchema", () => {
  it("accepts valid query params", () => {
    const result = printOrderQuerySchema.parse({
      status: "pending",
      order_id: "order_123",
      offset: "10",
      limit: "50",
    })

    expect(result.status).toBe("pending")
    expect(result.order_id).toBe("order_123")
    expect(result.offset).toBe(10)
    expect(result.limit).toBe(50)
  })

  it("applies defaults for offset and limit", () => {
    const result = printOrderQuerySchema.parse({})

    expect(result.offset).toBe(0)
    expect(result.limit).toBe(20)
    expect(result.status).toBeUndefined()
    expect(result.order_id).toBeUndefined()
  })

  it("rejects invalid status", () => {
    expect(() =>
      printOrderQuerySchema.parse({ status: "invalid_status" })
    ).toThrow()
  })
})

describe("updatePrintJobSchema", () => {
  it("accepts valid status update", () => {
    const result = updatePrintJobSchema.parse({
      status: "processing",
      tracking_number: "VN123456",
      notes: "Started printing",
    })

    expect(result.status).toBe("processing")
    expect(result.tracking_number).toBe("VN123456")
    expect(result.notes).toBe("Started printing")
  })

  it("accepts status only", () => {
    const result = updatePrintJobSchema.parse({ status: "shipped" })

    expect(result.status).toBe("shipped")
    expect(result.tracking_number).toBeUndefined()
    expect(result.notes).toBeUndefined()
  })

  it("rejects invalid status", () => {
    expect(() =>
      updatePrintJobSchema.parse({ status: "unknown" })
    ).toThrow()
  })

  it("rejects missing status", () => {
    expect(() => updatePrintJobSchema.parse({})).toThrow()
  })
})
