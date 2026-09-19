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

describe("print job statuses", () => {
  it("come from the shared list, including the proof step", () => {
    for (const status of ["pending", "proof_approved", "processing", "shipped", "delivered", "cancelled"]) {
      expect(updatePrintJobSchema.safeParse({ status }).success).toBe(true)
      expect(printOrderQuerySchema.safeParse({ status }).success).toBe(true)
    }
  })

  it("no longer accepts the old shared-only names", () => {
    for (const status of ["printing", "failed"]) {
      expect(updatePrintJobSchema.safeParse({ status }).success).toBe(false)
    }
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
