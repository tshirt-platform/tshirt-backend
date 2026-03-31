import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/print-orders*",
      middlewares: [authenticate("user", ["session", "bearer"])],
    },
  ],
})
