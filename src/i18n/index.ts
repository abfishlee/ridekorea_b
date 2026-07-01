/**
 * i18n setup (EN/JA/ZH/KO). English is the default/fallback; device locale is
 * auto-detected on first run and can be overridden in settings later.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";

import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import ko from "./locales/ko.json";

export const SUPPORTED_LANGUAGES = ["en", "ja", "zh", "ko"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const deviceLang = getLocales()?.[0]?.languageCode ?? "en";
const initialLang: SupportedLanguage = (SUPPORTED_LANGUAGES as readonly string[]).includes(
  deviceLang,
)
  ? (deviceLang as SupportedLanguage)
  : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ja: { translation: ja },
    zh: { translation: zh },
    ko: { translation: ko },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
