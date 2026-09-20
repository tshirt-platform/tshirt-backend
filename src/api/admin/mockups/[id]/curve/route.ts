import { templateRoute } from "../../proxy"

// How the print bends round the body (tshirt-render: PUT /templates/:id/curve)
export const PUT = templateRoute("/curve", "PUT", "json")
