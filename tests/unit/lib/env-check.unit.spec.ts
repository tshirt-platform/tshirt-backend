import { assertValidEnv, checkEnv } from "../../../src/lib/env-check"

const good: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgres://u:p@db/tshirt",
  REDIS_URL: "redis://redis:6379",
  JWT_SECRET: "j".repeat(40),
  COOKIE_SECRET: "c".repeat(40),
  STORE_CORS: "https://shop.example",
  ADMIN_CORS: "https://admin.example",
  AUTH_CORS: "https://shop.example,https://admin.example",
  S3_BUCKET_NAME: "tshirt-store",
  S3_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
  S3_PUBLIC_URL: "https://files.example",
  AWS_ACCESS_KEY_ID: "key",
  AWS_SECRET_ACCESS_KEY: "secret",
  DESIGN_FILE_ORIGINS: "https://files.example",
}

describe("checkEnv", () => {
  it("accepts a complete production configuration", () => {
    expect(checkEnv(good)).toEqual({ errors: [], warnings: [] })
  })

  it.each(["JWT_SECRET", "COOKIE_SECRET"])("refuses a missing, placeholder or short %s in production", (name) => {
    for (const value of [undefined, "supersecret", "short"]) {
      const { errors } = checkEnv({ ...good, [name]: value })
      expect(errors.join()).toContain(name)
    }
  })

  it("refuses local or wildcard CORS origins in production", () => {
    expect(checkEnv({ ...good, STORE_CORS: "http://localhost:3000" }).errors.join()).toMatch(/STORE_CORS still lists local/)
    expect(checkEnv({ ...good, ADMIN_CORS: "*" }).errors.join()).toMatch(/ADMIN_CORS allows every origin/)
  })

  it("requires the settings production cannot work without", () => {
    const { errors } = checkEnv({ ...good, DATABASE_URL: "", REDIS_URL: undefined, DESIGN_FILE_ORIGINS: undefined, S3_BUCKET_NAME: undefined })
    const text = errors.join("\n")
    expect(text).toMatch(/DATABASE_URL/)
    expect(text).toMatch(/REDIS_URL/)
    expect(text).toMatch(/DESIGN_FILE_ORIGINS/)
    expect(text).toMatch(/S3_BUCKET_NAME/)
  })

  it("catches half-configured storage in any environment", () => {
    const dev = { ...good, NODE_ENV: "development" }
    expect(checkEnv({ ...dev, AWS_SECRET_ACCESS_KEY: undefined }).errors.join()).toMatch(/AWS_SECRET_ACCESS_KEY/)
    expect(checkEnv({ ...dev, S3_PUBLIC_URL: undefined }).errors.join()).toMatch(/S3_PUBLIC_URL/)
  })

  it("only warns in development where production would stop", () => {
    const dev = { ...good, NODE_ENV: "development", JWT_SECRET: "supersecret", STORE_CORS: "http://localhost:3000", S3_BUCKET_NAME: undefined, S3_ENDPOINT: undefined }
    const { errors, warnings } = checkEnv(dev)
    expect(errors).toEqual([])
    expect(warnings.join("\n")).toMatch(/JWT_SECRET/)
    expect(warnings.join("\n")).toMatch(/STORE_CORS/)
    expect(warnings.join("\n")).toMatch(/S3_BUCKET_NAME/)
  })

  it("warns about a remote render service without a key", () => {
    expect(checkEnv({ ...good, RENDER_SERVICE_URL: "http://render.internal:8001" }).warnings.join()).toMatch(/RENDER_API_KEY/)
    expect(checkEnv({ ...good, RENDER_SERVICE_URL: "http://localhost:8001" }).warnings).toEqual([])
  })
})

describe("assertValidEnv", () => {
  it("stops production startup and lists every problem", () => {
    expect(() => assertValidEnv({ ...good, JWT_SECRET: "x", STORE_CORS: "*" }, jest.fn())).toThrow(/JWT_SECRET[\s\S]*STORE_CORS/)
  })

  it("only logs in development", () => {
    const log = jest.fn()
    expect(() => assertValidEnv({ NODE_ENV: "development", DATABASE_URL: "" }, log)).not.toThrow()
    expect(log).toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"))
  })
})
