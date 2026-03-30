import {
  COLORS,
  SIZES,
  COLLECTIONS,
  PRODUCTS,
  buildVariants,
} from "../seed-data"

describe("Seed Data", () => {
  describe("COLORS", () => {
    it("has 10 colors", () => {
      expect(COLORS).toHaveLength(10)
    })

    it("includes required colors", () => {
      expect(COLORS).toContain("Trắng")
      expect(COLORS).toContain("Đen")
      expect(COLORS).toContain("Navy")
    })
  })

  describe("SIZES", () => {
    it("has 5 sizes in order", () => {
      expect(SIZES).toEqual(["S", "M", "L", "XL", "XXL"])
    })
  })

  describe("COLLECTIONS", () => {
    it("has 3 collections with correct handles", () => {
      expect(COLLECTIONS).toHaveLength(3)
      const handles = COLLECTIONS.map((c) => c.handle)
      expect(handles).toEqual(["tshirt", "polo", "hoodie"])
    })
  })

  describe("PRODUCTS", () => {
    it("has 4 products", () => {
      expect(PRODUCTS).toHaveLength(4)
    })

    it("each product has required fields", () => {
      for (const product of PRODUCTS) {
        expect(product.title).toBeTruthy()
        expect(product.handle).toBeTruthy()
        expect(product.description).toBeTruthy()
        expect(product.category).toBeTruthy()
        expect(product.collectionHandle).toBeTruthy()
        expect(product.weight).toBeGreaterThan(0)
        expect(product.priceVnd).toBeGreaterThan(0)
      }
    })

    it("each product maps to a valid collection", () => {
      const collectionHandles = COLLECTIONS.map((c) => c.handle)
      for (const product of PRODUCTS) {
        expect(collectionHandles).toContain(product.collectionHandle)
      }
    })

    it("has correct prices in VND", () => {
      const prices = PRODUCTS.map((p) => p.priceVnd)
      expect(prices).toEqual([199000, 249000, 299000, 399000])
    })
  })

  describe("buildVariants", () => {
    const product = PRODUCTS[0] // T-shirt Basic

    it("generates color × size variants", () => {
      const variants = buildVariants(product)
      expect(variants).toHaveLength(COLORS.length * SIZES.length)
    })

    it("generates correct SKU format", () => {
      const variants = buildVariants(product)
      const firstVariant = variants[0]
      expect(firstVariant.sku).toMatch(/^TSHIRT_BASIC-S-/)
    })

    it("sets VND prices on all variants", () => {
      const variants = buildVariants(product)
      for (const variant of variants) {
        expect(variant.prices).toEqual([
          { amount: 199000, currency_code: "vnd" },
        ])
      }
    })

    it("includes Size and Color options", () => {
      const variants = buildVariants(product)
      for (const variant of variants) {
        expect(variant.options).toHaveProperty("Size")
        expect(variant.options).toHaveProperty("Color")
        expect(SIZES).toContain(variant.options.Size)
        expect(COLORS).toContain(variant.options.Color)
      }
    })

    it("generates unique SKUs", () => {
      const variants = buildVariants(product)
      const skus = variants.map((v) => v.sku)
      expect(new Set(skus).size).toBe(skus.length)
    })

    it("generates unique titles", () => {
      const variants = buildVariants(product)
      const titles = variants.map((v) => v.title)
      expect(new Set(titles).size).toBe(titles.length)
    })
  })
})
