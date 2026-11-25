const REPO_OWNER = "dr-ksk";
const REPO_NAME = "universal-novel-reader-catalog";
const ISSUE_NEW_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/issues/new`;

const state = {
  channel: "official",
  catalogs: { official: [], community: [] },
  search: "",
};

const $ = (id) => document.getElementById(id);

function showToast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

async function encodeUnr1(pkg) {
  const json = JSON.stringify(pkg);
  if (typeof CompressionStream === "undefined") {
    return json;
  }
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `UNR1:${b64}`;
}

async function decodeUnr1(text) {
  const trimmed = text.trim();
  const unrMatch = trimmed.match(/UNR1:[A-Za-z0-9\-_+/=]+/);
  if (unrMatch) {
    const b64 = unrMatch[0].slice(5).replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const jsonText = await new Response(stream).text();
    return JSON.parse(jsonText);
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1));
  }
  throw new Error("有効な JSON または UNR1:... コードが見つかりません");
}

function escapeYaml(str) {
  return String(str || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildYamlFromForm() {
  const id = $("f-id").value.trim() || "custom_site";
  const name = $("f-name").value.trim() || "カスタムサイト";
  const version = $("f-version").value.trim() || "1.0.0";
  const domain = $("f-domain").value.trim();
  const ua = $("h-ua").value.trim();
  const cookie = $("h-cookie").value.trim();

  const idxTitle = $("idx-title").value.trim();
  const idxAuthor = $("idx-author").value.trim();
  const idxAuthorRegex = $("idx-author-regex").value.trim();
  const idxSynopsis = $("idx-synopsis").value.trim();
  const idxEpContainer = $("idx-ep-container").value.trim();
  const idxEpTitle = $("idx-ep-title").value.trim();
  const idxEpUrl = $("idx-ep-url").value.trim();
  const idxEpChapter = $("idx-ep-chapter").value.trim();
  const idxEpUpdated = $("idx-ep-updated").value.trim();
  const idxNextPage = $("idx-next-page").value.trim();

  const epTitle = $("ep-title").value.trim();
  const epContent = $("ep-content").value.trim();
  const epRemove = $("ep-remove").value.trim();
  const epImages = $("ep-images").value.trim();

  const lines = [];
  lines.push("metadata:");
  lines.push(`  id: "${escapeYaml(id)}"`);
  lines.push(`  name: "${escapeYaml(name)}"`);
  lines.push(`  version: "${escapeYaml(version)}"`);
  lines.push(`  domain_pattern: "${escapeYaml(domain)}"`);
  lines.push("");

  lines.push("headers:");
  if (ua) lines.push(`  User-Agent: "${escapeYaml(ua)}"`);
  if (cookie) lines.push(`  Cookie: "${escapeYaml(cookie)}"`);
  lines.push("");

  lines.push("index:");
  if (idxTitle) lines.push(`  title: "${escapeYaml(idxTitle)}"`);
  if (idxAuthor) {
    if (idxAuthorRegex) {
      lines.push("  author:");
      lines.push(`    selector: "${escapeYaml(idxAuthor)}"`);
      lines.push(`    regex_replace: ["${escapeYaml(idxAuthorRegex)}", ""]`);
    } else {
      lines.push(`  author: "${escapeYaml(idxAuthor)}"`);
    }
  }
  if (idxSynopsis) lines.push(`  synopsis: "${escapeYaml(idxSynopsis)}"`);
  lines.push("  episodes:");
  if (idxEpContainer) lines.push(`    container: "${escapeYaml(idxEpContainer)}"`);
  if (idxEpTitle) lines.push(`    title: "${escapeYaml(idxEpTitle)}"`);
  if (idxEpUrl) lines.push(`    url: "${escapeYaml(idxEpUrl)}"`);
  if (idxEpChapter) lines.push(`    chapter: "${escapeYaml(idxEpChapter)}"`);
  if (idxEpUpdated) lines.push(`    updated_at: "${escapeYaml(idxEpUpdated)}"`);
  if (idxNextPage) lines.push(`  next_page_url: "${escapeYaml(idxNextPage)}"`);
  lines.push("");

  lines.push("episode:");
  if (epTitle) lines.push(`  title: "${escapeYaml(epTitle)}"`);
  if (epContent) lines.push(`  content: "${escapeYaml(epContent)}"`);
  if (epRemove) lines.push(`  remove: "${escapeYaml(epRemove)}"`);
  if (epImages) lines.push(`  images: "${escapeYaml(epImages)}"`);
  lines.push("");

  lines.push("crawl:");
  lines.push("  interval_ms: 1500");
  lines.push("  cache_images: true");

  return lines.join("\n");
}

function buildPackageFromForm() {
  return {
    schema_version: 1,
    adapter_id: $("f-id").value.trim() || "custom_site",
    name: $("f-name").value.trim() || "カスタムサイト",
    version: $("f-version").value.trim() || "1.0.0",
    author: $("f-author").value.trim() || "community",
    description: $("f-desc").value.trim(),
    domain_pattern: $("f-domain").value.trim(),
    adapter_type: "yaml",
    content: buildYamlFromForm(),
    custom_css: $("f-css").value.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function refreshYamlPreview() {
  $("yaml-preview").textContent = buildYamlFromForm();
}

// ==================== カタログ読み込み・描画 ====================
async function loadCatalogs() {
  for (const ch of ["official", "community"]) {
    try {
      const res = await fetch(`./${ch}/index.json?t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.catalogs[ch] = Array.isArray(data.adapters) ? data.adapters : [];
    } catch (e) {
      state.catalogs[ch] = [];
      console.warn(`Failed to load ${ch}/index.json:`, e);
    }
  }
  $("count-official").textContent = String(state.catalogs.official.length);
  $("count-community").textContent = String(state.catalogs.community.length);
  renderCatalog();
}

