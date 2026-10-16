/** Capture once into component memory. Never persist tokens or accept query/path credentials. */
export function readAndClearAccountEmailToken(
  location: Pick<Location, "hash" | "pathname" | "search">,
  history: Pick<History, "replaceState" | "state">,
): string | null {
  const fragment = location.hash;
  const hasQuery = location.search !== "";
  history.replaceState(history.state, "", location.pathname);
  const params = new URLSearchParams(fragment.slice(1));
  const token = params.get("token");
  return !hasQuery && [...params.keys()].length === 1 && token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
