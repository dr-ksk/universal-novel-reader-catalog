import { CORS_HEADERS, jsonResponse, optionsResponse } from "../../lib/catalog-utils.js";

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet({ params, env }) {
  const file = String(params.file || "");
  if (!file.endsWith(".unr.json")) {
    return jsonResponse({ error: "Not Found" }, 404);
  }

  const adapterId = file.slice(0, -".unr.json".length);
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(adapterId)) {
    return jsonResponse({ error: "不正な adapter_id です" }, 400);
  }

  if (!env.DB) {
    return jsonResponse({ error: "D1 データベース (DB) が未設定です" }, 503);
  }

  try {
    const row = await env.DB.prepare(
      "SELECT package_json FROM community_adapters WHERE adapter_id = ?"
    )
      .bind(adapterId)
      .first();

    if (!row || !row.package_json) {
      return jsonResponse({ error: "指定されたサイト定義が見つかりません" }, 404);
    }

    return new Response(row.package_json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        ...CORS_HEADERS,
      },
    });
  } catch (e) {
    return jsonResponse({ error: `定義の取得に失敗しました: ${e.message}` }, 500);
  }
}
