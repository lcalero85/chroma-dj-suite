import { useApp } from "@/state/store";
import { DICT, type DictKey, type Lang } from "./dict";

export type { Lang, DictKey } from "./dict";
export { LANG_LABELS } from "./dict";

function pickDict(lang: Lang): Record<DictKey, string> {
  if (lang === "es") return DICT.es as unknown as Record<DictKey, string>;
  // pt/fr/it currently inherit English copy until full translations are added.
  return DICT.en as unknown as Record<DictKey, string>;
}

/** Substitute {placeholders} from the params record. Missing keys are kept literal. */
function interp(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

/** Reactive translator hook. Re-renders when `settings.lang` changes. */
export function useT() {
  const lang = useApp((s) => s.settings.lang);
  const d = pickDict(lang);
  return (key: DictKey, params?: Record<string, string | number>): string =>
    interp(d[key] ?? DICT.en[key] ?? key, params);
}

/** Non-reactive translator (for one-off calls outside React, e.g. toasts). */
export function t(key: DictKey, params?: Record<string, string | number>): string {
  const lang = (useApp.getState().settings.lang ?? "en") as Lang;
  return interp(pickDict(lang)[key] ?? DICT.en[key] ?? key, params);
}

export function getLang(): Lang {
  return (useApp.getState().settings.lang ?? "en") as Lang;
}
