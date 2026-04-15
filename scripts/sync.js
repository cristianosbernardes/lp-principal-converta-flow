/**
 * sync.js — Sincroniza dados do app ConvertaFlow para a Landing Page
 *
 * Modo dual:
 *   - LOCAL (sem DOCS_API_URL): le arquivos do filesystem (..\app-converta-flow)
 *   - REMOTO (com DOCS_API_URL): busca da API publica app.convertaflow.com/api/public
 *
 * Saidas em /data:
 *   - plans.json           → planos com pricing computado
 *   - docs/index.json      → categorias + artigos metadata
 *   - docs/{slug}.json     → conteudo markdown + metadata por artigo
 *
 * Contrato completo em SYNC-API.md.
 */

const fs = require("fs");
const path = require("path");

// ── Config ──
const DOCS_API_URL = process.env.DOCS_API_URL || null;
const USE_REMOTE = !!DOCS_API_URL;

const APP_ROOT = path.resolve(__dirname, "../../app-converta-flow");
const LP_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(LP_ROOT, "data");
const DOCS_DATA_DIR = path.join(DATA_DIR, "docs");

// ── Helpers ──
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFile(filepath) {
  if (!fs.existsSync(filepath)) {
    console.warn(`  [WARN] Arquivo nao encontrado: ${filepath}`);
    return null;
  }
  return fs.readFileSync(filepath, "utf-8");
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} em ${url}`);
  }
  return res.json();
}

// ══════════════════════════════════════════════
// Sync de docs auxiliares (BRAND, DESIGN, LIA, FLOWBUILDER)
// ══════════════════════════════════════════════

const DOCS_TO_SYNC = ["BRAND.md", "DESIGN.md", "LIA.md", "FLOWBUILDER.md"];
const ASSETS_TO_SYNC = [{ src: "frontend/public/icon.svg", dest: "icon.svg" }];

function syncAuxiliaryDocs() {
  console.log("\n📄 Sincronizando documentacao auxiliar...");

  if (USE_REMOTE) {
    console.log("  [SKIP] Modo remoto nao sincroniza docs auxiliares (arquivos grandes, raramente mudam).");
    return;
  }

  let synced = 0;
  for (const doc of DOCS_TO_SYNC) {
    const src = path.join(APP_ROOT, doc);
    const dest = path.join(LP_ROOT, doc);
    const srcContent = readFile(src);
    if (!srcContent) continue;
    const destContent = readFile(dest);
    if (srcContent !== destContent) {
      fs.writeFileSync(dest, srcContent, "utf-8");
      console.log(`  ✔ ${doc} atualizado`);
      synced++;
    }
  }

  console.log("\n🎨 Sincronizando assets...");
  let assetsSynced = 0;
  for (const asset of ASSETS_TO_SYNC) {
    const src = path.join(APP_ROOT, asset.src);
    const dest = path.join(LP_ROOT, asset.dest);
    if (!fs.existsSync(src)) continue;
    const srcBuf = fs.readFileSync(src);
    const destBuf = fs.existsSync(dest) ? fs.readFileSync(dest) : null;
    if (!destBuf || !srcBuf.equals(destBuf)) {
      fs.writeFileSync(dest, srcBuf);
      console.log(`  ✔ ${asset.dest} atualizado`);
      assetsSynced++;
    }
  }

  console.log(`  ${synced} doc(s) + ${assetsSynced} asset(s) sincronizados`);
}

// ══════════════════════════════════════════════
// Sync de planos
// ══════════════════════════════════════════════

async function syncPlansRemote() {
  const data = await fetchJson(`${DOCS_API_URL}/api/public/plans`);
  return data.plans || [];
}

function syncPlansLocal() {
  const PLANS_V2_FILE = path.join(APP_ROOT, "backend-python/alembic/versions/018b_plans_v2_and_backup.py");
  const PLANS_V3_FILE = path.join(APP_ROOT, "backend-python/alembic/versions/021_plans_v3_full_features.py");
  const PLANS_V5_FILE = path.join(APP_ROOT, "backend-python/alembic/versions/030_plans_v5_pricing_and_new_features.py");
  const PLANS_V5_FIX_FILE = path.join(APP_ROOT, "backend-python/alembic/versions/031_fix_annual_prices_20_percent_discount.py");

  const v2Content = readFile(PLANS_V2_FILE);
  if (!v2Content) {
    console.error("❌ Migration v2 (018b) nao encontrada.");
    return [];
  }

  let plans = parsePlansV2(v2Content);
  const v3Content = readFile(PLANS_V3_FILE);
  if (v3Content) plans = parsePlansV3(v3Content, plans);
  const v5Content = readFile(PLANS_V5_FILE);
  if (v5Content) plans = parsePlansV5(v5Content, plans);
  const v5FixContent = readFile(PLANS_V5_FIX_FILE);
  if (v5FixContent) plans = parsePlansV5(v5FixContent, plans);

  return computeDerivedPricing(plans);
}

async function syncPlans() {
  console.log("\n💰 Sincronizando planos...");

  let plans;
  try {
    plans = USE_REMOTE ? await syncPlansRemote() : syncPlansLocal();
  } catch (err) {
    console.error(`  ❌ Erro ao buscar planos: ${err.message}`);
    console.warn("  ⚠ Mantendo plans.json anterior (se existir).");
    return;
  }

  // Garante formato consistente entre modo local (snake_case) e remoto (camelCase)
  plans = normalizePlansShape(plans);

  const plansPath = path.join(DATA_DIR, "plans.json");
  fs.writeFileSync(plansPath, JSON.stringify(plans, null, 2), "utf-8");
  console.log(`  ✔ ${plans.length} planos salvos em data/plans.json`);

  for (const plan of plans) {
    const price = plan.pricing.monthly.total;
    console.log(`   ${plan.name.padEnd(14)} R$ ${price}/mes | ${plan.max_users || 1} user(s) | ${plan.max_connections || 1} WhatsApp`);
  }
}

// ══════════════════════════════════════════════
// Sync de docs (Central de Ajuda)
// ══════════════════════════════════════════════

async function syncDocsRemote() {
  console.log("  Buscando indice da API...");
  const index = await fetchJson(`${DOCS_API_URL}/api/public/docs`);
  const categories = index.categories || [];

  // Salva indice
  fs.writeFileSync(path.join(DOCS_DATA_DIR, "index.json"), JSON.stringify(index, null, 2), "utf-8");

  // Busca conteudo de cada artigo
  let total = 0;
  for (const cat of categories) {
    for (const art of cat.articles) {
      total++;
    }
  }

  let fetched = 0;
  for (const cat of categories) {
    for (const art of cat.articles) {
      try {
        const article = await fetchJson(`${DOCS_API_URL}/api/public/docs/${art.slug}`);
        fs.writeFileSync(path.join(DOCS_DATA_DIR, `${art.slug}.json`), JSON.stringify(article, null, 2), "utf-8");
        fetched++;
      } catch (err) {
        console.warn(`  [WARN] Falha em ${art.slug}: ${err.message}`);
      }
    }
  }

  console.log(`  ✔ ${fetched}/${total} artigos baixados da API`);
  return { total, fetched };
}

function syncDocsLocal() {
  // Modo local: le help-data.ts do app para montar indice,
  // e le cada .md direto do filesystem.
  const helpDataPath = path.join(APP_ROOT, "frontend/src/lib/help-data.ts");
  const knowledgePath = path.join(APP_ROOT, "docs/knowledge");

  if (!fs.existsSync(helpDataPath) || !fs.existsSync(knowledgePath)) {
    console.warn("  [WARN] help-data.ts ou docs/knowledge/ nao encontrado. Pulando sync de docs.");
    return { total: 0, fetched: 0 };
  }

  // Parse simples do HELP_CATEGORIES exportado
  const helpSrc = fs.readFileSync(helpDataPath, "utf-8");
  const categories = parseHelpCategories(helpSrc);

  // Enriquece com updatedAt (mtime) e content
  const index = {
    version: new Date().toISOString(),
    categories: categories.map((cat) => ({
      ...cat,
      articles: cat.articles.map((art) => {
        const mdPath = path.join(knowledgePath, `${art.slug}.md`);
        let updatedAt = null;
        try {
          updatedAt = fs.statSync(mdPath).mtime.toISOString();
        } catch {
          // ignora
        }
        return { ...art, updatedAt };
      }),
    })),
  };

  fs.writeFileSync(path.join(DOCS_DATA_DIR, "index.json"), JSON.stringify(index, null, 2), "utf-8");

  let total = 0;
  let fetched = 0;
  for (const cat of index.categories) {
    for (const art of cat.articles) {
      total++;
      const mdPath = path.join(knowledgePath, `${art.slug}.md`);
      if (!fs.existsSync(mdPath)) continue;
      const content = fs.readFileSync(mdPath, "utf-8");
      const readingTimeMinutes = Math.max(1, Math.ceil(content.split(/\s+/).length / 200));

      const article = {
        slug: art.slug,
        title: art.title,
        description: art.description,
        category: { id: cat.id, title: cat.title, color: cat.color },
        content,
        updatedAt: art.updatedAt,
        readingTimeMinutes,
      };
      fs.writeFileSync(path.join(DOCS_DATA_DIR, `${art.slug}.json`), JSON.stringify(article, null, 2), "utf-8");
      fetched++;
    }
  }

  return { total, fetched };
}

async function syncDocs() {
  console.log("\n📚 Sincronizando artigos da Central de Ajuda...");
  ensureDir(DOCS_DATA_DIR);

  const result = USE_REMOTE ? await syncDocsRemote() : syncDocsLocal();
  if (result.total === 0) {
    throw new Error("Nenhuma categoria/artigo encontrado — sync de docs falhou silenciosamente.");
  }
  if (result.fetched < result.total) {
    throw new Error(`Sync incompleto: ${result.fetched}/${result.total} artigos baixados.`);
  }
  console.log(`  ✔ ${result.fetched}/${result.total} artigos sincronizados`);
}

// ══════════════════════════════════════════════
// Sync de changelog (release notes)
// ══════════════════════════════════════════════

async function syncChangelogRemote() {
  return await fetchJson(`${DOCS_API_URL}/api/public/changelog`);
}

function syncChangelogLocal() {
  const filePath = path.join(APP_ROOT, "frontend/src/lib/changelog-data.ts");
  const src = readFile(filePath);
  if (!src) return null;

  // Extrai array literal depois de "export const RELEASES: Release[] = ["
  const marker = "export const RELEASES: Release[] = [";
  const start = src.indexOf(marker);
  if (start === -1) return null;

  let i = start + marker.length - 1; // aponta pro '['
  let depth = 0;
  let inStr = false;
  let strCh = "";
  for (; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === strCh) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = true;
      strCh = ch;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  const literal = src.slice(start + marker.length - 1, i + 1);

  let releases;
  try {
    releases = new Function("return " + literal)();
  } catch (err) {
    console.error(`  [ERRO] Falha ao parsear RELEASES: ${err.message}`);
    return null;
  }

  return {
    version: new Date().toISOString(),
    latestVersion: releases[0]?.version || null,
    releases,
  };
}

async function syncChangelog() {
  console.log("\n📰 Sincronizando changelog...");

  let data;
  try {
    data = USE_REMOTE ? await syncChangelogRemote() : syncChangelogLocal();
  } catch (err) {
    console.error(`  ❌ Erro ao buscar changelog: ${err.message}`);
    console.warn("  ⚠ Mantendo changelog.json anterior (se existir).");
    return;
  }

  if (!data || !Array.isArray(data.releases)) {
    console.warn("  [WARN] changelog sem releases. Pulando.");
    return;
  }

  const outPath = path.join(DATA_DIR, "changelog.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  ✔ ${data.releases.length} release(s) salvas em data/changelog.json (latest: ${data.latestVersion || "?"})`);
}

