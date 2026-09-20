import { templateRoute } from "../../../proxy"

// Places the print from three points marked on the photo (tshirt-render: PUT /templates/:id/quad/anchor)
export const PUT = templateRoute("/quad/anchor", "PUT", "json")
