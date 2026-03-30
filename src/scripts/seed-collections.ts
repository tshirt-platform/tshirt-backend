import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createCollectionsWorkflow,
  batchLinkProductsToCollectionWorkflow,
} from "@medusajs/medusa/core-flows"

const COLLECTIONS = [
  { title: "T-shirt", handle: "tshirt", productHandles: ["tshirt-basic", "tshirt-premium"] },
  { title: "Polo", handle: "polo", productHandles: ["polo"] },
  { title: "Hoodie", handle: "hoodie", productHandles: ["hoodie"] },
]

export default async function seedCollections({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productModuleService = container.resolve(Modules.PRODUCT)

  // Check if collections already exist
  const existingCollections = await productModuleService.listProductCollections(
    { handle: COLLECTIONS.map((c) => c.handle) }
  )

  if (existingCollections.length >= COLLECTIONS.length) {
    logger.info("Collections already exist, skipping.")
    return
  }

  // Create collections
  logger.info("Creating product collections...")
  const { result: collectionResult } = await createCollectionsWorkflow(
    container
  ).run({
    input: {
      collections: COLLECTIONS.map((c) => ({
        title: c.title,
        handle: c.handle,
      })),
    },
  })

  // Link products to collections
  for (const collDef of COLLECTIONS) {
    const collection = collectionResult.find((c) => c.handle === collDef.handle)
    if (!collection) continue

    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id"],
      filters: { handle: collDef.productHandles },
    })

    if (products.length > 0) {
      await batchLinkProductsToCollectionWorkflow(container).run({
        input: {
          id: collection.id,
          add: products.map((p) => p.id),
        },
      })
      logger.info(
        `Linked ${products.length} products to collection "${collDef.title}"`
      )
    }
  }

  logger.info("Finished seeding collections.")
}
