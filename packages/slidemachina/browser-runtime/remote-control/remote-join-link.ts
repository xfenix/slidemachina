const publishedRemotePageAddress = "https://xfenix.github.io/slidemachina/remote.html";
const loopbackHostnames = new Set(["localhost", "127.0.0.1"]);

// The phone opens the deck's own ?remote page when the address is reachable from another device. A deck opened
// from disk or from a localhost dev server is not, so the phone gets the published remote page instead.
export function buildRemoteJoinLink(hostingCode: string): string {
  const isDeckAddressPhoneReachable = location.protocol.startsWith("http") && !loopbackHostnames.has(location.hostname);
  return isDeckAddressPhoneReachable
    ? `${location.origin}${location.pathname}?remote#${hostingCode}`
    : `${publishedRemotePageAddress}#${hostingCode}`;
}