function renderCatalog() {
  const grid = $("catalog-grid");
  const notice = $("catalog-notice");
  const list = state.catalogs[state.channel] || [];
  const q = state.search.trim().toLowerCase();

  const filtered = list.filter((item) => {
    if (!q) return true;
    return [item.name, item.adapter_id, item.description, item.author, item.domain_pattern]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });

  if (state.channel === "community") {
    notice.hidden = false;
    notice.innerHTML =
      '野良カタログはユーザー投稿（GitHub Issues）から自動生成されます。新しいサイトを追加したい場合は「<strong>サイト定義ビルダー</strong>」タブから作成して投稿できます。';
  } else {
    notice.hidden = true;
  }

  grid.innerHTML = "";
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card muted";
    empty.textContent =
      state.channel === "community" && list.length === 0
        ? "まだ野良サイト定義の投稿がありません。「サイト定義ビルダー」から最初の定義を投稿してみましょう！"
        : "条件に一致するサイト定義が見つかりませんでした。";
    grid.appendChild(empty);
    return;
  }

  for (const item of filtered) {
    const card = document.createElement("article");
    card.className = "card adapter-card";

    const typeClass = item.adapter_type === "javascript" ? "badge-js" : "badge-yaml";
    card.innerHTML = `
      <div class="adapter-head">
        <h3 class="adapter-title"></h3>
        <div class="badges">
          <span class="badge ${typeClass}">${(item.adapter_type || "yaml").toUpperCase()}</span>
          <span class="badge badge-ver">v${item.version || "1.0.0"}</span>
        </div>
      </div>
      <div class="meta-line desc-line"></div>
      <div class="meta-line mono pattern-line"></div>
      <div class="meta-line author-line"></div>
      <div class="adapter-actions"></div>
    `;
    card.querySelector(".adapter-title").textContent = item.name;
    card.querySelector(".desc-line").textContent = item.description || "説明なし";
    card.querySelector(".pattern-line").textContent = item.domain_pattern;
    card.querySelector(".author-line").textContent = `ID: ${item.adapter_id} / 作者: ${item.author || "-"}`;

    const actions = card.querySelector(".adapter-actions");

    const btnCopy = document.createElement("button");
    btnCopy.className = "btn btn-primary btn-sm";
    btnCopy.textContent = "共有コードをコピー";
    btnCopy.onclick = async () => {
      try {
        const pkg = await fetchPackageForItem(item);
        const code = await encodeUnr1(pkg);
        await navigator.clipboard.writeText(code);
        showToast(`${item.name} の共有コードをコピーしました`);
      } catch (e) {
        showToast(`取得失敗: ${e.message}`);
      }
    };
    actions.appendChild(btnCopy);

    const btnDl = document.createElement("button");
    btnDl.className = "btn btn-secondary btn-sm";
    btnDl.textContent = ".unr.json";
    btnDl.onclick = async () => {
      try {
        const pkg = await fetchPackageForItem(item);
        downloadJson(pkg, `${pkg.adapter_id}.unr.json`);
      } catch (e) {
        showToast(`ダウンロード失敗: ${e.message}`);
      }
    };
    actions.appendChild(btnDl);

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn btn-outline btn-sm";
    btnEdit.textContent = "ビルダーで開く";
    btnEdit.onclick = async () => {
      try {
        const pkg = await fetchPackageForItem(item);
        loadPackageIntoBuilder(pkg);
        switchTab("builder");
        showToast(`${item.name} をビルダーに読み込みました`);
      } catch (e) {
        showToast(`読み込み失敗: ${e.message}`);
      }
    };
    actions.appendChild(btnEdit);

    if (item.discussion_url) {
      const link = document.createElement("a");
      link.className = "btn btn-outline btn-sm";
      link.href = item.discussion_url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "掲示板を見る";
      actions.appendChild(link);
    }

    grid.appendChild(card);
  }
}

