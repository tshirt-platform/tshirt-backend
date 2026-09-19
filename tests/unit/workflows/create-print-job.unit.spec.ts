import {
  cancelPrintJobs,
  createPrintJobs,
  toPrintJobData,
} from "../../../src/workflows/steps/create-print-job"

const garment = {
  size: "L",
  color_name: "Đen",
  color_hex: "#1A1A1A",
  needs_underbase: true,
  supplier_color_code: "BLK-01",
}

const placement = {
  side: "front" as const,
  print_size_mm: { width: 264, height: 336 },
  artwork_px: { width: 3118, height: 3969 },
  dpi: 300,
  reference: "HPS" as const,
  top_offset_mm: 130,
  horizontal_offset_mm: 0,
}

const item = (side: "front" | "back", extra = {}) => ({
  order_item_id: "item_1",
  side,
  quantity: 2,
  design_png_url: `https://s3.example.com/${side}.png`,
  design_json_url: `https://s3.example.com/${side}.json`,
  ...extra,
})

describe("toPrintJobData", () => {
  it("flattens the garment snapshot and placement into job columns", () => {
    expect(
      toPrintJobData("order_123", item("front", { garment, placement, preview_url: "https://s3.example.com/front.jpg" }))
    ).toEqual({
      order_id: "order_123",
      order_item_id: "item_1",
      side: "front",
      quantity: 2,
      design_png_url: "https://s3.example.com/front.png",
      design_json_url: "https://s3.example.com/front.json",
      preview_url: "https://s3.example.com/front.jpg",
      placement,
      garment_size: "L",
      color_name: "Đen",
      color_hex: "#1A1A1A",
      supplier_color_code: "BLK-01",
      needs_underbase: true,
    })
  })

  it("omits what the line item did not carry", () => {
    const data = toPrintJobData("order_123", item("back"))
    expect(data).not.toHaveProperty("placement")
    expect(data).not.toHaveProperty("garment_size")
    expect(data).not.toHaveProperty("preview_url")
    expect(data.side).toBe("back")
  })
})

describe("createPrintJobs / cancelPrintJobs", () => {
  const createForOrder = jest.fn()
  const cancel = jest.fn()
  const service = { createForOrder, cancel }

  beforeEach(() => jest.clearAllMocks())

  it("creates one job per design and returns their ids in order", async () => {
    createForOrder.mockResolvedValueOnce({ id: "pj_1" }).mockResolvedValueOnce({ id: "pj_2" })

    const result = await createPrintJobs(service, {
      order_id: "order_123",
      items: [item("front"), item("back")],
    })

    expect(result.print_job_ids).toEqual(["pj_1", "pj_2"])
    expect(createForOrder).toHaveBeenCalledTimes(2)
    expect(createForOrder).toHaveBeenNthCalledWith(1, expect.objectContaining({ order_id: "order_123", side: "front" }))
    expect(createForOrder).toHaveBeenNthCalledWith(2, expect.objectContaining({ side: "back" }))
  })

  it("stops at the first failure so the workflow can compensate", async () => {
    createForOrder.mockResolvedValueOnce({ id: "pj_1" }).mockRejectedValueOnce(new Error("db down"))

    await expect(
      createPrintJobs(service, { order_id: "o", items: [item("front"), item("back"), item("front")] })
    ).rejects.toThrow("db down")
    expect(createForOrder).toHaveBeenCalledTimes(2)
  })

  it("compensation cancels every created job", async () => {
    await cancelPrintJobs(service, { print_job_ids: ["pj_1", "pj_2"] })

    expect(cancel).toHaveBeenCalledTimes(2)
    expect(cancel).toHaveBeenCalledWith("pj_1")
    expect(cancel).toHaveBeenCalledWith("pj_2")
  })
})
