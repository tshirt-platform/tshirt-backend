import { strFromU8, unzipSync } from "fflate"
import { buildPrintPackage } from "../../../../src/modules/print-order/print-package"
import type { JobForSpec } from "../../../../src/modules/print-order/print-spec"

const job: JobForSpec = {
  id: "pj_1",
  order_id: "order_1",
  side: "back",
  quantity: 1,
  garment_size: "M",
  color_name: "Đen",
  supplier_color_code: null,
  needs_underbase: true,
  placement: {
    side: "back",
    print_size_mm: { width: 264, height: 336 },
    artwork_px: { width: 3118, height: 3969 },
    dpi: 300,
    reference: "HPS",
    top_offset_mm: 75,
    horizontal_offset_mm: 0,
  },
  design_png_url: "https://cdn/x/back.png",
  preview_url: "https://cdn/x/back.jpg",
}

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
const JPG = new Uint8Array([255, 216, 255, 9, 9])

describe("buildPrintPackage", () => {
  it("bundles artwork, proof, spec and work order under the naming standard", async () => {
    const fetchFile = jest.fn(async (url: string) => (url.endsWith(".png") ? PNG : JPG))
    const pkg = await buildPrintPackage({ orderNo: "1001", itemNo: 2, job, fetchFile })

    expect(pkg.fileName).toBe("order_1001-item2-back.zip")
    expect(pkg.warnings).toEqual([])

    const files = unzipSync(pkg.bytes)
    expect(Object.keys(files).sort()).toEqual(
      ["1001-2-M-DEN-back.png", "proof-back.jpg", "spec.json", "workorder.html"].sort()
    )
    expect(Array.from(files["1001-2-M-DEN-back.png"])).toEqual(Array.from(PNG))
    expect(Array.from(files["proof-back.jpg"])).toEqual(Array.from(JPG))

    const spec = JSON.parse(strFromU8(files["spec.json"]))
    expect(spec.prints[0].artwork_file).toBe("1001-2-M-DEN-back.png")
    expect(spec.prints[0].placement.top_offset_mm).toBe(75)
    expect(strFromU8(files["workorder.html"])).toContain("Đơn 1001")
  })

  it("fails when the artwork cannot be fetched", async () => {
    const fetchFile = jest.fn(async () => {
      throw new Error("404")
    })
    await expect(buildPrintPackage({ orderNo: "1", itemNo: 1, job, fetchFile })).rejects.toThrow("404")
  })

  it("still ships the package when only the proof is missing, and says so", async () => {
    const fetchFile = jest.fn(async (url: string) => {
      if (url.endsWith(".jpg")) throw new Error("gone")
      return PNG
    })
    const pkg = await buildPrintPackage({ orderNo: "1", itemNo: 1, job, fetchFile })

    expect(pkg.warnings).toContain("Proof image could not be downloaded")
    const files = unzipSync(pkg.bytes)
    expect(files["proof-back.jpg"]).toBeUndefined()
    expect(JSON.parse(strFromU8(files["spec.json"])).proof_file).toBeNull()
  })

  it("skips the proof entirely when the job has none", async () => {
    const fetchFile = jest.fn(async () => PNG)
    await buildPrintPackage({ orderNo: "1", itemNo: 1, job: { ...job, preview_url: null }, fetchFile })
    expect(fetchFile).toHaveBeenCalledTimes(1)
  })

  it("cannot be tricked into an unsafe download name", async () => {
    const pkg = await buildPrintPackage({ orderNo: '1"; rm -rf', itemNo: 1, job, fetchFile: async () => PNG })
    expect(pkg.fileName).toBe("order_1RMRF-item1-back.zip")
  })
})
