// Shared data definitions for seed scripts

export const COLORS = [
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

export const SIZES = ["S", "M", "L", "XL", "XXL"]

export const COLLECTIONS = [
  { title: "T-shirt", handle: "tshirt" },
  { title: "Polo", handle: "polo" },
  { title: "Hoodie", handle: "hoodie" },
]

export interface ProductDef {
  title: string
  handle: string
  description: string
  category: string
  collectionHandle: string
  weight: number
  priceVnd: number
}

export const PRODUCTS: ProductDef[] = [
  {
    title: "T-shirt Basic",
    handle: "tshirt-basic",
    description:
      "Áo thun Basic cotton 100%, 180gsm. Thiết kế thoải mái, phù hợp in theo yêu cầu.",
    category: "T-shirt",
    collectionHandle: "tshirt",
    weight: 250,
    priceVnd: 199000,
  },
  {
    title: "T-shirt Premium",
    handle: "tshirt-premium",
    description:
      "Áo thun Premium cotton compact, 220gsm. Chất vải dày dặn, form đẹp, in sắc nét.",
    category: "T-shirt",
    collectionHandle: "tshirt",
    weight: 300,
    priceVnd: 249000,
  },
  {
    title: "Polo",
    handle: "polo",
    description:
      "Áo Polo cotton pique, 200gsm. Có cổ lịch sự, phù hợp đồng phục và thường ngày.",
    category: "Polo",
    collectionHandle: "polo",
    weight: 280,
    priceVnd: 299000,
  },
  {
    title: "Hoodie",
    handle: "hoodie",
    description:
      "Áo Hoodie cotton fleece, 320gsm. Ấm áp, có mũ trùm, phù hợp mùa đông.",
    category: "Hoodie",
    collectionHandle: "hoodie",
    weight: 500,
    priceVnd: 399000,
  },
]

export function buildVariants(product: ProductDef): Array<{
  title: string
  sku: string
  options: Record<string, string>
  prices: Array<{ amount: number; currency_code: string }>
}> {
  return COLORS.flatMap((color) =>
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
}
