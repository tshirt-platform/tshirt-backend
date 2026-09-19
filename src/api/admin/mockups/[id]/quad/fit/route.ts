import { templateRoute } from "../../../proxy"

// Places the print on the photo at its real size (see tshirt-render: PUT /templates/:id/quad/fit)
export const PUT = templateRoute("/quad/fit", "PUT", "json")
