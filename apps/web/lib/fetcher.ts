/** JSON fetch for our own API: throws the server's plain-words error on failure. */
export async function api<T>(path: string, init?: { method?: string; json?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? (init?.json === undefined ? "GET" : "POST"),
    headers: init?.json === undefined ? undefined : { "content-type": "application/json" },
    body: init?.json === undefined ? undefined : JSON.stringify(init.json),
  })
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) throw new Error(data.error ?? "Something went wrong")
  return data as T
}
