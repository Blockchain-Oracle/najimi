"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { type Uploaded, uploadPhoto } from "@/lib/photo"

export function UploadCheck() {
  const t = useTranslations("System")
  const [state, setState] = useState<"idle" | "uploading" | "done" | "failed">("idle")
  const [result, setResult] = useState<Uploaded | null>(null)
  const [error, setError] = useState("")

  async function pick(file: File | undefined) {
    if (!file) return
    setState("uploading")
    try {
      const session = await authClient.getSession()
      if (!session.data) await authClient.signIn.anonymous()
      setResult(await uploadPhoto(file))
      setState("done")
    } catch (e) {
      setError(e instanceof Error ? e.message : "")
      setState("failed")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="sticker w-fit cursor-pointer px-4 py-2 text-sm font-semibold">
        {state === "uploading" ? t("uploading") : t("choose")}
        <input
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      {state === "failed" ? (
        <p className="text-destructive">{t("failed", { reason: error })}</p>
      ) : null}
      {result ? (
        <figure className="print w-full max-w-md">
          {/* biome-ignore lint/performance/noImgElement: a private, session-checked object */}
          <img
            src={result.url}
            alt=""
            width={result.width}
            height={result.height}
            className="h-auto w-full rounded-sm"
          />
          <figcaption className="pt-2 text-xs text-paper-muted tnum">
            {t("stored")} · {result.width}×{result.height}
          </figcaption>
        </figure>
      ) : null}
    </div>
  )
}
