import { templateRoute } from "../../proxy"

// What the photo was taken apart into: fabric, its light, its creases, the print, then the
// arms and hair in front of it. POST splits the photo again with the local model.
export const GET = templateRoute("/layers", "GET")
export const POST = templateRoute("/layers", "POST")
