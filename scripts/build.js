/**
 * build.js — Gera o HTML final da Landing Page com dados sincronizados
 *
 * Responsavel por:
 *   1. Atualizar marcadores BUILD:* no index.html (pricing, schema, AI pricing)
 *   2. Gerar paginas estaticas /docs/* a partir dos artigos sincronizados
 *
 * Entrada: data/plans.json + data/docs/index.json + data/docs/{slug}.json
 * Saida:   index.html atualizado + pasta docs/ com paginas HTML
 *
 * Contrato completo em SYNC-API.md.
 */

const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const LP_ROOT = path.resolve(__dirname, "..");
const HTML_FILE = path.join(LP_ROOT, "index.html");
const PLANS_FILE = path.join(LP_ROOT, "data", "plans.json");
const DOCS_INDEX_FILE = path.join(LP_ROOT, "data", "docs", "index.json");
const DOCS_DATA_DIR = path.join(LP_ROOT, "data", "docs");
const DOCS_OUT_DIR = path.join(LP_ROOT, "docs");

// ══════════════════════════════════════════════
// 1. Pricing cards (codigo existente preservado)
// ══════════════════════════════════════════════

function formatNumber(n) {
  if (n === null || n === undefined) return "ilimitado";
  if (n >= 1000000) return (n / 1000000).toFixed(0) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "K";
  return String(n);
}

