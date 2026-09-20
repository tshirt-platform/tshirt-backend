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
    {
      matcher: "/admin/mockup-ai*",
      middlewares: [adminAuth],
    },
    // Uploads are streamed to the render service, so the body must stay unparsed
    { matcher: "/admin/mockups", method: ["POST"], bodyParser: false },
    { matcher: "/admin/mockups/:id/mask", method: ["PUT"], bodyParser: false },
    { matcher: "/admin/mockups/:id/occlusion", method: ["PUT"], bodyParser: false },
    // Design files are raw bytes (PNG, JPEG or scene JSON) that the route reads and checks itself
    { matcher: "/store/designs/:designId/:side/:kind", method: ["PUT"], bodyParser: false },
  ],
})
