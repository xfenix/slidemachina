/**
 * Russian texts for a Russian locale, English for any other.
 */
export function pickTextLanguage(languageCode: string): "ru" | "en" {
  return languageCode.toLowerCase().startsWith("ru") ? "ru" : "en";
}