function checkIcon() {
  return `<svg class="pricing-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function getPlanFeatures(plan) {
  const features = [];
  const check = checkIcon();
  features.push(`${check}<span><strong>${plan.max_users}</strong> usuário${plan.max_users > 1 ? "s" : ""}</span>`);
  features.push(`${check}<span><strong>${plan.max_connections}</strong> WhatsApp</span>`);
  const ig = plan.max_instagram || 1;
  const fb = plan.max_facebook || 1;
  const tg = plan.max_telegram || 1;
  features.push(`${check}<span><strong>${ig >= 100 ? "Ilimitado" : ig}</strong> Instagram</span>`);
  features.push(`${check}<span><strong>${fb >= 100 ? "Ilimitado" : fb}</strong> Facebook</span>`);
  features.push(`${check}<span><strong>${tg >= 100 ? "Ilimitado" : tg}</strong> Telegram</span>`);
  features.push(`${check}<span>Contatos <strong>ilimitados</strong></span>`);

  switch (plan.slug) {
    case "essencial":
      features.push(`${check}<span>Flow Builder · <strong>${plan.max_flows || 5}</strong> fluxos</span>`);
      features.push(`${check}<span>CRM básico · <strong>${plan.max_pipelines || 1}</strong> pipeline</span>`);
      features.push(`${check}<span><strong>${plan.max_ai_agents || 1}</strong> agente IA · modo texto</span>`);
      features.push(`${check}<span>Email Marketing · <strong>${formatNumber(plan.max_emails_monthly || 1000)}</strong> emails/mês</span>`);
      features.push(`${check}<span><strong>${plan.max_campaigns_month || 5}</strong> campanhas/mês</span>`);
      features.push(`${check}<span>Instagram Auto</span>`);
      break;
    case "profissional":
      features.push(`${check}<span><strong>${plan.max_flows || 20}</strong> fluxos de automação</span>`);
      features.push(`${check}<span>CRM avançado · Lead Scoring · <strong>${plan.max_pipelines || 3}</strong> pipelines</span>`);
      features.push(`${check}<span><strong>${plan.max_ai_agents || 3}</strong> agentes IA · ações básicas</span>`);
      features.push(`${check}<span>Email Marketing · <strong>${formatNumber(plan.max_emails_monthly || 3000)}</strong> emails/mês</span>`);
      features.push(`${check}<span>Chat Website · <strong>${plan.max_website_widgets || 2}</strong> widgets</span>`);
      features.push(`${check}<span>WhatsApp Call + VoIP (<strong>${plan.max_voip_minutes_monthly || 100}</strong> min)</span>`);
      features.push(`${check}<span>E-commerce + Carrinho abandonado</span>`);
      features.push(`${check}<span><strong>${plan.max_campaigns_month || 25}</strong> campanhas/mês</span>`);
      break;
    case "business":
      features.push(`${check}<span><strong>${plan.max_flows || 80}</strong> fluxos + Fluxos agendados</span>`);
      features.push(`${check}<span>Campanhas <strong>ilimitadas</strong></span>`);
      features.push(`${check}<span><strong>${plan.max_ai_agents || 8}</strong> agentes IA · ações completas</span>`);
      features.push(`${check}<span>Email Marketing · <strong>${formatNumber(plan.max_emails_monthly || 7000)}</strong> emails/mês</span>`);
      features.push(`${check}<span>Chat Website · <strong>${plan.max_website_widgets || 5}</strong> widgets</span>`);
      features.push(`${check}<span>VoIP (<strong>${plan.max_voip_minutes_monthly || 500}</strong> min) + WhatsApp Call</span>`);
      features.push(`${check}<span>Backup com mídia (${plan.backup_retention_days || 90} dias)</span>`);
      features.push(`${check}<span>Comunidades · <strong>${plan.max_communities || 3}</strong> grupos</span>`);
      features.push(`${check}<span>API REST · <strong>${formatNumber(plan.api_requests_per_day || 1000)}</strong> req/dia</span>`);
      features.push(`${check}<span>Testes A/B + SLA + Audit Logs</span>`);
      break;
    case "enterprise":
      features.push(`${check}<span>Fluxos <strong>ilimitados</strong></span>`);
      features.push(`${check}<span><strong>${plan.max_ai_agents || 20}</strong> agentes IA · prioridade</span>`);
      features.push(`${check}<span>Email Marketing · <strong>${formatNumber(plan.max_emails_monthly || 20000)}</strong> emails/mês · sem marca</span>`);
      features.push(`${check}<span>Chat Website · <strong>${plan.max_website_widgets || 100}</strong> widgets</span>`);
      features.push(`${check}<span>VoIP (<strong>${formatNumber(plan.max_voip_minutes_monthly || 2000)}</strong> min) + WhatsApp Call</span>`);
      features.push(`${check}<span>Backup com mídia (${plan.backup_retention_days || 180} dias)</span>`);
      features.push(`${check}<span>Comunidades · <strong>${plan.max_communities || 100}</strong> grupos</span>`);
      features.push(`${check}<span>API REST · <strong>${formatNumber(plan.api_requests_per_day || 10000)}</strong> req/dia</span>`);
      features.push(`${check}<span>Onboarding dedicado</span>`);
      features.push(`${check}<span>Suporte prioritário · Tudo <strong>ilimitado</strong></span>`);
      break;
  }
  return features;
}

function getPlanMeta(plan) {
  const badgeMap = {
    essencial: null,
    profissional: { class: "pricing-badge--popular", text: "Popular" },
    business: { class: "pricing-badge--best", text: "Mais vendido" },
    enterprise: { class: "pricing-badge--enterprise", text: "Enterprise" },
  };
  const ctaMap = {
    essencial: { class: "btn btn-outline pricing-cta", text: "Começar 7 dias grátis" },
    profissional: { class: "btn btn-primary pricing-cta", text: "Começar 7 dias grátis" },
    business: { class: "btn btn-cta pricing-cta", text: "Começar 7 dias grátis" },
    enterprise: { class: "btn btn-primary pricing-cta", text: "Começar 7 dias grátis" },
  };
  const featTitleMap = {
    essencial: "Incluso neste plano",
    profissional: "Tudo do Essencial, mais",
    business: "Tudo do Profissional, mais",
    enterprise: "Tudo do Business, mais",
  };
  return {
    badge: badgeMap[plan.slug] || (plan.badge ? { class: "pricing-badge--popular", text: plan.badge } : null),
    cta: ctaMap[plan.slug] || ctaMap.profissional,
    featTitle: featTitleMap[plan.slug] || "Recursos",
    isFeatured: plan.slug === "business",
  };
}

const descriptionOverrides = {
  essencial: "Ideal para quem está começando. Automação ilimitada + Email Marketing + 1 conexão WhatsApp.",
  profissional: "Para negócios em crescimento. IA avançada, CRM completo, Chat Website e VoIP.",
  business: "Para equipes que precisam de máxima performance. Backup completo, comunidades e todas as integrações.",
  enterprise: "Para agências e operações de grande porte. Tudo ilimitado, 20K emails sem marca, backup 180 dias.",
};

function generateSchemaOffers(plans) {
  const offers = plans.map((plan) => ({
    "@type": "Offer",
    name: plan.name,
    price: plan.pricing.monthly.total,
    priceCurrency: "BRL",
    priceValidUntil: "2027-12-31",
    availability: "https://schema.org/InStock",
    description: `${plan.max_users} usuário${plan.max_users > 1 ? "s" : ""}, ${plan.max_connections} WhatsApp, contatos ilimitados, ${plan.max_ai_agents} agente${plan.max_ai_agents > 1 ? "s" : ""} IA, ${formatNumber(plan.max_emails_monthly || 0)} emails/mês`,
  }));
  const lines = JSON.stringify(offers, null, 6);
  return `    "offers": ${lines},`;
}

function generatePricingCards(plans) {
  let html = "";
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const p = plan.pricing;
    const meta = getPlanMeta(plan);
    const features = getPlanFeatures(plan);
    const delay = i > 0 ? ` reveal-delay-${i}` : "";
    const featuredClass = meta.isFeatured ? " pricing-card--featured" : "";
    html += `
          <!-- ${plan.name.toUpperCase()} -->
          <article class="pricing-card${featuredClass} reveal${delay}" aria-label="Plano ${plan.name}">`;
    if (meta.badge) html += `\n            <span class="pricing-badge ${meta.badge.class}">${meta.badge.text}</span>`;
    html += `
            <div class="pricing-plan-name">${plan.name}</div>
            <p class="pricing-plan-desc">${descriptionOverrides[plan.slug] || plan.description || ""}</p>
            <div class="pricing-from annual-only" style="display:none">
              De <span class="pricing-original">R$ ${p.monthly.total.replace(".", ",")}</span> por
            </div>
            <div class="pricing-price">
              <span class="pricing-currency">R$</span>
              <span class="pricing-value" data-monthly="${p.monthly.integer}" data-annual="${p.annual.integer}">${p.monthly.integer}</span>
              <span class="pricing-currency">,<span class="price-cents" data-monthly="${p.monthly.cents}" data-annual="${p.annual.cents}">${p.monthly.cents}</span></span>
              <span class="pricing-period">/mês</span>
            </div>
            <a href="#" class="${meta.cta.class}">${meta.cta.text}</a>
            <div class="pricing-trial">Cancele quando quiser. Sem surpresas.</div>
            <div class="pricing-divider"></div>
            <div class="pricing-features-title">${meta.featTitle}</div>
            <div class="pricing-features">`;
    for (const feat of features) html += `\n              <div class="pricing-feature">${feat}</div>`;
    html += `\n            </div>\n          </article>`;
  }
  return html;
}

function generateAiPricingMeta(plans) {
  const parts = plans.map((p) => `${p.name} R$${p.pricing.monthly.total.replace(".", ",")}/mês`);
  return `<meta name="ai:pricing" content="${parts.join(", ")}">`;
}

function replaceBetweenMarkers(html, startMarker, endMarker, newContent) {
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1) return html;
  return html.slice(0, startIdx + startMarker.length) + "\n" + newContent + "\n          " + html.slice(endIdx);
}

function updateIndexHtml(plans) {
  let html = fs.readFileSync(HTML_FILE, "utf-8");
  html = replaceBetweenMarkers(html, "<!-- BUILD:SCHEMA_OFFERS_START -->", "<!-- BUILD:SCHEMA_OFFERS_END -->", generateSchemaOffers(plans));
  html = replaceBetweenMarkers(html, "<!-- BUILD:PRICING_CARDS_START -->", "<!-- BUILD:PRICING_CARDS_END -->", generatePricingCards(plans));
  html = replaceBetweenMarkers(html, "<!-- BUILD:AI_PRICING_START -->", "<!-- BUILD:AI_PRICING_END -->", generateAiPricingMeta(plans));
  fs.writeFileSync(HTML_FILE, html, "utf-8");
  console.log("  ✔ index.html atualizado (schema + pricing cards + AI meta)");
}

// ══════════════════════════════════════════════
// 2. Geracao de paginas /docs/*
// ══════════════════════════════════════════════

// Configurar marked: GFM (tabelas, strikethrough), sem quebras em paragrafos
marked.setOptions({ gfm: true, breaks: false });

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Resolve links doc:slug para URLs da LP e renderiza markdown.
 * allArticlesMap: slug → { categoryId }
 */
function renderMarkdownWithLinks(markdown, allArticlesMap) {
  // Primeiro: transforma [texto](doc:slug) em [texto](/docs/{cat}/{slug})
  const withResolvedLinks = markdown.replace(/\]\(doc:([a-z0-9-]+)\)/g, (_, slug) => {
    const meta = allArticlesMap[slug];
    return meta ? `](/docs/${meta.categoryId}/${slug})` : `](/docs)`;
  });

  // Renderiza markdown
  let html = marked.parse(withResolvedLinks);

  // Adiciona IDs nos headings para linkagem (#anchor)
  html = html.replace(/<h([2-4])>([^<]+)<\/h\1>/g, (_, level, text) => {
    const id = slugify(text);
    return `<h${level} id="${id}">${text}</h${level}>`;
  });

  return html;
}

/**
 * Layout compartilhado para todas as paginas de docs.
 */
function docsLayout({ title, description, canonical, bodyContent, breadcrumb }) {
  return `<!DOCTYPE html>