// ══════════════════════════════════════════════
// Parsers locais (filesystem mode)
// ══════════════════════════════════════════════

function parseHelpCategories(src) {
  // Extrai HELP_CATEGORIES via eval controlado (confia no proprio codigo do app).
  // JS aceita nativamente comentarios //, trailing commas, single quotes e
  // unquoted keys — que o JSON.parse rejeitava e quebrava o sync quando
  // alguem adicionava comentario dentro do array (ex.: categoria oculta).
  const marker = "export const HELP_CATEGORIES: HelpCategory[] = [";
  const startIdx = src.indexOf(marker);
  if (startIdx === -1) {
    throw new Error(`Marker nao encontrado em help-data.ts: "${marker}"`);
  }

  let i = startIdx + marker.length - 1; // aponta para o '['
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let inLineComment = false;
  let inBlockComment = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) break;
    }
  }

  if (depth !== 0) {
    throw new Error("Array literal de HELP_CATEGORIES mal-formado (colchetes desbalanceados)");
  }

  const literal = src.slice(startIdx + marker.length - 1, i + 1);

  try {
    const result = new Function(`return ${literal};`)();
    if (!Array.isArray(result) || result.length === 0) {
      throw new Error("HELP_CATEGORIES vazio ou nao-array");
    }
    return result;
  } catch (err) {
    throw new Error(`Falha ao parsear HELP_CATEGORIES: ${err.message}`);
  }
}

