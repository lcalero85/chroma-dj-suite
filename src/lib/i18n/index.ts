import { useApp } from "@/state/store";
import { DICT, type DictKey, type Lang } from "./dict";

export type { Lang, DictKey } from "./dict";
export { LANG_LABELS } from "./dict";

function pickDict(lang: Lang): Record<DictKey, string> {
  if (lang === "es") return DICT.es as unknown as Record<DictKey, string>;
  // pt/fr/it currently inherit English copy until full translations are added.
  return DICT.en as unknown as Record<DictKey, string>;
}

/** Reactive translator hook. Re-renders when `settings.lang` changes. */
export function useT() {
  const lang = useApp((s) => s.settings.lang);
  const d = pickDict(lang);
  return (key: DictKey): string => d[key] ?? DICT.en[key] ?? key;
}

/** Non-reactive translator (for one-off calls outside React, e.g. toasts). */
export function t(key: DictKey): string {
  const lang = (useApp.getState().settings.lang ?? "en") as Lang;
  return pickDict(lang)[key] ?? DICT.en[key] ?? key;
}

export function getLang(): Lang {
  return (useApp.getState().settings.lang ?? "en") as Lang;
}