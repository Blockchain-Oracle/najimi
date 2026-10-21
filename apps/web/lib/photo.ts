"use client"

import { UPLOAD } from "@najimi/config"

const isHeic = (file: File) =>
  /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)

/**
 * Gets a photo ready to send: HEIC (iPhone) becomes JPEG, and anything larger than the upload edge
 * is scaled down in the browser, so a 12 MP photo leaves the phone as ~1 MB.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  let source: Blob = file
  if (isHeic(file)) {
    const { default: heic2any } = await import("heic2any")
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 })
    source = Array.isArray(converted) ? (converted[0] ?? file) : converted
  }
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" })
  const scale = Math.min(1, UPLOAD.maxEdge / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && source.type === "image/jpeg" && source.size <= UPLOAD.maxBytes) {
    bitmap.close()
    return source
  }
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read the photo"))),
      "image/jpeg",
      0.9,
    ),
  )
}

export type Uploaded = { id: string; url: string; width: number; height: number }

/** Sends a prepared photo; the server re-encodes and stores it privately. */
export async function uploadPhoto(file: File): Promise<Uploaded> {
  const blob = await preparePhoto(file)
  const form = new FormData()
  form.set("file", new File([blob], "photo.jpg", { type: "image/jpeg" }))
  const response = await fetch("/api/uploads", { method: "POST", body: form })
  const body = (await response.json().catch(() => ({}))) as Partial<Uploaded> & { error?: string }
  if (!response.ok || !body.id) throw new Error(body.error ?? "Upload failed")
  return body as Uploaded
}