function parsePlansV2(content) {
  const plans = [];
  const valuesBlock = content.match(/VALUES\s*([\s\S]*?);/);
  if (!valuesBlock) return plans;

  const planBlocks = valuesBlock[1].split(/--\s+\w+:/);

  for (let i = 1; i < planBlocks.length; i++) {
    const block = planBlocks[i].trim();
    const tupleMatch = block.match(/\(([\s\S]*?)\)\s*[,;]?\s*$/);
    if (!tupleMatch) continue;
    const raw = tupleMatch[1];
    const values = [];
    let current = "";
    let inString = false;
    let stringChar = "";
    let braceDepth = 0;

    for (let c = 0; c < raw.length; c++) {
      const ch = raw[c];
      if (!inString && (ch === "'" || ch === '"')) {
        inString = true;
        stringChar = ch;
        current += ch;
      } else if (inString && ch === stringChar) {
        inString = false;
        current += ch;
      } else if (!inString && ch === "{") {
        braceDepth++;
        current += ch;
      } else if (!inString && ch === "}") {
        braceDepth--;
        current += ch;
      } else if (!inString && braceDepth === 0 && ch === ",") {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) values.push(current.trim());

    const clean = (v) => {
      if (!v || v === "null" || v === "NULL") return null;
      if (v === "true") return true;
      if (v === "false") return false;
      if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
        return v.slice(1, -1);
      }
      const num = Number(v);
      return isNaN(num) ? v : num;
    };

    let features = {};
    const featuresRaw = values[21];
    if (featuresRaw) {
      try {
        const jsonStr = featuresRaw.replace(/^'|'$/g, "").replace(/"(\w+)":/g, '"$1":');
        features = JSON.parse(jsonStr);
      } catch (e) {
        // ignora
      }
    }

    plans.push({
      name: clean(values[0]),
      slug: clean(values[1]),
      mode: clean(values[2]),
      price_monthly_cents: clean(values[3]),
      price_semiannual_cents: clean(values[4]),
      price_annual_cents: clean(values[5]),
      max_users: clean(values[6]),
      max_connections: clean(values[7]),
      max_queues: clean(values[8]),
      trial_days: clean(values[9]),
      is_active: clean(values[10]),
      is_visible: clean(values[11]),
      is_custom: clean(values[12]),
      sort_order: clean(values[13]),
      description: clean(values[14]),
      badge: clean(values[15]),
      max_ai_agents: clean(values[16]),
      max_campaigns_month: clean(values[17]),
      backup_enabled: clean(values[18]),
      backup_retention_days: clean(values[19]),
      backup_media: clean(values[20]),
      features,
    });
  }

  return plans;
}