async function fetchPackageForItem(item) {
  const relative = `./${state.channel}/${item.adapter_id}.unr.json?t=${Date.now()}`;
  const res = await fetch(relative);
  if (res.ok) return await res.json();
  const fallback = await fetch(item.download_url);
  if (!fallback.ok) throw new Error(`HTTP ${fallback.status}`);
  return await fallback.json();
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2) + "\n"], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ==================== ブラウザ内 DOMParser 抽出テスト ====================
function extractByRule(root, rule, defaultAttr = null) {
  if (!rule) return null;
  for (const rawPart of rule.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    let sel = part;
    let attr = defaultAttr;
    if (part.includes("@")) {
      const idx = part.lastIndexOf("@");
      sel = part.slice(0, idx).trim();
      attr = part.slice(idx + 1).trim();
    }
    try {
      const el = sel ? root.querySelector(sel) : root;
      if (!el) continue;
      const val = attr ? el.getAttribute(attr) : el.textContent;
      if (val && val.trim()) return val.trim();
    } catch {
      continue;
    }
  }
  return null;
}

function runIndexTest() {
  const html = $("test-index-html").value;
  const out = $("test-index-result");
  out.hidden = false;
  if (!html.trim()) {
    out.className = "test-result err";
    out.textContent = "目次ページのHTMLを貼り付けてください。";
    return;
  }
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = extractByRule(doc, $("idx-title").value.trim()) || doc.title || "（未取得）";
    let author = extractByRule(doc, $("idx-author").value.trim()) || "（未取得）";
    const authorRegex = $("idx-author-regex").value.trim();
    if (authorRegex && author !== "（未取得）") {
      author = author.replace(new RegExp(authorRegex), "").trim();
    }
    const synopsis = extractByRule(doc, $("idx-synopsis").value.trim()) || "（未取得）";
    const containerSel = $("idx-ep-container").value.trim();
    const epTitleSel = $("idx-ep-title").value.trim() || "a";
    const epUrlSel = $("idx-ep-url").value.trim() || "a @href";

    const nodes = containerSel ? Array.from(doc.querySelectorAll(containerSel)) : [];
    const eps = [];
    for (const node of nodes) {
      const t = extractByRule(node, epTitleSel) || "";
      const u = extractByRule(node, epUrlSel, "href") || "";
      if (u) eps.push({ title: t || "(無題)", url: u });
    }
    const nextPage = extractByRule(doc, $("idx-next-page").value.trim(), "href");

    out.className = eps.length > 0 ? "test-result ok" : "test-result err";
    const lines = [
      `作品名: ${title}`,
      `作者: ${author}`,
      `あらすじ: ${synopsis.slice(0, 80)}${synopsis.length > 80 ? "…" : ""}`,
      `取得できた話数: ${eps.length} 話`,
      nextPage ? `次ページURL: ${nextPage}` : "次ページURL: なし",
    ];
    if (eps.length > 0) {
      lines.push("", "先頭5話:");
      eps.slice(0, 5).forEach((e, i) => lines.push(`  ${i + 1}. ${e.title}  (${e.url})`));
    } else {
      lines.push("", "※ episodes.container または episodes.url のセレクタを見直してください。");
    }
    out.textContent = lines.join("\n");
  } catch (e) {
    out.className = "test-result err";
    out.textContent = `テストエラー: ${e.message}`;
  }
}

