import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import {
  LocalDesignStorage,
  S3DesignStorage,
  createDesignStorage,
} from "../../../../src/lib/design-storage/storage"

describe("S3DesignStorage", () => {
  const base = { bucket: "tshirt-store", region: "auto" }

  it("uploads with the given key and type, then returns the public URL", async () => {
    const send = jest.fn().mockResolvedValue({})
    const storage = new S3DesignStorage({ ...base, publicUrl: "https://pub-x.r2.dev/" }, { send } as never)

    const url = await storage.put("designs/abc12345/front.png", Buffer.from("x"), "image/png")

    expect(url).toBe("https://pub-x.r2.dev/designs/abc12345/front.png")
    const command = send.mock.calls[0][0] as PutObjectCommand
    expect(command.input).toMatchObject({
      Bucket: "tshirt-store",
      Key: "designs/abc12345/front.png",
      ContentType: "image/png",
    })
  })

  it("falls back to the AWS URL shape only when there is no custom endpoint", () => {
    const storage = new S3DesignStorage({ bucket: "b", region: "ap-southeast-1" }, { send: jest.fn() } as never)
    return expect(storage.put("designs/k/front.png", Buffer.from("x"), "image/png")).resolves.toBe(
      "https://b.s3.ap-southeast-1.amazonaws.com/designs/k/front.png"
    )
  })

  it("refuses a custom endpoint without a public URL rather than guess one", () => {
    expect(() => new S3DesignStorage({ ...base, endpoint: "https://a.r2.cloudflarestorage.com" })).toThrow(
      /S3_PUBLIC_URL/
    )
  })

  it("configures the client for R2: endpoint set, default checksums off", async () => {
    const storage = new S3DesignStorage({
      ...base,
      endpoint: "https://a.r2.cloudflarestorage.com",
      publicUrl: "https://pub-x.r2.dev",
      accessKeyId: "k",
      secretAccessKey: "s",
    })
    const client = (storage as unknown as { client: { config: Record<string, () => Promise<unknown>> } }).client
    expect(String(((await client.config.endpoint()) as { hostname: string }).hostname)).toBe(
      "a.r2.cloudflarestorage.com"
    )
    expect(await client.config.requestChecksumCalculation()).toBe("WHEN_REQUIRED")
  })

  it("reads bytes back and treats a missing object as null", async () => {
    const body = { transformToByteArray: async () => new Uint8Array([104, 105]) }
    const send = jest
      .fn()
      .mockResolvedValueOnce({ Body: body })
      .mockRejectedValueOnce(Object.assign(new Error("gone"), { name: "NoSuchKey" }))
      .mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "AccessDenied" }))
    const storage = new S3DesignStorage({ ...base, publicUrl: "https://p" }, { send } as never)

    expect((await storage.get("k"))?.toString()).toBe("hi")
    expect(await storage.get("k")).toBeNull()
    await expect(storage.get("k")).rejects.toThrow("denied")
  })
})

describe("LocalDesignStorage", () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "designs-"))
  })
  afterEach(() => rm(root, { recursive: true, force: true }))

  it("writes under the root and points at Medusa's /static", async () => {
    const storage = new LocalDesignStorage(root, "http://localhost:9000/")
    const url = await storage.put("designs/abc12345/front.png", Buffer.from("png-bytes"))

    expect(url).toBe("http://localhost:9000/static/designs/abc12345/front.png")
    expect(await readFile(path.join(root, "designs/abc12345/front.png"), "utf8")).toBe("png-bytes")
    expect((await storage.get("designs/abc12345/front.png"))?.toString()).toBe("png-bytes")
    expect(await storage.get("designs/none/front.png")).toBeNull()
  })

  it("refuses keys that climb out of the root", async () => {
    const storage = new LocalDesignStorage(root, "http://x")
    await expect(storage.put("../escape.png", Buffer.from("x"))).rejects.toThrow(/escapes/)
    await expect(storage.get("../../etc/passwd")).rejects.toThrow(/escapes/)
  })
})

describe("createDesignStorage", () => {
  it("uses the bucket when one is configured", () => {
    const s = createDesignStorage({ S3_BUCKET_NAME: "b", S3_PUBLIC_URL: "https://p", NODE_ENV: "production" } as never)
    expect(s).toBeInstanceOf(S3DesignStorage)
  })

  it("uses local disk in development", () => {
    expect(createDesignStorage({ NODE_ENV: "development" } as never)).toBeInstanceOf(LocalDesignStorage)
  })

  it("has no fallback in production", () => {
    expect(() => createDesignStorage({ NODE_ENV: "production" } as never)).toThrow(/S3_BUCKET_NAME/)
  })
})
