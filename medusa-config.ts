import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { assertValidEnv, sessionHours } from './src/lib/env-check'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())
assertValidEnv()

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    // Sessions live in Redis (redisUrl above). A longer lifetime is a development convenience: it is
    // sliding, so using the admin keeps it alive, and env-check refuses more than a day in production
    sessionOptions: {
      ttl: sessionHours(process.env) * 60 * 60 * 1000,
      rolling: Boolean(process.env.ADMIN_SESSION_TTL_HOURS),
    },
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    { resolve: "./src/modules/print-order" },
  ],
})
