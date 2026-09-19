import { designKey, parseDesignFileRef } from "../../../../src/lib/design-storage/keys"
import { checkDesignFile } from "../../../../src/lib/design-storage/validate"

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)])
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])

describe("parseDesignFileRef", () => {
  it("accepts a well-formed reference and builds a fixed-shape key", () => {
    const ref = parseDesignFileRef({ designId: "ece4b0c2-b387-40c5", side: "front", kind: "png" })
    expect(ref).toEqual({ designId: "ece4b0c2-b387-40c5", side: "front", kind: "png" })
    expect(designKey(ref!)).toBe("designs/ece4b0c2-b387-40c5/front.png")
  })

  it.each([
    [{ designId: "../../etc/passwd", side: "front", kind: "png" }],
    [{ designId: "short", side: "front", kind: "png" }],
    [{ designId: "ece4b0c2-b387", side: "left", kind: "png" }],
    [{ designId: "ece4b0c2-b387", side: "front", kind: "exe" }],
    [{ designId: "ece4b0c2-b387", side: "front", kind: "constructor" }],
    [{ designId: "ece4b0c2-b387", side: "front" }],
    [{ designId: ["a"], side: "front", kind: "png" }],
  ])("rejects %j", (params) => {
    expect(parseDesignFileRef(params)).toBeNull()
  })
})

describe("checkDesignFile", () => {
  it("accepts files that match their declared kind", () => {
    expect(checkDesignFile("png", PNG)).toBeNull()
    expect(checkDesignFile("jpg", JPG)).toBeNull()
    expect(checkDesignFile("json", Buffer.from('{"objects":[]}'))).toBeNull()
  })

  it("rejects a file of another type under the wrong kind", () => {
    expect(checkDesignFile("png", JPG)).toMatch(/PNG/)
    expect(checkDesignFile("jpg", PNG)).toMatch(/JPEG/)
    expect(checkDesignFile("png", Buffer.from("<script>alert(1)</script>"))).toMatch(/PNG/)
  })

  it("rejects empty files and scenes that are not objects", () => {
    expect(checkDesignFile("png", Buffer.alloc(0))).toMatch(/Empty/)
    expect(checkDesignFile("json", Buffer.from("not json"))).toMatch(/valid JSON/)
    expect(checkDesignFile("json", Buffer.from("[1,2]"))).toMatch(/object/)
    expect(checkDesignFile("json", Buffer.from("null"))).toMatch(/object/)
  })
})
