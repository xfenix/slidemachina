/**
 * Russian texts for a Russian locale, English for any other.
 * @param {string} languageCode
 * @returns {"ru" | "en"}
 */
export function pickTextLanguage(languageCode) {
  return languageCode.toLowerCase().startsWith("ru") ? "ru" : "en";
}
