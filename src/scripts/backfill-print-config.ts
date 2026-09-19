import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { buildPrintConfig, PRODUCTS } from "./seed-data"

// Adds print_config to seeded products that were created before it existed.
// Products that already have one are left alone, so admin edits are never overwritten.
export default async function backfillPrintConfig({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "metadata"],
    filters: { handle: PRODUCTS.map((p) => p.handle) },
  })

  let updated = 0
  for (const product of products) {
    const def = PRODUCTS.find((p) => p.handle === product.handle)
    const metadata = (product.metadata ?? {}) as Record<string, unknown>
    if (!def || metadata.print_config) continue

    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: product.id },
        update: { metadata: { ...metadata, print_config: buildPrintConfig(def) } },
      },
    })
    updated += 1
  }

  logger.info(`print_config added to ${updated} of ${products.length} products.`)
}