function parsePlansV3(content, plans) {
  const updateBlocks = content.split(/-- \w+/g).filter((b) => b.includes("UPDATE"));
  for (const block of updateBlocks) {
    const slugMatch = block.match(/WHERE\s+slug\s*=\s*'(\w+)'/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    const plan = plans.find((p) => p.slug === slug);
    if (!plan) continue;
    const setMatch = block.match(/SET\s+([\s\S]*?)WHERE/);
    if (!setMatch) continue;
    const assignments = setMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
    for (const assignment of assignments) {
      const parts = assignment.match(/(\w+)\s*=\s*(.*)/);
      if (!parts) continue;
      const key = parts[1].trim();
      let value = parts[2].trim();
      if (value === "NULL" || value === "null") value = null;
      else if (value === "true") value = true;
      else if (value === "false") value = false;
      else {
        const num = Number(value);
        value = isNaN(num) ? value : num;
      }
      plan[key] = value;
    }
  }
  return plans;
}

function parsePlansV5(content, plans) {
  const upgradeMatch = content.match(/def upgrade\(\)[^]*?(?=def downgrade|$)/);
  const upgradeContent = upgradeMatch ? upgradeMatch[0] : content;
  const updateRegex = /UPDATE\s+public\.subscription_plans\s+SET\s+([\s\S]*?)WHERE\s+slug\s*=\s*'(\w+)'/g;
  let match;
  while ((match = updateRegex.exec(upgradeContent)) !== null) {
    const setBlock = match[1];
    const slug = match[2];
    const plan = plans.find((p) => p.slug === slug);
    if (!plan) continue;
    const lines = setBlock.split("\n");
    for (const line of lines) {
      const trimmed = line.replace(/--.*$/, "").trim();
      if (!trimmed) continue;
      const parts = trimmed.match(/^(\w+)\s*=\s*(.*?)[\s,]*$/);
      if (!parts) continue;
      const key = parts[1].trim();
      let value = parts[2].trim();
      if (value.endsWith(",")) value = value.slice(0, -1).trim();
      if (value === "NULL" || value === "null") value = null;
      else if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      else {
        const num = Number(value);
        value = isNaN(num) ? value : num;
      }
      plan[key] = value;
    }
  }
  return plans;
}

function computeDerivedPricing(plans) {
  for (const plan of plans) {
    const mc = plan.price_monthly_cents || 0;
    const ac = plan.price_annual_cents || 0;
    const sc = plan.price_semiannual_cents || 0;
    plan.pricing = {
      monthly: { integer: Math.floor(mc / 100), cents: String(mc % 100).padStart(2, "0"), total: (mc / 100).toFixed(2) },
      annual: { integer: Math.floor(ac / 100), cents: String(ac % 100).padStart(2, "0"), total: (ac / 100).toFixed(2) },
      semiannual: { integer: Math.floor(sc / 100), cents: String(sc % 100).padStart(2, "0"), total: (sc / 100).toFixed(2) },
    };
  }
  return plans;
}

function normalizePlansShape(plans) {
  // Converte camelCase (API remota) → snake_case usado pelo build.js existente.
  return plans.map((p) => {
    const snake = {};
    for (const [k, v] of Object.entries(p)) {
      const snakeKey = k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
      snake[snakeKey] = v;
    }
    // Preserva pricing como esta
    if (p.pricing) snake.pricing = p.pricing;
    // Garante pricing se veio sem (modo local passa por computeDerivedPricing, modo remoto ja vem)
    if (!snake.pricing) {
      const mc = snake.price_monthly_cents || 0;
      const ac = snake.price_annual_cents || 0;
      const sc = snake.price_semiannual_cents || 0;
      snake.pricing = {
        monthly: { integer: Math.floor(mc / 100), cents: String(mc % 100).padStart(2, "0"), total: (mc / 100).toFixed(2) },
        annual: { integer: Math.floor(ac / 100), cents: String(ac % 100).padStart(2, "0"), total: (ac / 100).toFixed(2) },
        semiannual: { integer: Math.floor(sc / 100), cents: String(sc % 100).padStart(2, "0"), total: (sc / 100).toFixed(2) },
      };
    }
    return snake;
  });
}

// ══════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════

async function main() {
  console.log("🔄 ConvertaFlow LP — Sync iniciado");
  console.log(`   Modo: ${USE_REMOTE ? "REMOTO (API)" : "LOCAL (filesystem)"}`);
  if (USE_REMOTE) {
    console.log(`   API:  ${DOCS_API_URL}`);
  } else {
    console.log(`   App:  ${APP_ROOT}`);
    if (!fs.existsSync(APP_ROOT)) {
      console.error(`\n❌ Pasta do app nao encontrada: ${APP_ROOT}`);
      console.error("   Para modo local, o app precisa estar no diretorio vizinho.");
      console.error("   Ou defina DOCS_API_URL para modo remoto.");
      process.exit(1);
    }
  }

  ensureDir(DATA_DIR);
  ensureDir(DOCS_DATA_DIR);

  syncAuxiliaryDocs();
  await syncPlans();
  await syncDocs();
  await syncChangelog();

  console.log("\n✅ Sync concluido!\n");
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
