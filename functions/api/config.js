import { jsonResponse, optionsResponse } from "../../lib/catalog-utils.js";

export function onRequestOptions() {
  return optionsResponse();
}

export function onRequestGet({ env }) {
  const turnstileSiteKey = env.TURNSTILE_SITE_KEY || null;
  const turnstileEnabled = Boolean(turnstileSiteKey && env.TURNSTILE_SECRET_KEY);

  return jsonResponse({
    ok: true,
    platform: "cloudflare-pages",
    db_configured: Boolean(env.DB),
    turnstile_enabled: turnstileEnabled,
    turnstile_site_key: turnstileEnabled ? turnstileSiteKey : null,
  });
}