<html lang="pt-BR" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">

  <title>${escapeHtml(title)} — Central de Ajuda ConvertaFlow</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escapeHtml(canonical)}">

  <meta property="og:type" content="article">
  <meta property="og:site_name" content="ConvertaFlow">
  <meta property="og:title" content="${escapeHtml(title)} — Central de Ajuda">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:locale" content="pt_BR">

  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">

  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/font/sans.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/geist@1.3.0/dist/font/mono.css">

  <link rel="stylesheet" href="/docs-styles.css">
</head>
<body>

  <nav class="docs-navbar">
    <div class="container">
      <a href="/" class="docs-navbar-brand">ConvertaFlow</a>
      <div class="docs-navbar-right">
        <a href="/docs" class="docs-navbar-link">Central de Ajuda</a>
        <a href="/" class="docs-navbar-back">&larr; Voltar ao site</a>
      </div>
    </div>
  </nav>

  ${breadcrumb || ""}

  <main class="docs-main">
    <div class="container">
      ${bodyContent}
    </div>
  </main>

  <footer class="footer" role="contentinfo">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand-name">ConvertaFlow</div>
          <div class="footer-brand-sub">Omnichannel + IA</div>
          <p class="footer-brand-desc">A plataforma que transforma conversas em conversões. Centralize WhatsApp, Instagram e Facebook com IA integrada.</p>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Produto</div>
          <a href="/#recursos">Recursos</a>
          <a href="/#precos">Preços</a>
          <a href="/#ia">Lia IA</a>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Recursos</div>
          <a href="/#faq">FAQ</a>
          <a href="/docs">Central de Ajuda</a>
        </div>
        <div class="footer-col">
          <div class="footer-col-title">Empresa</div>
          <a href="/">Início</a>
          <a href="/termos">Termos</a>
          <a href="/privacidade">Privacidade</a>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="footer-copyright">&copy; 2024–2026 ConvertaFlow. Todos os direitos reservados.</div>
        <div class="footer-legal">
          <a href="/uso">Termos de Uso</a>
          <a href="/privacidade">Política de Privacidade</a>
          <a href="/termos">Termos de Serviço</a>
        </div>
      </div>
    </div>
  </footer>

