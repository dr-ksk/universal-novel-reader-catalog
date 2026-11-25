import {
  getClientIpHash,
  jsonResponse,
  normalizeAdapterPackage,
  optionsResponse,
  sha256Hex,
  validateAdapterPackage,
  verifyTurnstileToken,
} from "../../../lib/catalog-utils.js";

const MAX_BODY_BYTES = 100 * 1024;
const RATE_LIMIT_WINDOW_SEC = 3600;
const RATE_LIMIT_MAX_SUBMISSIONS = 10;

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return jsonResponse(
      { ok: false, errors: ["サーバーの D1 データベース (DB) がまだバインドされていません。"] },
      503
    );
  }

  const rawText = await request.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return jsonResponse(
      { ok: false, errors: ["送信データが大きすぎます（100KB以内にしてください）。"] },
      413
    );
  }

  let body;
  try {
    body = JSON.parse(rawText);
  } catch {
    return jsonResponse({ ok: false, errors: ["JSON の形式が不正です。"] }, 400);
  }

  const rawPkg = body && typeof body === "object" && body.package ? body.package : body;
  const editPasscode = typeof body?.edit_passcode === "string" ? body.edit_passcode.trim() : "";
  const turnstileToken = typeof body?.turnstile_token === "string" ? body.turnstile_token.trim() : "";

  // 1. Bot 対策（Turnstile が設定されている場合のみ検証）
  const remoteIp = request.headers.get("CF-Connecting-IP") || "";
  const turnstile = await verifyTurnstileToken(turnstileToken, env.TURNSTILE_SECRET_KEY, remoteIp);
  if (!turnstile.ok) {
    return jsonResponse({ ok: false, errors: [turnstile.error] }, 403);
  }

  // 2. パッケージ検証
  const errors = validateAdapterPackage(rawPkg);
  if (errors.length > 0) {
    return jsonResponse({ ok: false, errors }, 400);
  }

  const nowIso = new Date().toISOString();
  const normalized = normalizeAdapterPackage(rawPkg, nowIso);
  const ipHash = await getClientIpHash(request, env.HASH_SALT || "unr-catalog-v1");
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    // 3. レート制限（1時間あたり10件まで）
    const windowStart = nowSec - RATE_LIMIT_WINDOW_SEC;
    const rateRow = await env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM submission_logs WHERE ip_hash = ? AND created_at >= ?"
    )
      .bind(ipHash, windowStart)
      .first();

    if (Number(rateRow?.cnt || 0) >= RATE_LIMIT_MAX_SUBMISSIONS) {
      return jsonResponse(
        {
          ok: false,
          errors: ["短時間に投稿が集中しています。しばらく待ってから再度お試しください。"],
        },
        429
      );
    }

    // 4. 既存IDの重複／更新権限チェック
    const existing = await env.DB.prepare(
      "SELECT adapter_id, edit_token_hash FROM community_adapters WHERE adapter_id = ?"
    )
      .bind(normalized.adapter_id)
      .first();

    const passcodeHash = editPasscode
      ? await sha256Hex(`${normalized.adapter_id}:${editPasscode}`)
      : null;

    const packageJson = JSON.stringify(normalized, null, 2) + "\n";
    let action = "created";

    if (existing) {
      if (!existing.edit_token_hash || !passcodeHash || existing.edit_token_hash !== passcodeHash) {
        return jsonResponse(
          {
            ok: false,
            errors: [
              `定義ID「${normalized.adapter_id}」は既に登録されています。別の定義IDにするか、初回投稿時に設定した編集パスコードを入力してください。`,
            ],
          },
          409
        );
      }

      await env.DB.prepare(
        `UPDATE community_adapters
            SET name = ?, version = ?, author = ?, description = ?,
                domain_pattern = ?, adapter_type = ?, package_json = ?, updated_at = ?
          WHERE adapter_id = ?`
      )
        .bind(
          normalized.name,
          normalized.version,
          normalized.author,
          normalized.description,
          normalized.domain_pattern,
          normalized.adapter_type,
          packageJson,
          nowIso,
          normalized.adapter_id
        )
        .run();
      action = "updated";
    } else {
      await env.DB.prepare(
        `INSERT INTO community_adapters (
           adapter_id, name, version, author, description, domain_pattern,
           adapter_type, package_json, edit_token_hash, likes, reports, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
      )
        .bind(
          normalized.adapter_id,
          normalized.name,
          normalized.version,
          normalized.author,
          normalized.description,
          normalized.domain_pattern,
          normalized.adapter_type,
          packageJson,
          passcodeHash,
          nowIso,
          nowIso
        )
        .run();
    }

    // 5. レート制限ログ記録（24時間以上前の古いログも掃除）
    await env.DB.batch([
      env.DB.prepare("INSERT INTO submission_logs (ip_hash, created_at) VALUES (?, ?)").bind(
        ipHash,
        nowSec
      ),
      env.DB.prepare("DELETE FROM submission_logs WHERE created_at < ?").bind(nowSec - 86400),
    ]);

    const origin = new URL(request.url).origin;
    return jsonResponse({
      ok: true,
      action,
      adapter_id: normalized.adapter_id,
      name: normalized.name,
      version: normalized.version,
      download_url: `${origin}/community/${encodeURIComponent(normalized.adapter_id)}.unr.json`,
    });
  } catch (e) {
    return jsonResponse(
      { ok: false, errors: [`保存中にエラーが発生しました: ${e.message}`] },
      500
    );
  }
}
