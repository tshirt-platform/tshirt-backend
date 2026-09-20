import { templateRoute } from "../../proxy"

// Lets the vision model read a photo and set it up (tshirt-render: POST /templates/:id/analyze)
export const POST = templateRoute("/analyze", "POST", "json")
