/** Thin API client that attaches the SIWS JWT when available.
 *
 * The token is issued after wallet sign-in (see lib/auth.ts).
 */

import { mockHandler } from "./mock/handlers"
import { tokenStore } from "./auth"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8300"

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${API_URL}${normalized}`
}

type ApiFetchOptions = Omit<RequestInit, "body"> & { body?: unknown }

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  if (import.meta.env.VITE_API_MOCK === "true") {
    return mockHandler(path, options as RequestInit)
  }

  const headers = new Headers(options.headers)
  const token = tokenStore.get()
  headers.set("Authorization", `Bearer ${token ?? "default"}`)

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body)
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
  }

  const response = await fetch(buildUrl(path), { ...options, headers, body })

  if (response.status === 401) {
    tokenStore.clear()
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("polymind-web-401"))
    }
  }

  return response
}

export async function apiGet(path: string, options: RequestInit = {}) {
  return apiFetch(path, { method: "GET", ...options })
}

export async function apiPost(
  path: string,
  body?: unknown,
  options: RequestInit = {}
) {
  return apiFetch(path, {
    method: "POST",
    body,
    ...options,
  })
}

export async function apiPut(
  path: string,
  body?: unknown,
  options: RequestInit = {}
) {
  return apiFetch(path, {
    method: "PUT",
    body,
    ...options,
  })
}

export async function apiDelete(path: string, options: RequestInit = {}) {
  return apiFetch(path, { method: "DELETE", ...options })
}
