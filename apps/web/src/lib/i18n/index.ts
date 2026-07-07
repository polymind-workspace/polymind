import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en"
import zh from "./locales/zh"

export const LANG_COOKIE = "polymind-lang"
export type Locale = "zh" | "en"

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
}

/** Change the active language and persist the choice to a cookie. */
export function setLocale(lng: Locale) {
  i18n.changeLanguage(lng)
  if (typeof document !== "undefined") {
    document.cookie = `${LANG_COOKIE}=${lng};path=/;max-age=31536000;samesite=lax`
  }
}

export default i18n
