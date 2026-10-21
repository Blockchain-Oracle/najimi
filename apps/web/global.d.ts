import type { LocaleCode } from "@najimi/config"
import type en from "./messages/en.json"

declare module "next-intl" {
  interface AppConfig {
    Locale: LocaleCode
    Messages: typeof en
  }
}
