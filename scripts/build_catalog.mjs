import fs from "node:fs";
import path from "node:path";
import { validateAdapterPackage } from "../lib/catalog-utils.js";

const ROOT = path.resolve(import.meta.dirname, "..");

function buildOfficialCatalog() {
  const dir = "official";
  const folder = path.join(ROOT, dir);
  fs.mkdirSync(folder, { recursive: true });

  const files = fs
    .readdirSync(folder)
    .filter((f) => f.endsWith(".unr.json"))
    .sort();

  const adapters = [];
  for (const file of files) {
    const fullPath = path.join(folder, file);
    const pkg = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const errors = validateAdapterPackage({ ...pkg, adapter_id: `check_${pkg.adapter_id}` });
    if (errors.length > 0) {
      throw new Error(`Validation failed for ${dir}/${file}:\n- ${errors.join("\n- ")}`);
    }

    adapters.push({
      adapter_id: pkg.adapter_id,
      name: pkg.name.trim(),
      version: pkg.version.trim(),
      author: (pkg.author || "official").trim(),
      description: (pkg.description || "").trim(),
      domain_pattern: pkg.domain_pattern.trim(),
      adapter_type: (pkg.adapter_type || "yaml").toLowerCase(),
      updated_at: pkg.updated_at || new Date().toISOString(),
      download_url: `/official/${file}`,
      discussion_url: null,
      likes: 0,
      reports: 0,
      comments: 0,
    });
  }

  const catalog = {
    catalog_version: 1,
    channel: "official",
    name: "万能小説 公式サイト定義",
    updated_at: new Date().toISOString(),
    adapters,
  };

  const outPath = path.join(folder, "index.json");
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(`Built official/index.json (${adapters.length} adapters)`);
}

buildOfficialCatalog();
