/**
 * Russian texts for a Russian locale, English for any other.
 */
export function pickTextLanguage(languageCode: string): "ru" | "en" {
  return languageCode.toLowerCase().startsWith("ru") ? "ru" : "en";
}

const russianPluralRules = new Intl.PluralRules("ru");

// "1 страница", "3 страницы", "5 страниц".
export function pickRussianPlural(itemCount: number, [oneForm, fewForm, manyForm]: [string, string, string]): string {
  const pluralCategory = russianPluralRules.select(itemCount);
  return pluralCategory === "one" ? oneForm : pluralCategory === "few" ? fewForm : manyForm;
}
