import { useApp } from "@/state/store";
import { DICT, type DictKey, type Lang } from "./dict";

export type { Lang, DictKey } from "./dict";

/** Reactive translator hook. Re-renders when `settings.lang` changes. */
export function useT() {
  const lang = useApp((s) => s.settings.lang);
  return (key: DictKey): string => DICT[lang][key] ?? DICT.en[key] ?? key;
}

/** Non-reactive translator (for one-off calls outside React, e.g. toasts). */
export function t(key: DictKey): string {
  const lang = (useApp.getState().settings.lang ?? "en") as Lang;
  return DICT[lang][key] ?? DICT.en[key] ?? key;
}

export function getLang(): Lang {
  return (useApp.getState().settings.lang ?? "en") as Lang;
}