</body>
</html>`;
}

function breadcrumbHtml(items) {
  // items: [{ label, href? }]
  const parts = items.map((it, i) => {
    const last = i === items.length - 1;
    if (last || !it.href) return `<span class="docs-breadcrumb-current">${escapeHtml(it.label)}</span>`;
    return `<a href="${escapeHtml(it.href)}">${escapeHtml(it.label)}</a>`;
  });
  return `<div class="docs-breadcrumb"><div class="container">${parts.join('<span class="docs-breadcrumb-sep">/</span>')}</div></div>`;
}

function formatDatePtBR(isoDate) {
  if (!isoDate) return "";
  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const d = new Date(isoDate);
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

// ── Index: lista de categorias ──

function generateDocsIndexPage(index) {
  const cards = index.categories
    .filter((cat) => cat.articles.length > 0)
    .map((cat) => `
      <a href="/docs/${cat.id}" class="docs-cat-card" style="--cat-color: ${cat.color}">
        <div class="docs-cat-icon" style="background: ${cat.color}15; color: ${cat.color}">
          <span class="docs-cat-icon-name">${escapeHtml(cat.title.charAt(0))}</span>
        </div>
        <h3 class="docs-cat-title">${escapeHtml(cat.title)}</h3>
        <p class="docs-cat-desc">${escapeHtml(cat.description)}</p>
        <div class="docs-cat-count">${cat.articles.length} artigo${cat.articles.length !== 1 ? "s" : ""}</div>
      </a>
    `)
    .join("");

  const bodyContent = `
    <div class="docs-hero">
      <h1>Central de Ajuda</h1>
      <p>Guias, tutoriais e respostas para tirar o máximo da plataforma ConvertaFlow.</p>
    </div>
    <div class="docs-cat-grid">
      ${cards}
    </div>
  `;

  return docsLayout({
    title: "Central de Ajuda",
    description: "Guias, tutoriais e respostas sobre WhatsApp, campanhas, IA, automação e CRM no ConvertaFlow.",
    canonical: "https://convertaflow.com/docs",
    bodyContent,
    breadcrumb: breadcrumbHtml([{ label: "Central de Ajuda" }]),
  });
}

// ── Category: lista de artigos da categoria ──

function generateDocsCategoryPage(category) {
  const articles = category.articles
    .map((art) => `
      <a href="/docs/${category.id}/${art.slug}" class="docs-article-card">
        <h3 class="docs-article-card-title">${escapeHtml(art.title)}</h3>
        <p class="docs-article-card-desc">${escapeHtml(art.description)}</p>
        <span class="docs-article-card-more">Ler artigo &rarr;</span>
      </a>
    `)
    .join("");

  const bodyContent = `
    <div class="docs-hero">
      <div class="docs-hero-eyebrow" style="color: ${category.color}">Categoria</div>
      <h1>${escapeHtml(category.title)}</h1>
      <p>${escapeHtml(category.description)}</p>
    </div>
    <div class="docs-article-list">
      ${articles}
    </div>
  `;

  return docsLayout({
    title: category.title,
    description: category.description,
    canonical: `https://convertaflow.com/docs/${category.id}`,
    bodyContent,
    breadcrumb: breadcrumbHtml([
      { label: "Central de Ajuda", href: "/docs" },
      { label: category.title },
    ]),
  });
}

