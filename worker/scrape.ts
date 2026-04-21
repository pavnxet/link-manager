/** Best-effort fetch of <title> from a URL. */
export async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LinksBot/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let buf = "";
    let bytes = 0;
    while (bytes < 64 * 1024) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      buf += decoder.decode(value, { stream: true });
      const m = buf.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (m) {
        reader.cancel().catch(() => {});
        return decodeEntities(m[1]).trim().slice(0, 200) || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
