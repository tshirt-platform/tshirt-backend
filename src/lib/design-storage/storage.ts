import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

export interface DesignStorage {
  /** Stores the bytes under the key and returns the URL they can be fetched from */
  put(key: string, body: Buffer, contentType: string): Promise<string>
  /** The stored bytes, or null when there is nothing under the key */
  get(key: string): Promise<Buffer | null>
}

export interface S3Settings {
  bucket: string
  region: string
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
  /** Where the bucket is served from; required with a custom endpoint such as Cloudflare R2 */
  publicUrl?: string
}

const trimSlash = (s: string) => s.replace(/\/+$/, "")

export class S3DesignStorage implements DesignStorage {
  private readonly client: S3Client
  private readonly baseUrl: string

  constructor(private readonly settings: S3Settings, client?: S3Client) {
    if (settings.endpoint && !settings.publicUrl) {
      throw new Error("S3_PUBLIC_URL is required when S3_ENDPOINT is set")
    }
    this.baseUrl = trimSlash(
      settings.publicUrl ?? `https://${settings.bucket}.s3.${settings.region}.amazonaws.com`
    )
    this.client =
      client ??
      new S3Client({
        region: settings.region,
        endpoint: settings.endpoint,
        // Newer SDKs sign a CRC32 checksum into uploads by default, which R2 and other S3 clones reject
        requestChecksumCalculation: "WHEN_REQUIRED",
        credentials:
          settings.accessKeyId && settings.secretAccessKey
            ? { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey }
            : undefined,
      })
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    )
    return `${this.baseUrl}/${key}`
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }))
      return out.Body ? Buffer.from(await out.Body.transformToByteArray()) : null
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null
      throw e
    }
  }
}

/** Development stand-in for a bucket: files go under Medusa's own /static directory */
export class LocalDesignStorage implements DesignStorage {
  private readonly root: string
  private readonly baseUrl: string

  constructor(root: string, publicBaseUrl: string) {
    this.root = path.resolve(root)
    this.baseUrl = trimSlash(publicBaseUrl)
  }

  private resolve(key: string): string {
    const target = path.resolve(this.root, key)
    if (!target.startsWith(this.root + path.sep)) throw new Error("Storage key escapes the storage root")
    return target
  }

  async put(key: string, body: Buffer): Promise<string> {
    const target = this.resolve(key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, body)
    return `${this.baseUrl}/static/${key}`
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key))
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") return null
      throw e
    }
  }
}

/** S3 or R2 when a bucket is configured; local disk outside production; otherwise no storage at all */
export function createDesignStorage(env: NodeJS.ProcessEnv = process.env): DesignStorage {
  if (env.S3_BUCKET_NAME) {
    return new S3DesignStorage({
      bucket: env.S3_BUCKET_NAME,
      region: env.AWS_REGION || "auto",
      endpoint: env.S3_ENDPOINT || undefined,
      accessKeyId: env.AWS_ACCESS_KEY_ID || undefined,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY || undefined,
      publicUrl: env.S3_PUBLIC_URL || undefined,
    })
  }
  if (env.NODE_ENV === "production") {
    throw new Error("S3_BUCKET_NAME is not configured")
  }
  return new LocalDesignStorage(
    path.join(process.cwd(), "static"),
    env.BACKEND_PUBLIC_URL || "http://localhost:9000"
  )
}

let cached: DesignStorage | null = null

export function getDesignStorage(): DesignStorage {
  return (cached ??= createDesignStorage())
}
