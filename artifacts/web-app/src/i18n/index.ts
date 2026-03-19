import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zh from "./locales/zh.json";
import ms from "./locales/ms.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import th from "./locales/th.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { t: en },
    zh: { t: zh },
    ms: { t: ms },
    ja: { t: ja },
    ko: { t: ko },
    th: { t: th },
  },
  ns: ["t"],
  defaultNS: "t",
  lng: localStorage.getItem("kl_lang") || "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
