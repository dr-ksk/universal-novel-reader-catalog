import {
  getClientIpHash,
  jsonResponse,
  optionsResponse,
  sha256Hex,
} from "../../../lib/catalog-utils.js";

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return jsonResponse({ ok: false, error: "D1 データベース (DB) が未設定です" }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "JSON の形式が不正です" }, 400);
  }

  const adapterId = typeof body?.adapter_id === "string" ? body.adapter_id.trim() : "";
  const voteType = body?.vote_type === "report" ? "report" : "like";
  const clientId = typeof body?.client_id === "string" ? body.client_id.trim().slice(0, 64) : "web";

  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(adapterId)) {
    return jsonResponse({ ok: false, error: "不正な adapter_id です" }, 400);
  }

  try {
    const adapter = await env.DB.prepare(
      "SELECT adapter_id FROM community_adapters WHERE adapter_id = ?"
    )
      .bind(adapterId)
      .first();

    if (!adapter) {
      return jsonResponse({ ok: false, error: "対象のサイト定義が見つかりません" }, 404);
    }

    const ipHash = await getClientIpHash(request, env.HASH_SALT || "unr-catalog-v1");
    const voterHash = await sha256Hex(`${ipHash}:${clientId}`);

    const existingVote = await env.DB.prepare(
      "SELECT 1 FROM adapter_votes WHERE adapter_id = ? AND voter_hash = ? AND vote_type = ?"
    )
      .bind(adapterId, voterHash, voteType)
      .first();

    const column = voteType === "report" ? "reports" : "likes";
    let voted;

    if (existingVote) {
      await env.DB.batch([
        env.DB.prepare(
          "DELETE FROM adapter_votes WHERE adapter_id = ? AND voter_hash = ? AND vote_type = ?"
        ).bind(adapterId, voterHash, voteType),
        env.DB.prepare(
          `UPDATE community_adapters SET ${column} = MAX(0, ${column} - 1) WHERE adapter_id = ?`
        ).bind(adapterId),
      ]);
      voted = false;
    } else {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO adapter_votes (adapter_id, voter_hash, vote_type, created_at) VALUES (?, ?, ?, ?)"
        ).bind(adapterId, voterHash, voteType, new Date().toISOString()),
        env.DB.prepare(
          `UPDATE community_adapters SET ${column} = ${column} + 1 WHERE adapter_id = ?`
        ).bind(adapterId),
      ]);
      voted = true;
    }

    const counts = await env.DB.prepare(
      "SELECT likes, reports FROM community_adapters WHERE adapter_id = ?"
    )
      .bind(adapterId)
      .first();

    return jsonResponse({
      ok: true,
      adapter_id: adapterId,
      vote_type: voteType,
      voted,
      likes: Number(counts?.likes || 0),
      reports: Number(counts?.reports || 0),
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: `評価の更新に失敗しました: ${e.message}` }, 500);
  }
}
