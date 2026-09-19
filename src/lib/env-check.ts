export interface EnvReport {
  /** Problems that make the server unsafe or unable to work; startup stops on these in production */
  errors: string[]
  /** Worth fixing, but the server still works */
  warnings: string[]
}

const WEAK_SECRETS = new Set(["supersecret", "secret", "changeme", "change-me", "password", "<change-in-production>"])
const MIN_SECRET_LENGTH = 32

const isSet = (v: string | undefined): v is string => typeof v === "string" && v.trim() !== ""
const origins = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean)
const isLocal = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(origin)

/**
 * Checks the settings the server depends on. Development gets a warning where production
 * gets an error, so a missing secret is caught before deploy, not after.
 */
export function checkEnv(env: NodeJS.ProcessEnv): EnvReport {
  const production = env.NODE_ENV === "production"
  const errors: string[] = []
  const warnings: string[] = []
  const problem = (message: string, fatalInProduction = true) =>
    (production && fatalInProduction ? errors : warnings).push(message)

  if (!isSet(env.DATABASE_URL)) errors.push("DATABASE_URL is not set")
  if (production && !isSet(env.REDIS_URL)) errors.push("REDIS_URL is not set (production needs Redis for events and caching)")

  for (const name of ["JWT_SECRET", "COOKIE_SECRET"] as const) {
    const value = env[name]
    if (!isSet(value)) problem(`${name} is not set; Medusa would fall back to a known default`)
    else if (WEAK_SECRETS.has(value.toLowerCase())) problem(`${name} is a well-known placeholder`)
    else if (value.length < MIN_SECRET_LENGTH) problem(`${name} is shorter than ${MIN_SECRET_LENGTH} characters`)
  }

  for (const name of ["STORE_CORS", "ADMIN_CORS", "AUTH_CORS"] as const) {
    const list = origins(env[name])
    if (list.length === 0) {
      errors.push(`${name} is not set`)
      continue
    }
    if (list.includes("*")) problem(`${name} allows every origin ("*")`)
    const local = list.filter(isLocal)
    if (local.length > 0) problem(`${name} still lists local origins: ${local.join(", ")}`)
  }

  if (isSet(env.S3_BUCKET_NAME)) {
    if (!isSet(env.AWS_ACCESS_KEY_ID) || !isSet(env.AWS_SECRET_ACCESS_KEY)) {
      errors.push("S3_BUCKET_NAME is set without AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY")
    }
    if (isSet(env.S3_ENDPOINT) && !isSet(env.S3_PUBLIC_URL)) {
      errors.push("S3_ENDPOINT (R2 or another S3 clone) needs S3_PUBLIC_URL, the address files are served from")
    }
  } else {
    problem("S3_BUCKET_NAME is not set: design files would go to local disk, which a deploy wipes")
  }

  if (production && !isSet(env.DESIGN_FILE_ORIGINS)) {
    errors.push("DESIGN_FILE_ORIGINS is not set: the print package could not download any design file")
  }

  const render = env.RENDER_SERVICE_URL
  if (isSet(render) && !isLocal(render) && !isSet(env.RENDER_API_KEY)) {
    warnings.push("RENDER_SERVICE_URL points off this machine but RENDER_API_KEY is not set")
  }

  return { errors, warnings }
}

/** Throws in production when there are errors; otherwise prints what it found */
export function assertValidEnv(env: NodeJS.ProcessEnv = process.env, log: (m: string) => void = console.warn): void {
  const { errors, warnings } = checkEnv(env)
  for (const w of warnings) log(`[env] warning: ${w}`)
  if (errors.length === 0) return

  const list = errors.map((e) => `  - ${e}`).join("\n")
  if (env.NODE_ENV === "production") {
    throw new Error(`Refusing to start with an unsafe configuration:\n${list}`)
  }
  for (const e of errors) log(`[env] error: ${e}`)
}
