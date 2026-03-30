# tshirt-backend — Custom T-Shirt Platform (Backend)

## Overview
Medusa.js v2 e-commerce backend handling products, orders, and print shop integration for a custom T-shirt platform.

## Tech Stack
| Package | Version |
|---|---|
| @medusajs/medusa | 2.13.x |
| @medusajs/framework | 2.13.x |
| postgresql | 15+ |
| redis | 7+ |
| node | 20+ LTS |
| zod | 3.x (Medusa requires v3) |
| axios | latest |
| @aws-sdk/client-s3 | 3.x |

## Environment Variables

```
DATABASE_URL=postgres://postgres:password@localhost:5432/tshirt_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=<change-in-production>
COOKIE_SECRET=<change-in-production>
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:9000
AUTH_CORS=http://localhost:3000,http://localhost:9000
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
```

## Folder Structure

```
src/
├── modules/
│   └── print-order/
│       ├── index.ts                      # Module definition (defineModule)
│       ├── service.ts                    # PrintOrderService
│       └── models/
│           └── print-job.ts             # PrintJob data model
├── workflows/
│   └── create-print-job.ts              # Create print job on order placed
├── subscribers/
│   └── order-placed.subscriber.ts       # Triggers on order confirmed
├── links/
│   └── print-job-order.ts              # PrintJob ↔ Order link
└── api/
    └── admin/print-orders/              # Admin routes for managing print jobs
```

## Medusa v2 Module System

### Creating a Custom Module

```ts
// src/modules/print-order/index.ts
import { Module } from "@medusajs/framework/utils"
import PrintOrderService from "./service"

export const PRINT_ORDER_MODULE = "printOrder"

export default Module(PRINT_ORDER_MODULE, {
  service: PrintOrderService,
})
```

### Service Class

```ts
// src/modules/print-order/service.ts
import { MedusaService } from "@medusajs/framework/utils"
import { PrintJob } from "./models/print-job"

class PrintOrderService extends MedusaService({ PrintJob }) {
  // Custom methods beyond CRUD
  async sendToPrintShop(orderId: string) { ... }
}

export default PrintOrderService
```

### Data Model

```ts
// src/modules/print-order/models/print-job.ts
import { model } from "@medusajs/framework/utils"

const PrintJob = model.define("print_job", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  status: model.enum(["pending", "printing", "shipped", "delivered", "failed"]),
  design_png_url: model.text(),
  design_json_url: model.text(),
  external_id: model.text().nullable(),
  // timestamps auto-added
})

export default PrintJob
```

### Register Module in medusa-config

```ts
// medusa-config.ts
module.exports = defineConfig({
  modules: [
    { resolve: "./src/modules/print-order" },
  ],
})
```

## Workflow Syntax

### Creating a Workflow

```ts
// src/workflows/send-to-print-shop.ts
import { createWorkflow, createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

const fetchOrderStep = createStep(
  "fetch-order",
  async ({ order_id }, { container }) => {
    const orderService = container.resolve("order")
    const order = await orderService.retrieveOrder(order_id)
    return new StepResponse(order)
  }
)

const sendToPrintShopStep = createStep(
  "send-to-print-shop",
  async ({ order }, { container }) => {
    const printOrderService = container.resolve("printOrder")
    const result = await printOrderService.sendToPrintShop(order)
    return new StepResponse(result)
  },
  // Compensation (rollback)
  async ({ order }, { container }) => {
    // Cancel print job if later step fails
  }
)

export const sendToPrintShopWorkflow = createWorkflow(
  "send-to-print-shop",
  (input: { order_id: string }) => {
    const order = fetchOrderStep(input)
    const result = sendToPrintShopStep({ order })
    return result
  }
)
```

### Invoking a Workflow

```ts
const { result } = await sendToPrintShopWorkflow(container).run({
  input: { order_id: "order_123" },
})
```

## Subscriber Pattern

```ts
// src/subscribers/order-placed.subscriber.ts
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"

export default async function orderPlacedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id
  const workflow = await import("../workflows/send-to-print-shop")
  await workflow.sendToPrintShopWorkflow(container).run({
    input: { order_id: orderId },
  })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
```

## Custom API Route Format

```ts
// src/api/admin/print-orders/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const printOrderService = req.scope.resolve("printOrder")
  const printJobs = await printOrderService.listPrintJobs()
  res.json({ print_jobs: printJobs })
}

// src/api/webhooks/print-shop/route.ts
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  // Receive status updates from print shop
  const { order_id, status } = req.body
  const printOrderService = req.scope.resolve("printOrder")
  await printOrderService.updateStatus(order_id, status)
  res.sendStatus(200)
}
```

### Path Parameters

```ts
// src/api/admin/print-orders/[id]/route.ts
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params
  // ...
}
```

### Middleware

```ts
// src/api/middlewares.ts
import { defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/webhooks/print-shop",
      middlewares: [validatePrintShopWebhook],
    },
  ],
})
```

## Print Order Management

Print jobs are managed internally — no external print shop API. Admin downloads design files and handles printing manually.

### Status Flow
```
pending → processing → shipped → delivered
    ↘         ↘
   cancelled  cancelled
```

### Admin Routes
| Method | Route | Action |
|---|---|---|
| GET | `/admin/print-orders` | List print jobs (paginated) |
| GET | `/admin/print-orders/:id` | Print job detail |
| POST | `/admin/print-orders/:id` | Update status |
| POST | `/admin/print-orders/:id/cancel` | Cancel job |

### Design Files
- Stored on S3 as presigned URLs (PNG + Fabric.js JSON)
- Admin downloads files → brings to print shop
- URLs: `s3://{bucket}/designs/{order_id}/{side}.png`

## Cross-Repo Dependencies
- `@tshirt/shared` — shared TypeScript types and constants
- `tshirt-store` communicates via Medusa Store API (CORS: `STORE_CORS`)
