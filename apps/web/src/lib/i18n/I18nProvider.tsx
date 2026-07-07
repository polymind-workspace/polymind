import { useEffect } from "react"
import { I18nextProvider } from "react-i18next"

import i18n, { LANG_COOKIE } from "@/lib/i18n"

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Keeps the server + first client render on the default `en` (SSR-safe),
 * then applies the saved language from the cookie right after hydration.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = readCookie(LANG_COOKIE)
    if ((saved === "zh" || saved === "en") && saved !== i18n.language) {
      i18n.changeLanguage(saved)
    }
  }, [])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
