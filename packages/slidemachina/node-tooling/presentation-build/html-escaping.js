/** @param {unknown} plainText */
export function escapeHtml(plainText) {
  return String(plainText).replace(/[&<>"']/g, (specialCharacter) => `&#${specialCharacter.charCodeAt(0)};`);
}