function runEpisodeTest() {
  const html = $("test-episode-html").value;
  const out = $("test-episode-result");
  out.hidden = false;
  if (!html.trim()) {
    out.className = "test-result err";
    out.textContent = "本文ページのHTMLを貼り付けてください。";
    return;
  }
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = extractByRule(doc, $("ep-title").value.trim()) || doc.title || "（未取得）";
    const removeSel = $("ep-remove").value.trim();
    if (removeSel) {
      doc.querySelectorAll(removeSel).forEach((el) => el.remove());
    }
    const contentSel = $("ep-content").value.trim();
    const contentEl = contentSel ? doc.querySelector(contentSel) : doc.body;
    const text = contentEl ? contentEl.textContent.trim().replace(/\s+\n/g, "\n") : "";
    const imgs = [];
    const imgSel = $("ep-images").value.trim();
    if (contentEl && imgSel) {
      for (const part of imgSel.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const [sel, attr = "src"] = trimmed.includes("@")
          ? [trimmed.slice(0, trimmed.lastIndexOf("@")).trim(), trimmed.slice(trimmed.lastIndexOf("@") + 1).trim()]
          : [trimmed, "src"];
        contentEl.querySelectorAll(sel).forEach((el) => {
          const v = el.getAttribute(attr);
          if (v && !imgs.includes(v)) imgs.push(v);
        });
      }
    }

    out.className = text.length > 0 ? "test-result ok" : "test-result err";
    out.textContent = [
      `話タイトル: ${title}`,
      `本文文字数: ${text.length} 文字 / 挿絵: ${imgs.length} 件`,
      "",
      "本文プレビュー（先頭240文字）:",
      text ? text.slice(0, 240) + (text.length > 240 ? "…" : "") : "（本文を取得できませんでした。content セレクタを確認してください）",
    ].join("\n");
  } catch (e) {
    out.className = "test-result err";
    out.textContent = `テストエラー: ${e.message}`;
  }
}

// ==================== ビルダーへの既存パッケージ読み込み ====================
function loadPackageIntoBuilder(pkg) {
  $("f-name").value = pkg.name || "";
  $("f-id").value = pkg.adapter_id || "";
  $("f-version").value = pkg.version || "1.0.0";
  $("f-author").value = pkg.author || "";
  $("f-desc").value = pkg.description || "";
  $("f-domain").value = pkg.domain_pattern || "";
  $("f-css").value = pkg.custom_css || "";

  const yaml = pkg.content || "";
  const pick = (key) => {
    const m = yaml.match(new RegExp(`^\\s*${key}:\\s*"([^"]*)"`, "m"));
    return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : "";
  };
  const idxBlock = (yaml.match(/^index:\n([\s\S]*?)(?=^\S|\Z)/m) || [])[1] || "";
  const epBlock = (yaml.match(/^episode:\n([\s\S]*?)(?=^\S|\Z)/m) || [])[1] || "";
  const pickFrom = (block, key) => {
    const m = block.match(new RegExp(`^\\s*${key}:\\s*"([^"]*)"`, "m"));
    return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : "";
  };

  $("h-ua").value = pick("User-Agent") || $("h-ua").value;
  $("h-cookie").value = pick("Cookie");

  $("idx-title").value = pickFrom(idxBlock, "title");
  $("idx-author").value = pickFrom(idxBlock, "selector") || pickFrom(idxBlock, "author");
  $("idx-synopsis").value = pickFrom(idxBlock, "synopsis");
  $("idx-ep-container").value = pickFrom(idxBlock, "container");
  $("idx-ep-title").value = pickFrom(idxBlock, "title") === $("idx-title").value
    ? (idxBlock.match(/episodes:[\s\S]*?title:\s*"([^"]*)"/) || [])[1] || ""
    : pickFrom(idxBlock, "title");
  $("idx-ep-url").value = pickFrom(idxBlock, "url");
  $("idx-ep-chapter").value = pickFrom(idxBlock, "chapter");
  $("idx-ep-updated").value = pickFrom(idxBlock, "updated_at");
  $("idx-next-page").value = pickFrom(idxBlock, "next_page_url");

  $("ep-title").value = pickFrom(epBlock, "title");
  $("ep-content").value = pickFrom(epBlock, "content");
  $("ep-remove").value = pickFrom(epBlock, "remove");
  $("ep-images").value = pickFrom(epBlock, "images");

  refreshYamlPreview();
}