// ── Article: artigo individual ──

function generateDocsArticlePage(article, category, allArticlesMap, prevNext) {
  const html = renderMarkdownWithLinks(article.content, allArticlesMap);

  // Remove H1 do inicio (title ja vem no hero) — renderizado pelo marked
  const htmlNoH1 = html.replace(/^\s*<h1[^>]*>.*?<\/h1>\s*/i, "");

  const prevLink = prevNext.prev
    ? `<a href="/docs/${category.id}/${prevNext.prev.slug}" class="docs-prev-next docs-prev">
         <span class="docs-prev-next-label">&larr; Anterior</span>
         <span class="docs-prev-next-title">${escapeHtml(prevNext.prev.title)}</span>
       </a>`
    : "";
  const nextLink = prevNext.next
    ? `<a href="/docs/${category.id}/${prevNext.next.slug}" class="docs-prev-next docs-next">
         <span class="docs-prev-next-label">Próximo &rarr;</span>
         <span class="docs-prev-next-title">${escapeHtml(prevNext.next.title)}</span>
       </a>`
    : "";

  const updatedAtStr = formatDatePtBR(article.updatedAt);
  const readingTime = article.readingTimeMinutes || 1;

  const bodyContent = `
    <article class="docs-article">
      <header class="docs-article-header">
        <div class="docs-article-eyebrow">
          <a href="/docs/${category.id}" style="color: ${category.color}">${escapeHtml(category.title)}</a>
          <span class="docs-article-dot">·</span>
          <span>${readingTime} min de leitura</span>
          ${updatedAtStr ? `<span class="docs-article-dot">·</span><span>Atualizado em ${updatedAtStr}</span>` : ""}
        </div>
        <h1>${escapeHtml(article.title)}</h1>
        <p class="docs-article-desc">${escapeHtml(article.description)}</p>
      </header>

      <div class="docs-article-body">
        ${htmlNoH1}
      </div>

      <footer class="docs-article-footer">
        <div class="docs-prev-next-wrapper">
          ${prevLink}
          ${nextLink}
        </div>
      </footer>
    </article>
  `;

  // JSON-LD Article schema
  const jsonLd = `
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": ${JSON.stringify(article.title)},
      "description": ${JSON.stringify(article.description)},
      "author": { "@type": "Organization", "name": "ConvertaFlow" },
      "publisher": {
        "@type": "Organization",
        "name": "ConvertaFlow",
        "url": "https://convertaflow.com"
      },
      "datePublished": ${JSON.stringify(article.updatedAt || new Date().toISOString())},
      "dateModified": ${JSON.stringify(article.updatedAt || new Date().toISOString())},
      "mainEntityOfPage": ${JSON.stringify(`https://convertaflow.com/docs/${category.id}/${article.slug}`)}
    }
    </script>
  `;

  const fullHtml = docsLayout({
    title: article.title,
    description: article.description,
    canonical: `https://convertaflow.com/docs/${category.id}/${article.slug}`,
    bodyContent: bodyContent + jsonLd,
    breadcrumb: breadcrumbHtml([
      { label: "Central de Ajuda", href: "/docs" },
      { label: category.title, href: `/docs/${category.id}` },
      { label: article.title },
    ]),
  });

  return fullHtml;
}

