import type { DesignSide } from "@tshirt-platform/shared"

export type Mockup = {
  id: string
  name: string
  width: number
  height: number
  quad: number[][] | null
  mask_coverage: number
  has_occlusion: boolean
  version: number
}

// The dashboard is served from the same origin as the API, so the session cookie applies
async function call(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, { credentials: "include", ...init })
  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json()
      detail = body.detail ?? body.message ?? ""
    } catch {
      // not JSON
    }
    throw new Error(detail || `Request failed (${res.status})`)
  }
  return res
}

export async function listMockups(): Promise<Mockup[]> {
  return (await call("/admin/mockups")).json()
}

export async function uploadMockup(file: File, name: string): Promise<Mockup> {
  const form = new FormData()
  form.set("image", file)
  form.set("name", name)
  return (await call("/admin/mockups", { method: "POST", body: form })).json()
}

export async function saveQuad(id: string, points: number[][]): Promise<Mockup> {
  const res = await call(`/admin/mockups/${id}/quad`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  })
  return res.json()
}

/** The print's real size and where it hangs on the reference garment, in millimetres */
export type FitSpec = {
  print_width_mm: number
  print_height_mm: number
  top_offset_mm: number
  garment_length_mm: number
}

/** Puts the print area on the photo at true size and proportions, so it is not stretched */
export async function fitQuad(id: string, spec: FitSpec): Promise<Mockup> {
  const res = await call(`/admin/mockups/${id}/quad/fit`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(spec),
  })
  return res.json()
}

type Outline = number[][]

async function saveOutline(id: string, layer: "mask" | "occlusion", outlines: Outline[]): Promise<Mockup> {
  const res = await call(`/admin/mockups/${id}/${layer}/outline`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outlines, refine: true }),
  })
  return res.json()
}

/** The garment area drawn by hand; corners are 0..1 of the photo */
export const saveMaskOutline = (id: string, outlines: Outline[]) => saveOutline(id, "mask", outlines)

/** What sits in front of the print (an arm, hair) */
export const saveOcclusionOutline = (id: string, outlines: Outline[]) => saveOutline(id, "occlusion", outlines)

export async function clearOcclusion(id: string): Promise<Mockup> {
  return (await call(`/admin/mockups/${id}/occlusion`, { method: "DELETE" })).json()
}

export async function replaceMaskLayer(
  id: string,
  layer: "mask" | "occlusion",
  file: File
): Promise<Mockup> {
  const form = new FormData()
  form.set("image", file)
  return (await call(`/admin/mockups/${id}/${layer}`, { method: "PUT", body: form })).json()
}

export async function deleteMockup(id: string): Promise<void> {
  await call(`/admin/mockups/${id}`, { method: "DELETE" })
}

export const mockupImageUrl = (id: string, version: number) => `/admin/mockups/${id}/image?v=${version}`
export const mockupMaskUrl = (id: string, version: number) => `/admin/mockups/${id}/mask?v=${version}`

export async function saveProductPrintConfig(
  productId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await call(`/admin/products/${productId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metadata }),
  })
}

export const SIDE_LABEL: Record<DesignSide, string> = { front: "Mặt trước", back: "Mặt sau" }
