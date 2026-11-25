import { jsonResponse, optionsResponse } from "../../lib/catalog-utils.js";

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;

  if (!env.DB) {
    return jsonResponse({
      catalog_version: 1,
      channel: "community",
      name: "万能小説 野良（コミュニティ）サイト定義",
      updated_at: new Date().toISOString(),
      adapters: [],
      notice: "D1 データベース (DB) がまだバインドされていません。",
    });
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT adapter_id, name, version, author, description, domain_pattern, adapter_type,
              likes, reports, updated_at
         FROM community_adapters
        ORDER BY likes DESC, updated_at DESC
        LIMIT 200`
    ).all();

    const adapters = (results || []).map((row) => ({
      adapter_id: row.adapter_id,
      name: row.name,
      version: row.version,
      author: row.author || "anonymous",
      description: row.description || "",
      domain_pattern: row.domain_pattern,
      adapter_type: row.adapter_type || "yaml",
      updated_at: row.updated_at,
      download_url: `${origin}/community/${encodeURIComponent(row.adapter_id)}.unr.json`,
      discussion_url: null,
      likes: Number(row.likes || 0),
      reports: Number(row.reports || 0),
      comments: 0,
    }));

    return jsonResponse({
      catalog_version: 1,
      channel: "community",
      name: "万能小説 野良（コミュニティ）サイト定義",
      updated_at: adapters[0]?.updated_at || new Date().toISOString(),
      adapters,
    });
  } catch (e) {
    return jsonResponse(
      {
        error: "野良カタログの取得に失敗しました（D1 の schema.sql が実行済みか確認してください）",
        detail: e.message,
      },
      500
    );
  }
}