// ── CSS compartilhado (docs-styles.css) ──

const DOCS_CSS = `/* ConvertaFlow — Docs styles (gerado por build.js) */
:root {
  --brand-primary: #1e7fd4;
  --brand-dark: #1a6bbf;
  --brand-deeper: #1a3a6e;
  --brand-cta: #fc9e1c;
  --brand-navy: #0d1b3e;
  --brand-accent: #a8d4f5;
  --surface-base: #faf8ff;
  --surface-low: #f4f3fa;
  --surface-container: #efedf4;
  --surface-high: #e9e7ee;
  --surface-card: #ffffff;
  --text-primary: #02174a;
  --text-secondary: #424751;
  --text-muted: #727782;
  --success: #16a34a;
  --info: #1e7fd4;
  --info-bg: #e8f0fd;
  --shadow-sm: 0 2px 8px rgba(2, 23, 74, 0.06);
  --shadow-md: 0 4px 20px -2px rgba(2, 23, 74, 0.04), 0 12px 40px -8px rgba(2, 23, 74, 0.08);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --font-sans: 'Geist Sans', 'Geist', system-ui, -apple-system, sans-serif;
  --font-mono: 'Geist Mono', 'SF Mono', monospace;
}
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; font-size: 16px; }
body {
  font-family: var(--font-sans);
  color: var(--text-secondary);
  background: var(--surface-base);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}
img { max-width: 100%; height: auto; display: block; }
a { color: inherit; text-decoration: none; }
h1, h2, h3, h4, h5, h6 { color: var(--text-primary); font-weight: 700; line-height: 1.15; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

/* ─── Navbar ─── */
.docs-navbar {
  background: #ffffff;
  border-bottom: 1px solid var(--surface-high);
  padding: 16px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-sm);
}
.docs-navbar .container { display: flex; align-items: center; justify-content: space-between; }
.docs-navbar-brand { font-size: 18px; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em; }
.docs-navbar-right { display: flex; gap: 24px; align-items: center; }
.docs-navbar-link, .docs-navbar-back {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
  transition: color var(--transition-fast);
}
.docs-navbar-link:hover, .docs-navbar-back:hover { color: var(--brand-primary); }

/* ─── Breadcrumb ─── */
.docs-breadcrumb {
  background: var(--surface-low);
  border-bottom: 1px solid var(--surface-high);
  padding: 12px 0;
}
.docs-breadcrumb .container { display: flex; align-items: center; gap: 8px; font-size: 13px; flex-wrap: wrap; }
.docs-breadcrumb a { color: var(--brand-primary); font-weight: 500; }
.docs-breadcrumb a:hover { color: var(--brand-dark); text-decoration: underline; }
.docs-breadcrumb-sep { color: var(--text-muted); }
.docs-breadcrumb-current { color: var(--text-muted); font-weight: 500; }

/* ─── Hero ─── */
.docs-main { padding: 48px 0 80px; }
.docs-hero { text-align: center; max-width: 720px; margin: 0 auto 48px; }
.docs-hero-eyebrow {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.docs-hero h1 {
  font-size: 40px;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
}
.docs-hero p {
  font-size: 17px;
  color: var(--text-muted);
  line-height: 1.6;
}

/* ─── Category grid (index) ─── */
.docs-cat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  max-width: 1100px;
  margin: 0 auto;
}
.docs-cat-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-high);
  border-radius: var(--radius-lg);
  padding: 24px;
  transition: transform var(--transition-base), box-shadow var(--transition-base), border-color var(--transition-base);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.docs-cat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--cat-color, var(--brand-primary));
}
.docs-cat-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
}
.docs-cat-title { font-size: 18px; color: var(--text-primary); }
.docs-cat-desc { font-size: 14px; color: var(--text-muted); line-height: 1.5; }
.docs-cat-count { font-size: 12px; color: var(--text-muted); font-weight: 500; margin-top: auto; }

/* ─── Article list (category page) ─── */
.docs-article-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
}
.docs-article-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-high);
  border-radius: var(--radius-md);
  padding: 20px;
  transition: box-shadow var(--transition-base), border-color var(--transition-base);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.docs-article-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--brand-primary);
}
.docs-article-card-title { font-size: 16px; color: var(--text-primary); }
.docs-article-card-desc { font-size: 14px; color: var(--text-muted); line-height: 1.5; flex: 1; }
.docs-article-card-more { font-size: 13px; color: var(--brand-primary); font-weight: 500; margin-top: 4px; }

/* ─── Article page ─── */
.docs-article { max-width: 760px; margin: 0 auto; }
.docs-article-header { margin-bottom: 32px; }
.docs-article-eyebrow {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.docs-article-eyebrow a { font-weight: 600; }
.docs-article-eyebrow a:hover { text-decoration: underline; }
.docs-article-dot { color: var(--surface-high); }
.docs-article-header h1 { font-size: 34px; letter-spacing: -0.02em; margin-bottom: 12px; }
.docs-article-desc { font-size: 17px; color: var(--text-muted); line-height: 1.5; }

.docs-article-body h2 { font-size: 22px; margin: 40px 0 16px; letter-spacing: -0.01em; }
.docs-article-body h3 { font-size: 17px; margin: 28px 0 12px; }
.docs-article-body p { margin-bottom: 16px; font-size: 15px; line-height: 1.7; }
.docs-article-body strong { color: var(--text-primary); font-weight: 600; }
.docs-article-body a {
  color: var(--brand-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.docs-article-body a:hover { color: var(--brand-dark); }
.docs-article-body ul, .docs-article-body ol { margin-bottom: 16px; padding-left: 24px; }
.docs-article-body ul { list-style: disc; }
.docs-article-body ol { list-style: decimal; }
.docs-article-body li { font-size: 15px; line-height: 1.7; margin-bottom: 6px; }
.docs-article-body blockquote {
  border-left: 3px solid var(--brand-primary);
  padding: 12px 20px;
  margin: 16px 0;
  background: var(--info-bg);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-size: 15px;
}
.docs-article-body code {
  background: var(--surface-low);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-primary);
}
.docs-article-body pre {
  background: var(--surface-low);
  padding: 16px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 16px 0;
  border: 1px solid var(--surface-high);
}
.docs-article-body pre code {
  background: transparent;
  padding: 0;
  font-size: 13px;
}
.docs-article-body table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  margin: 16px 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--surface-high);
}
.docs-article-body th {
  background: var(--surface-low);
  color: var(--text-primary);
  font-weight: 600;
  text-align: left;
  padding: 12px 16px;
  border-bottom: 2px solid var(--surface-high);
}
.docs-article-body td {
  padding: 10px 16px;
  border-bottom: 1px solid var(--surface-container);
  vertical-align: top;
}
.docs-article-body tr:last-child td { border-bottom: none; }
.docs-article-body tr:nth-child(even) { background: var(--surface-low); }

/* ─── Prev/Next ─── */
.docs-article-footer { margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--surface-high); }
.docs-prev-next-wrapper {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.docs-prev-next {
  background: var(--surface-card);
  border: 1px solid var(--surface-high);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}
.docs-prev-next:hover { border-color: var(--brand-primary); box-shadow: var(--shadow-md); }
.docs-prev-next-label { font-size: 12px; color: var(--text-muted); font-weight: 500; }
.docs-prev-next-title { font-size: 14px; color: var(--text-primary); font-weight: 600; }
.docs-next { text-align: right; }

/* ─── Footer (reusa estilo das paginas legais) ─── */
.footer { background: #0a0f1e; padding: 64px 0 32px; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 48px; }
.footer-brand-name { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 4px; }
.footer-brand-sub { font-size: 9px; font-weight: 400; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 16px; }
.footer-brand-desc { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.6; max-width: 320px; }
.footer-col-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); margin-bottom: 20px; }
.footer-col a { display: block; font-size: 14px; color: rgba(255,255,255,0.6); padding: 6px 0; transition: color var(--transition-fast); }
.footer-col a:hover { color: #ffffff; }
.footer-bottom { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.footer-copyright { font-size: 13px; color: rgba(255,255,255,0.35); }
.footer-legal { display: flex; gap: 24px; }
.footer-legal a { font-size: 13px; color: rgba(255,255,255,0.35); transition: color var(--transition-fast); }
.footer-legal a:hover { color: rgba(255,255,255,0.7); }

/* ─── Responsive ─── */
@media (max-width: 991px) {
  .footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
}
@media (max-width: 640px) {
  .docs-hero h1 { font-size: 28px; }
  .docs-article-header h1 { font-size: 24px; }
  .docs-article-body h2 { font-size: 19px; }
  .docs-main { padding: 32px 0 64px; }
  .docs-prev-next-wrapper { grid-template-columns: 1fr; }
  .footer-grid { grid-template-columns: 1fr; }
  .footer-bottom { flex-direction: column; text-align: center; }
  .footer-legal { flex-wrap: wrap; justify-content: center; }
}
`;

