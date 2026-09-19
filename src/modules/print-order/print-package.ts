import { strToU8, zipSync } from "fflate"
import {
  artworkFileName,
  buildPrintSpec,
  buildWorkOrderHtml,
  fileToken,
  proofFileName,
  type JobForSpec,
} from "./print-spec"

export type PrintPackage = {
  fileName: string
  bytes: Uint8Array
  warnings: string[]
}

/**
 * Everything a print shop needs for one printed side: the artwork under the shared
 * naming standard, a proof to compare against, a machine-readable spec and a work order.
 */
export async function buildPrintPackage(input: {
  orderNo: string
  itemNo: number
  job: JobForSpec
  notes?: string | null
  fetchFile: (url: string) => Promise<Uint8Array>
}): Promise<PrintPackage> {
  const { orderNo, itemNo, job, fetchFile } = input
  const spec = buildPrintSpec({ orderNo, itemNo, job })
  const warnings = [...spec.warnings]

  // The artwork is the deliverable, so failing to get it fails the package
  const artwork = await fetchFile(job.design_png_url)

  // A missing proof is worth a warning, not a blocked package
  let proof: Uint8Array | null = null
  if (job.preview_url) {
    try {
      proof = await fetchFile(job.preview_url)
    } catch {
      warnings.push("Proof image could not be downloaded")
      spec.proof_file = null
    }
  }
  spec.warnings = warnings

  // Images are already compressed, so they are stored as they are
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    [artworkFileName(orderNo, itemNo, job)]: [artwork, { level: 0 }],
    "spec.json": strToU8(JSON.stringify(spec, null, 2)),
    "workorder.html": strToU8(buildWorkOrderHtml(spec, input.notes ?? job.notes)),
  }
  if (proof) files[proofFileName(job)] = [proof, { level: 0 }]

  const side = job.side ?? "front"
  return {
    fileName: `order_${fileToken(orderNo) || "ORDER"}-item${itemNo}-${side}.zip`,
    bytes: zipSync(files),
    warnings,
  }
}
