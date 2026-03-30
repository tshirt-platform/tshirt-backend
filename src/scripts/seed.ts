import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { ApiKey } from "../../.medusa/types/query-entry-points"

// --- Product definitions ---

const COLORS = [
  "Trắng",
  "Đen",
  "Xám nhạt",
  "Xám đậm",
  "Đỏ",
  "Xanh dương",
  "Xanh lá",
  "Vàng",
  "Navy",
  "Kem",
]

const SIZES = ["S", "M", "L", "XL", "XXL"]

interface ProductDef {
  title: string
  handle: string
  description: string
  category: string
  collection: string
  weight: number
  priceVnd: number
}

const PRODUCTS: ProductDef[] = [
  {
    title: "T-shirt Basic",
    handle: "tshirt-basic",
    description:
      "Áo thun Basic cotton 100%, 180gsm. Thiết kế thoải mái, phù hợp in theo yêu cầu.",
    category: "T-shirt",
    collection: "tshirt",
    weight: 250,
    priceVnd: 199000,
  },
  {
    title: "T-shirt Premium",
    handle: "tshirt-premium",
    description:
      "Áo thun Premium cotton compact, 220gsm. Chất vải dày dặn, form đẹp, in sắc nét.",
    category: "T-shirt",
    collection: "tshirt",
    weight: 300,
    priceVnd: 249000,
  },
  {
    title: "Polo",
    handle: "polo",
    description:
      "Áo Polo cotton pique, 200gsm. Có cổ lịch sự, phù hợp đồng phục và thường ngày.",
    category: "Polo",
    collection: "polo",
    weight: 280,
    priceVnd: 299000,
  },
  {
    title: "Hoodie",
    handle: "hoodie",
    description:
      "Áo Hoodie cotton fleece, 320gsm. Ấm áp, có mũ trùm, phù hợp mùa đông.",
    category: "Hoodie",
    collection: "hoodie",
    weight: 500,
    priceVnd: 399000,
  },
]

// --- Helper: generate variants for a product ---

function buildVariants(
  product: ProductDef,
  salesChannelId: string
): {
  variants: Array<{
    title: string
    sku: string
    options: Record<string, string>
    prices: Array<{ amount: number; currency_code: string }>
  }>
} {
  const variants = COLORS.flatMap((color) =>
    SIZES.map((size) => {
      const skuColor = color
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .toUpperCase()
      const skuBase = product.handle.toUpperCase().replace(/-/g, "_")
      return {
        title: `${size} / ${color}`,
        sku: `${skuBase}-${size}-${skuColor}`,
        options: { Size: size, Color: color },
        prices: [{ amount: product.priceVnd, currency_code: "vnd" }],
      }
    })
  )
  return { variants }
}

// --- Workflow: update store currencies ---

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[]
    store_id: string
  }) => {
    const normalizedInput = transform({ input }, (data) => ({
      selector: { id: data.input.store_id },
      update: {
        supported_currencies: data.input.supported_currencies.map((c) => ({
          currency_code: c.currency_code,
          is_default: c.is_default ?? false,
        })),
      },
    }))
    const stores = updateStoresStep(normalizedInput)
    return new WorkflowResponse(stores)
  }
)

