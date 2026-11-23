import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { validatePackage } from "./build_catalog.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function decodeUnr1(token) {
  const b64 = token.slice(5).replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const buf = Buffer.from(b64 + pad, "base64");
  const jsonStr = zlib.gunzipSync(buf).toString("utf8");
  return JSON.parse(jsonStr);
}

function extractPackageFromBody(body) {
  if (!body) throw new Error("Issue本文が空です");

  // 1. UNR1:... 共有コードを優先検出
  const unrMatch = body.match(/UNR1:[A-Za-z0-9\-_+/=]+/);
  if (unrMatch) {
    return decodeUnr1(unrMatch[0]);
  }

  // 2. ```json ... ``` コードブロックから抽出
  const codeBlockMatch = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // 3. 生のJSONオブジェクトを抽出
  const firstBrace = body.indexOf("{");
  const lastBrace = body.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(body.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("定義JSONまたは UNR1:... 共有コードが本文に見つかりませんでした");
}

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    throw new Error("GITHUB_EVENT_PATH が見つかりません");
  }

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const issue = event.issue;
  if (!issue) {
    throw new Error("issue イベントではありません");
  }

  const issueBody = issue.body || "";
  const issueUrl = issue.html_url || "";
  const issueAuthor = issue.user?.login || "community";

  const pkg = extractPackageFromBody(issueBody);
  const errors = validatePackage(pkg, { allowJs: false });

  const resultPath = path.join(ROOT, ".submission_result.json");
  if (errors.length > 0) {
    fs.writeFileSync(
      resultPath,
      JSON.stringify({ ok: false, errors }, null, 2) + "\n",
      "utf8"
    );
    console.error("Validation failed:", errors);
    process.exit(0);
  }

  // 既存公式IDとの衝突を防止
  const officialPath = path.join(ROOT, "official", `${pkg.adapter_id}.unr.json`);
  if (fs.existsSync(officialPath)) {
    fs.writeFileSync(
      resultPath,
      JSON.stringify(
        {
          ok: false,
          errors: [
            `adapter_id "${pkg.adapter_id}" は公式定義で使用されています。別の adapter_id（例: ${pkg.adapter_id}_custom）を指定してください。`,
          ],
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    process.exit(0);
  }

  const normalized = {
    schema_version: 1,
    adapter_id: pkg.adapter_id.trim(),
    name: pkg.name.trim(),
    version: pkg.version.trim(),
    author: (pkg.author || issueAuthor).trim(),
    description: (pkg.description || "").trim(),
    domain_pattern: pkg.domain_pattern.trim(),
    adapter_type: "yaml",
    content: pkg.content,
    custom_css: pkg.custom_css || null,
    discussion_url: issueUrl || pkg.discussion_url || null,
    updated_at: new Date().toISOString(),
  };

  const communityDir = path.join(ROOT, "community");
  fs.mkdirSync(communityDir, { recursive: true });
  const outFile = path.join(communityDir, `${normalized.adapter_id}.unr.json`);
  fs.writeFileSync(outFile, JSON.stringify(normalized, null, 2) + "\n", "utf8");

  fs.writeFileSync(
    resultPath,
    JSON.stringify(
      {
        ok: true,
        adapter_id: normalized.adapter_id,
        name: normalized.name,
        version: normalized.version,
        file: `community/${normalized.adapter_id}.unr.json`,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`Saved ${outFile}`);
}

main();
