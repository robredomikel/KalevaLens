import { createHash } from "crypto";

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeUrl(raw?: string | null) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"].forEach((key) =>
      url.searchParams.delete(key)
    );
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function canonicalArticleId(input: { internalId?: string; guid?: string; url?: string; source?: string; title?: string }) {
  if (input.internalId && !input.url && !input.guid) return `internal:${input.internalId}`;
  const stable = input.guid || normalizeUrl(input.url) || `${input.source || "unknown"}:${(input.title || "").trim().toLowerCase()}`;
  return `external:${digest(stable).slice(0, 32)}`;
}

export function articleVersion(input: { title?: string; summary?: string; content?: string; updatedAt?: string | Date | null }) {
  // Version only the approved content. Database timestamps can change during
  // reconciliation and must not create duplicate generations.
  return digest(JSON.stringify([input.title || "", input.summary || "", input.content || ""])).slice(0, 24);
}