// --- Main seed function ---

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const storeModuleService = container.resolve(Modules.STORE)

  // --- Store & Sales Channel ---
  logger.info("Seeding store data...")
  const [store] = await storeModuleService.listStores()
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })

  if (!defaultSalesChannel.length) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [{ name: "Default Sales Channel" }],
      },
    })
    defaultSalesChannel = result
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        { currency_code: "vnd", is_default: true },
      ],
    },
  })

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  })

  // --- Region: Vietnam (VND) ---
  logger.info("Seeding region data...")
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Vietnam",
          currency_code: "vnd",
          countries: ["vn"],
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })
  const region = regionResult[0]
  logger.info("Finished seeding regions.")

  // --- Tax region ---
  logger.info("Seeding tax regions...")
  await createTaxRegionsWorkflow(container).run({
    input: [{ country_code: "vn", provider_id: "tp_system" }],
  })
  logger.info("Finished seeding tax regions.")

  // --- Stock Location ---
  logger.info("Seeding stock location data...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Xưởng in HCM",
          address: {
            city: "Ho Chi Minh City",
            country_code: "VN",
            address_1: "123 Nguyen Hue, District 1",
          },
        },
      ],
    },
  })
  const stockLocation = stockLocationResult[0]

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: stockLocation.id },
    },
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  // --- Shipping ---
  logger.info("Seeding fulfillment data...")
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null

  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [{ name: "Default Shipping Profile", type: "default" }],
      },
    })
    shippingProfile = result[0]
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Vietnam Delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Vietnam",
        geo_zones: [{ country_code: "vn", type: "country" }],
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Nội thành",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Nội thành",
          description: "Giao hàng nội thành 1-2 ngày",
          code: "noi-thanh",
        },
        prices: [
          { currency_code: "vnd", amount: 25000 },
          { region_id: region.id, amount: 25000 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Ngoại thành",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Ngoại thành",
          description: "Giao hàng ngoại thành 2-3 ngày",
          code: "ngoai-thanh",
        },
        prices: [
          { currency_code: "vnd", amount: 30000 },
          { region_id: region.id, amount: 30000 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Liên tỉnh",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Liên tỉnh",
          description: "Giao hàng liên tỉnh 3-5 ngày",
          code: "lien-tinh",
        },
        prices: [
          { currency_code: "vnd", amount: 35000 },
          { region_id: region.id, amount: 35000 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })
  logger.info("Finished seeding fulfillment data.")

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  })
  logger.info("Finished seeding stock location data.")

  // --- Publishable API key ---
  logger.info("Seeding publishable API key data...")
  let publishableApiKey: ApiKey | null = null
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: { type: "publishable" },
  })

  publishableApiKey = data?.[0]

  if (!publishableApiKey) {
    const {
      result: [result],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: "Webshop", type: "publishable", created_by: "" },
        ],
      },
    })
    publishableApiKey = result as ApiKey
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  })
  logger.info("Finished seeding publishable API key data.")

  // --- Product categories ---
  logger.info("Seeding product data...")
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        { name: "T-shirt", is_active: true },
        { name: "Polo", is_active: true },
        { name: "Hoodie", is_active: true },
      ],
    },
  })

  // --- Products ---
  const productsInput = PRODUCTS.map((product) => {
    const { variants } = buildVariants(product, defaultSalesChannel[0].id)
    const categoryId = categoryResult.find(
      (cat) => cat.name === product.category
    )!.id

    return {
      title: product.title,
      handle: product.handle,
      description: product.description,
      weight: product.weight,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile!.id,
      category_ids: [categoryId],
      images: [
        {
          url: `https://placehold.co/800x800/f0f0f0/333?text=${encodeURIComponent(product.title)}+Front`,
        },
        {
          url: `https://placehold.co/800x800/f0f0f0/333?text=${encodeURIComponent(product.title)}+Back`,
        },
      ],
      options: [
        { title: "Size", values: SIZES },
        { title: "Color", values: COLORS },
      ],
      variants,
      sales_channels: [{ id: defaultSalesChannel[0].id }],
    }
  })

  await createProductsWorkflow(container).run({
    input: { products: productsInput },
  })
  logger.info("Finished seeding product data.")

  // --- Inventory levels ---
  logger.info("Seeding inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  })

  const inventoryLevels: CreateInventoryLevelInput[] = inventoryItems.map(
    (item) => ({
      location_id: stockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: item.id,
    })
  )

  await createInventoryLevelsWorkflow(container).run({
    input: { inventory_levels: inventoryLevels },
  })
  logger.info("Finished seeding inventory levels data.")
}