function generateRegexFromUrl(urlStr) {
  const u = new URL(urlStr);
  const hostEscaped = u.host.replace(/\./g, "\\.");
  const parts = u.pathname.split("/").filter(Boolean);
  let pathPattern = "/";
  if (parts.length >= 2) {
    const seg0 = parts[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const seg1 = /^\d+$/.test(parts[1]) ? "\\d+" : "[a-zA-Z0-9_-]+";
    pathPattern = `/${seg0}/${seg1}(/.*)?`;
  } else if (parts.length === 1) {
    const seg0 = /^\d+$/.test(parts[0]) ? "\\d+" : "[a-zA-Z0-9_-]+";
    pathPattern = `/${seg0}(/.*)?`;
  } else {
    pathPattern = "/.*";
  }
  return `^https?://${hostEscaped}${pathPattern}$`;
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabName}`));
}

function setupEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll(".channel-pills .pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      state.channel = pill.dataset.channel;
      document.querySelectorAll(".channel-pills .pill").forEach((p) => p.classList.toggle("active", p === pill));
      renderCatalog();
    });
  });

  $("catalog-search").addEventListener("input", (e) => {
    state.search = e.target.value;
    renderCatalog();
  });

  document.querySelectorAll("[data-test-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.testMode;
      document.querySelectorAll("[data-test-mode]").forEach((b) => b.classList.toggle("active", b === btn));
      $("test-panel-index").classList.toggle("active", mode === "index");
      $("test-panel-episode").classList.toggle("active", mode === "episode");
    });
  });

  document.querySelectorAll("#tab-builder input, #tab-builder textarea").forEach((el) => {
    if (!el.id.startsWith("test-")) {
      el.addEventListener("input", refreshYamlPreview);
    }
  });

  $("btn-gen-regex").addEventListener("click", () => {
    const raw = $("f-sample-url").value.trim();
    if (!raw) {
      showToast("サンプル作品URLを入力してください");
      return;
    }
    try {
      $("f-domain").value = generateRegexFromUrl(raw);
      refreshYamlPreview();
      showToast("正規表現を自動生成しました");
    } catch {
      showToast("正しいURL形式（https://...）を入力してください");
    }
  });

  $("btn-run-index-test").addEventListener("click", runIndexTest);
  $("btn-run-episode-test").addEventListener("click", runEpisodeTest);

  $("btn-copy-unr1").addEventListener("click", async () => {
    const pkg = buildPackageFromForm();
    const code = await encodeUnr1(pkg);
    await navigator.clipboard.writeText(code);
    showToast("共有コード (UNR1) をコピーしました");
  });

  $("btn-copy-json").addEventListener("click", async () => {
    const pkg = buildPackageFromForm();
    await navigator.clipboard.writeText(JSON.stringify(pkg, null, 2));
    showToast("JSON全文をコピーしました");
  });

  $("btn-download-json").addEventListener("click", () => {
    const pkg = buildPackageFromForm();
    downloadJson(pkg, `${pkg.adapter_id}.unr.json`);
  });

  $("btn-submit-issue").addEventListener("click", () => {
    const pkg = buildPackageFromForm();
    if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(pkg.adapter_id)) {
      showToast("定義IDは半角英小文字・数字・_・- で2文字以上にしてください");
      return;
    }
    if ($("h-cookie").value.trim()) {
      const ok = confirm("Cookie が入力されています。個人ログイン情報が含まれていないことを確認してください。このまま投稿画面を開きますか？");
      if (!ok) return;
    }
    const title = `[定義投稿] ${pkg.name} (v${pkg.version})`;
    const body = [
      "### サイト定義パッケージ",
      "```json",
      JSON.stringify(pkg, null, 2),
      "```",
      "",
      "### 補足・動作確認メモ",
      pkg.description || "（動作確認したURL等があれば記入してください）",
    ].join("\n");

    const params = new URLSearchParams({
      title,
      labels: "community-adapter",
      body,
    });
    window.open(`${ISSUE_NEW_URL}?${params.toString()}`, "_blank", "noopener");
  });

  $("btn-copy-ai-prompt").addEventListener("click", async () => {
    const prompt = [
      "以下のWeb小説サイトのHTMLから、Androidアプリ「万能小説 (UniversalNovelReader)」用のCSSセレクタを調べてください。",
      "出力は以下の項目ごとにCSSセレクタだけ簡潔に教えてください：",
      "1. 一覧ページ: title, author, synopsis, episodes.container, episodes.title, episodes.url (例: a @href), episodes.chapter, episodes.updated_at, next_page_url",
      "2. 本文ページ: title, content, remove (広告等の不要要素), images (例: img @src)",
      "",
      "【ここにHTMLを貼り付けてAIに送信】",
    ].join("\n");
    await navigator.clipboard.writeText(prompt);
    showToast("AI解析用プロンプトをコピーしました");
  });

  $("btn-import-existing").addEventListener("click", async () => {
    const raw = prompt("取り込みたい JSON または UNR1:... 共有コードを貼り付けてください");
    if (!raw) return;
    try {
      const pkg = await decodeUnr1(raw);
      loadPackageIntoBuilder(pkg);
      showToast(`${pkg.name || "定義"} をビルダーに読み込みました`);
    } catch (e) {
      showToast(`読み込み失敗: ${e.message}`);
    }
  });
}

setupEvents();
refreshYamlPreview();
loadCatalogs();