// ══════════════════════════════════════════════
// 3. Main
// ══════════════════════════════════════════════

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanDir(full);
      fs.rmdirSync(full);
    } else {
      fs.unlinkSync(full);
    }
  }
}

function buildDocsPages() {
  if (!fs.existsSync(DOCS_INDEX_FILE)) {
    console.warn("\n  [WARN] data/docs/index.json nao encontrado. Pulando geracao de /docs/*.");
    return;
  }

  const index = JSON.parse(fs.readFileSync(DOCS_INDEX_FILE, "utf-8"));
  const categoriesWithArticles = index.categories.filter((c) => c.articles.length > 0);

  // Mapa slug → { categoryId } para resolver doc:slug
  const allArticlesMap = {};
  for (const cat of categoriesWithArticles) {
    for (const art of cat.articles) {
      allArticlesMap[art.slug] = { categoryId: cat.id };
    }
  }

  // Limpa /docs antes de regenerar
  if (fs.existsSync(DOCS_OUT_DIR)) cleanDir(DOCS_OUT_DIR);
  ensureDir(DOCS_OUT_DIR);

  // CSS compartilhado
  fs.writeFileSync(path.join(LP_ROOT, "docs-styles.css"), DOCS_CSS, "utf-8");
  console.log("  ✔ docs-styles.css gerado");

  // Index de categorias
  fs.writeFileSync(path.join(DOCS_OUT_DIR, "index.html"), generateDocsIndexPage(index), "utf-8");
  console.log("  ✔ /docs/index.html gerado");

  let catCount = 0;
  let artCount = 0;
  let skipCount = 0;

  for (const cat of categoriesWithArticles) {
    const catDir = path.join(DOCS_OUT_DIR, cat.id);
    ensureDir(catDir);
    fs.writeFileSync(path.join(catDir, "index.html"), generateDocsCategoryPage(cat), "utf-8");
    catCount++;

    for (let i = 0; i < cat.articles.length; i++) {
      const art = cat.articles[i];
      const dataPath = path.join(DOCS_DATA_DIR, `${art.slug}.json`);
      if (!fs.existsSync(dataPath)) {
        skipCount++;
        continue;
      }
      const article = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
      const prevNext = {
        prev: i > 0 ? cat.articles[i - 1] : null,
        next: i < cat.articles.length - 1 ? cat.articles[i + 1] : null,
      };

      const artDir = path.join(catDir, art.slug);
      ensureDir(artDir);
      fs.writeFileSync(path.join(artDir, "index.html"), generateDocsArticlePage(article, cat, allArticlesMap, prevNext), "utf-8");
      artCount++;
    }
  }

  console.log(`  ✔ ${catCount} categoria(s) + ${artCount} artigo(s) gerados em /docs`);
  if (skipCount > 0) console.log(`  ⚠ ${skipCount} artigo(s) pulado(s) (sem data/docs/{slug}.json)`);
}

function main() {
  console.log("🏗️  ConvertaFlow LP — Build iniciado");

  // 1. Atualiza index.html com planos
  if (fs.existsSync(PLANS_FILE)) {
    const plans = JSON.parse(fs.readFileSync(PLANS_FILE, "utf-8"));
    console.log(`\n📊 Atualizando index.html (${plans.length} planos)...`);
    updateIndexHtml(plans);
  } else {
    console.warn("  [WARN] data/plans.json nao encontrado. index.html mantido como esta.");
  }

  // 2. Gera paginas /docs/*
  console.log("\n📚 Gerando paginas /docs/*...");
  buildDocsPages();

  console.log("\n✅ Build concluido!\n");
}

main();
