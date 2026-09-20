export type Point = [number, number]

export type Anchors = { hps: Point; left: Point; right: Point }

export type PrintSpec = {
  print_width_mm: number
  print_height_mm: number
  top_offset_mm: number
  body_width_mm: number
}

/**
 * Where the print lands, from the three points marked on the photo. The render service does the
 * real placement; this is the same rule so the frame can follow the points while they are dragged.
 * The points are 0..1 of the photo; size is the photo in pixels (the aspect ratio matters).
 */
export function anchorQuad(a: Anchors, spec: PrintSpec, size: { width: number; height: number }): Point[] | null {
  const to = (p: Point): Point => [p[0] * (size.width - 1), p[1] * (size.height - 1)]
  const hps = to(a.hps)
  const left = to(a.left)
  const right = to(a.right)

  const dx = right[0] - left[0]
  const dy = right[1] - left[1]
  const length = Math.hypot(dx, dy)
  if (length < 0.02 * size.width) return null

  const u: Point = [dx / length, dy / length]
  const v: Point = [-u[1], u[0]]
  if (v[1] < 0) return null // left and right the wrong way round

  const pxPerMm = length / spec.body_width_mm
  const mid: Point = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2]
  const along = (hps[0] - mid[0]) * v[0] + (hps[1] - mid[1]) * v[1]
  const top: Point = [mid[0] + v[0] * (along + spec.top_offset_mm * pxPerMm), mid[1] + v[1] * (along + spec.top_offset_mm * pxPerMm)]

  const half = (spec.print_width_mm * pxPerMm) / 2
  const down = spec.print_height_mm * pxPerMm
  const corner = (side: -1 | 1, drop: number): Point => [
    top[0] + u[0] * half * side + v[0] * drop,
    top[1] + u[1] * half * side + v[1] * drop,
  ]
  return [corner(-1, 0), corner(1, 0), corner(1, down), corner(-1, down)].map(
    (c): Point => [c[0] / (size.width - 1), c[1] / (size.height - 1)]
  )
}
