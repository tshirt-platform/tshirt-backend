import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

const adminAuth = authenticate("user", ["session", "bearer"])

export default defineMiddlewares({
  routes: [
    {
      matcher: "/admin/print-orders*",
      middlewares: [adminAuth],
    },
    {
      matcher: "/admin/mockups*",
      middlewares: [adminAuth],
    },
    // Uploads are streamed to the render service, so the body must stay unparsed
    { matcher: "/admin/mockups", method: ["POST"], bodyParser: false },
    { matcher: "/admin/mockups/:id/mask", method: ["PUT"], bodyParser: false },
    { matcher: "/admin/mockups/:id/occlusion", method: ["PUT"], bodyParser: false },
  ],
})
