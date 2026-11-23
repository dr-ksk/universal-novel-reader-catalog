import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASE_PAGES_URL = "https://dr-ksk.github.io/universal-novel-reader-catalog";

const CHANNELS = [
  { dir: "official", channel: "official", title: "万能小説 公式サイト定義" },
  { dir: "community", channel: "community", title: "万能小説 野良（コミュニティ）サイト定義" },
];

export function validatePackage(pkg, { allowJs = false } = {}) {
  const errors = [];
  if (!pkg || typeof pkg !== "object") {
    return ["JSONオブジェクトではありません"];
  }
  if (!pkg.adapter_id || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(pkg.adapter_id)) {
    errors.push("adapter_id は半角英小文字・数字・_・- の2〜64文字で指定してください");
  }
  if (!pkg.name || typeof pkg.name !== "string" || !pkg.name.trim()) {
    errors.push("name（サイト名）が空です");
  }
  if (!pkg.version || typeof pkg.version !== "string" || !pkg.version.trim()) {
    errors.push("version が空です");
  }
  if (!pkg.domain_pattern || typeof pkg.domain_pattern !== "string") {
    errors.push("domain_pattern が空です");
  } else {
    const trimmed = pkg.domain_pattern.trim();
    if (trimmed === ".*" || trimmed === "^https?://.*" || trimmed === "^https?://.*$") {
      errors.push("domain_pattern が広すぎます（対象ドメインを明示してください）");
    }
    try {
      new RegExp(trimmed);
    } catch (e) {
      errors.push(`domain_pattern の正規表現が不正です: ${e.message}`);
    }
  }
  const type = (pkg.adapter_type || "yaml").toLowerCase();
  if (type !== "yaml" && type !== "javascript") {
    errors.push("adapter_type は yaml または javascript を指定してください");
  }
  if (type === "javascript" && !allowJs) {
    errors.push("野良カタログの自動公開はセキュリティ保護のため YAML 形式のみ対応しています（JS形式は管理者の手動レビューが必要です）");
  }
  if (!pkg.content || typeof pkg.content !== "string" || !pkg.content.trim()) {
    errors.push("content（定義本体）が空です");
  }
  return errors;
}

function buildChannel({ dir, channel, title }) {
  const folder = path.join(ROOT, dir);
  fs.mkdirSync(folder, { recursive: true });

  const files = fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".unr.json"))
    .sort();

  const adapters = [];
  for (const file of files) {
    const fullPath = path.join(folder, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const pkg = JSON.parse(raw);
    const errors = validatePackage(pkg, { allowJs: channel === "official" });
    if (errors.length > 0) {
      throw new Error(`Validation failed for ${dir}/${file}:\n- ${errors.join("\n- ")}`);
    }

    adapters.push({
      adapter_id: pkg.adapter_id,
      name: pkg.name.trim(),
      version: pkg.version.trim(),
      author: (pkg.author || (channel === "official" ? "official" : "community")).trim(),
      description: (pkg.description || "").trim(),
      domain_pattern: pkg.domain_pattern.trim(),
      adapter_type: (pkg.adapter_type || "yaml").toLowerCase(),
      updated_at: pkg.updated_at || new Date().toISOString(),
      download_url: `${BASE_PAGES_URL}/${dir}/${file}`,
      discussion_url: pkg.discussion_url || null,
    });
  }

  const catalog = {
    catalog_version: 1,
    channel,
    name: title,
    updated_at: new Date().toISOString(),
    adapters,
  };

  const outPath = path.join(folder, "index.json");
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(`Built ${dir}/index.json (${adapters.length} adapters)`);
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("build_catalog.mjs")) {
  for (const ch of CHANNELS) {
    buildChannel(ch);
  }
}
