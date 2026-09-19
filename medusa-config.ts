import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { assertValidEnv } from './src/lib/env-check'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())
assertValidEnv()

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
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
