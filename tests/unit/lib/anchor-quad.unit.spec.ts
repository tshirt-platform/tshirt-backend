import { anchorQuad, type Anchors, type PrintSpec } from "../../../src/admin/lib/anchor-quad"

const SPEC: PrintSpec = { print_width_mm: 264, print_height_mm: 336, top_offset_mm: 130, body_width_mm: 480 }
const LEVEL: Anchors = { hps: [0.5, 0.2], left: [0.25, 0.5], right: [0.75, 0.5] }
const SQUARE = { width: 1000, height: 1000 }

const px = (q: [number, number][], s = SQUARE) => q.map(([x, y]) => [x * (s.width - 1), y * (s.height - 1)])

describe("anchorQuad", () => {
  it("makes the print the same share of the body as in real life", () => {
    const q = px(anchorQuad(LEVEL, SPEC, SQUARE)!)
    expect((q[1][0] - q[0][0]) / (0.5 * 999)).toBeCloseTo(264 / 480, 2)
  })

  it("keeps the print's proportions", () => {
    const q = px(anchorQuad(LEVEL, SPEC, SQUARE)!)
    expect((q[1][0] - q[0][0]) / (q[3][1] - q[0][1])).toBeCloseTo(264 / 336, 2)
  })

  it("hangs the offset below the shoulder point and centres between the edges", () => {
    const q = px(anchorQuad(LEVEL, SPEC, SQUARE)!)
    const pxPerMm = (0.5 * 999) / 480
    expect(q[0][1]).toBeCloseTo(0.5 * 999 - (0.3 * 999 - 130 * pxPerMm), 0)
    expect((q[0][0] + q[1][0]) / 2).toBeCloseTo(0.5 * 999, 0)
  })

  it("tilts the print with the chest line", () => {
    const q = px(anchorQuad({ ...LEVEL, left: [0.25, 0.48], right: [0.75, 0.52] }, SPEC, SQUARE)!)
    const angle = Math.atan2(q[1][1] - q[0][1], q[1][0] - q[0][0])
    expect(angle).toBeCloseTo(Math.atan2(0.04, 0.5), 2)
  })

  it("is not moved by a shoulder point that is off the centre line", () => {
    const a = anchorQuad(LEVEL, SPEC, SQUARE)!
    const b = anchorQuad({ ...LEVEL, hps: [0.6, 0.2] }, SPEC, SQUARE)!
    a.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(b[i][0], 6)
      expect(p[1]).toBeCloseTo(b[i][1], 6)
    })
  })

  it("agrees with the render service on a real photo (the hanging shirt, 1359 x 2000)", () => {
    // What tshirt-render answered for these points: 0.36,0.35 / 0.61,0.36 / 0.60,0.57 / 0.35,0.56
    const q = anchorQuad({ hps: [0.485, 0.27], left: [0.245, 0.605], right: [0.695, 0.62] }, SPEC, { width: 1359, height: 2000 })!
    const expected = [[0.36, 0.35], [0.61, 0.36], [0.6, 0.57], [0.35, 0.56]]
    q.forEach((p, i) => {
      expect(Math.abs(p[0] - expected[i][0])).toBeLessThan(0.006)
      expect(Math.abs(p[1] - expected[i][1])).toBeLessThan(0.006)
    })
  })

  it("refuses left and right the wrong way round", () => {
    expect(anchorQuad({ ...LEVEL, left: LEVEL.right, right: LEVEL.left }, SPEC, SQUARE)).toBeNull()
  })

  it("refuses edges that are almost on top of each other", () => {
    expect(anchorQuad({ ...LEVEL, left: [0.5, 0.5], right: [0.51, 0.5] }, SPEC, SQUARE)).toBeNull()
  })
})
