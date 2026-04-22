import { useApp } from "@/state/store";
import { DICT, type DictKey, type Lang } from "./dict";
import { pt } from "./locales/pt";
import { fr } from "./locales/fr";
import { it } from "./locales/it";

export type { Lang, DictKey } from "./dict";
export { LANG_LABELS } from "./dict";

/**
 * Per-language partial overlay merged on top of EN.
 * - EN is the source of truth (always complete).
 * - ES is a complete native translation (overrides EN entirely).
 * - PT/FR/IT are partial overlays under src/lib/i18n/locales/*.ts;
 *   any key not yet translated falls back to the English string.
 */
const OVERLAYS: Partial<Record<Lang, Partial<Record<DictKey, string>>>> = {
  pt,
  fr,
  it,
};

function pickDict(lang: Lang): Record<DictKey, string> {
  if (lang === "es") return DICT.es as unknown as Record<DictKey, string>;
  const overlay = OVERLAYS[lang];
  if (!overlay) return DICT.en as unknown as Record<DictKey, string>;
  // Merge overlay over EN base. Build once per call; cheap enough at typical usage.
  return { ...(DICT.en as unknown as Record<DictKey, string>), ...overlay } as Record<DictKey, string>;
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

/** Map our app lang code to a BCP-47 locale tag for Intl APIs. */
const LOCALE_TAG: Record<Lang, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  it: "it-IT",
};

/** Format a number using the active language's locale (thousands/decimal separators). */
export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  const lang = getLang();
  try {
    return new Intl.NumberFormat(LOCALE_TAG[lang], options).format(n);
  } catch {
    return String(n);
  }
}

/** Reactive variant of formatNumber for components that already use useT. */
export function useFormatNumber() {
  const lang = useApp((s) => s.settings.lang);
  return (n: number, options?: Intl.NumberFormatOptions): string => {
    try {
      return new Intl.NumberFormat(LOCALE_TAG[lang as Lang], options).format(n);
    } catch {
      return String(n);
    }
  };
}
