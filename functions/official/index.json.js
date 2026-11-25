import { jsonResponse, optionsResponse } from "../../lib/catalog-utils.js";

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const assetUrl = new URL("/official/index.json", origin);

  try {
    const assetRes = await env.ASSETS.fetch(new Request(assetUrl.toString()));
    if (!assetRes.ok) {
      return jsonResponse({ error: "official/index.json が見つかりません" }, 404);
    }
    const data = await assetRes.json();
    if (Array.isArray(data.adapters)) {
      data.adapters = data.adapters.map((item) => ({
        ...item,
        download_url: `${origin}/official/${item.adapter_id}.unr.json`,
      }));
    }
    return jsonResponse(data, 200, { "Cache-Control": "public, max-age=300" });
  } catch (e) {
    return jsonResponse({ error: `公式カタログの読み込みに失敗しました: ${e.message}` }, 500);
  }
}
