export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const RESERVED_OFFICIAL_IDS = new Set([
  "syosetu_standard",
  "kakuyomu_standard",
]);

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2) + "\n", {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getClientIpHash(request, salt = "unr-catalog-v1") {
  const rawIp =
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() ||
    "unknown";
  return sha256Hex(`${salt}:${rawIp}`);
}

export function validateAdapterPackage(pkg) {
  const errors = [];
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    return ["JSONオブジェクトではありません"];
  }

  const adapterId = typeof pkg.adapter_id === "string" ? pkg.adapter_id.trim() : "";
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(adapterId)) {
    errors.push("adapter_id は半角英小文字・数字・_・- の2〜64文字で指定してください");
  } else if (RESERVED_OFFICIAL_IDS.has(adapterId)) {
    errors.push(`adapter_id "${adapterId}" は公式予約IDのため別のIDを指定してください`);
  }

  const name = typeof pkg.name === "string" ? pkg.name.trim() : "";
  if (!name || name.length > 80) {
    errors.push("name（サイト名）は1〜80文字で指定してください");
  }

  const version = typeof pkg.version === "string" ? pkg.version.trim() : "";
  if (!version || version.length > 32) {
    errors.push("version は1〜32文字で指定してください");
  }

  const author = typeof pkg.author === "string" ? pkg.author.trim() : "";
  if (author.length > 64) {
    errors.push("author は64文字以内で指定してください");
  }

  const description = typeof pkg.description === "string" ? pkg.description.trim() : "";
  if (description.length > 500) {
    errors.push("description は500文字以内で指定してください");
  }

  const domainPattern = typeof pkg.domain_pattern === "string" ? pkg.domain_pattern.trim() : "";
  if (!domainPattern || domainPattern.length > 300) {
    errors.push("domain_pattern は1〜300文字で指定してください");
  } else {
    const tooBroad = new Set([".*", "^.*$", "^https?://.*", "^https?://.*$", "https?://.*"]);
    if (tooBroad.has(domainPattern)) {
      errors.push("domain_pattern が広すぎます（対象ドメインを明示してください）");
    }
    try {
      new RegExp(domainPattern);
    } catch (e) {
      errors.push(`domain_pattern の正規表現が不正です: ${e.message}`);
    }
  }

  const adapterType = typeof pkg.adapter_type === "string" ? pkg.adapter_type.trim().toLowerCase() : "yaml";
  if (adapterType !== "yaml" && adapterType !== "javascript") {
    errors.push("adapter_type は yaml または javascript を指定してください");
  }

  const content = typeof pkg.content === "string" ? pkg.content.trim() : "";
  if (!content) {
    errors.push("content（定義本体）が空です");
  } else if (content.length > 65536) {
    errors.push("content は64KB以内で指定してください");
  } else if (adapterType === "javascript") {
    if (!content.includes("SiteAdapter")) {
      errors.push("JavaScript 定義には SiteAdapter オブジェクトの記述が必要です");
    }
    if (!content.includes("parseIndex") && !content.includes("parseEpisode")) {
      errors.push("JavaScript 定義には parseIndex または parseEpisode の実装が必要です");
    }
  }

  if (pkg.custom_css != null) {
    if (typeof pkg.custom_css !== "string") {
      errors.push("custom_css は文字列または null で指定してください");
    } else if (pkg.custom_css.length > 16384) {
      errors.push("custom_css は16KB以内で指定してください");
    }
  }

  return errors;
}

export function normalizeAdapterPackage(pkg, nowIso = new Date().toISOString()) {
  const customCss =
    typeof pkg.custom_css === "string" && pkg.custom_css.trim()
      ? pkg.custom_css.trim()
      : null;

  return {
    schema_version: 1,
    adapter_id: pkg.adapter_id.trim(),
    name: pkg.name.trim(),
    version: pkg.version.trim(),
    author: (typeof pkg.author === "string" && pkg.author.trim()) || "anonymous",
    description: (typeof pkg.description === "string" && pkg.description.trim()) || "",
    domain_pattern: pkg.domain_pattern.trim(),
    adapter_type: (pkg.adapter_type || "yaml").trim().toLowerCase(),
    content: pkg.content.trim(),
    custom_css: customCss,
    updated_at: nowIso,
  };
}

export async function verifyTurnstileToken(token, secretKey, remoteIp) {
  if (!secretKey) {
    return { ok: true, skipped: true };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, error: "ボット対策チェック（Turnstile）を完了してください" };
  }
  try {
    const formData = new FormData();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) formData.append("remoteip", remoteIp);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data && data.success) {
      return { ok: true, skipped: false };
    }
    return { ok: false, error: "ボット対策チェックの検証に失敗しました。画面を再読み込みして再試行してください" };
  } catch (e) {
    return { ok: false, error: `ボット対策チェック通信エラー: ${e.message}` };
  }
}
