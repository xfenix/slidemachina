export function escapeHtml(plainText: unknown): string {
  return String(plainText).replace(/[&<>"']/g, (specialCharacter) => `&#${specialCharacter.charCodeAt(0)};`);
}
