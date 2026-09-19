export const DESIGN_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/

export const SIDES = ["front", "back"] as const
export type Side = (typeof SIDES)[number]

/** What each design file is: the print PNG, the editor scene, and the flat preview */
export const KINDS = {
  png: { contentType: "image/png", maxBytes: 40 * 1024 * 1024 },
  json: { contentType: "application/json", maxBytes: 5 * 1024 * 1024 },
  jpg: { contentType: "image/jpeg", maxBytes: 10 * 1024 * 1024 },
} as const
export type Kind = keyof typeof KINDS

export interface DesignFileRef {
  designId: string
  side: Side
  kind: Kind
}

/** Reads the URL parameters of a design file route, or null when any of them is not allowed */
export function parseDesignFileRef(params: Record<string, unknown>): DesignFileRef | null {
  const { designId, side, kind } = params
  if (typeof designId !== "string" || !DESIGN_ID_PATTERN.test(designId)) return null
  if (!(SIDES as readonly unknown[]).includes(side)) return null
  if (typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(KINDS, kind)) return null
  return { designId, side: side as Side, kind: kind as Kind }
}

/** Built only from validated parts, so it cannot climb out of the storage root */
export function designKey({ designId, side, kind }: DesignFileRef): string {
  return `designs/${designId}/${side}.${kind}`
}
