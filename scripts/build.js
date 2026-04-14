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

// Slugs mostrados como "Artigos populares" na home da central.
// Curadoria manual por ora — substituir por ranking automatico quando
// houver tracking de acessos (ver FU no handoff).
const FEATURED_SLUGS = [
  "getting-started-launchpad",
  "connections-whatsapp",
  "08-campanhas-e-marketing",
  "13-lia-ia-assistente",
  "02-planos-e-precos",
];

// Icones Lucide inline (body-only) — sao envolvidos pelo renderIcon().
// Mantem a LP 100% self-contained, sem dependencia runtime do client.
const LUCIDE_ICON_BODIES = {
  SparklesIcon: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  BookOpenIcon: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  MessageCircleIcon: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
  PlugIcon: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/>',
  UserIcon: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  MegaphoneIcon: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  ZapIcon: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  BrainCircuitIcon: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M9 13a4.5 4.5 0 0 0 3-4"/><path d="M12 13h4"/><path d="M12 18h6a2 2 0 0 1 2 2v1"/><path d="M12 8h8"/><path d="M16 8V5a2 2 0 0 1 2-2"/>',
  MailIcon: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  CreditCardIcon: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  Settings2Icon: '<path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  ShieldAlertIcon: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  HeadphonesIcon: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1zm18 0h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2a1 1 0 0 0 1-1z"/><path d="M21 14a9 9 0 0 0-18 0"/>',
  ScaleIcon: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
};

function renderIcon(name, size = 24) {
  const body = LUCIDE_ICON_BODIES[name] || LUCIDE_ICON_BODIES.BookOpenIcon;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

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
// 1b. Rodape compartilhado (home + docs + legais)
// ══════════════════════════════════════════════

/**
 * renderFooter() — unica fonte de verdade do rodape.
 *
 * Usado em:
 *   - index.html (via marcador BUILD:FOOTER)
 *   - privacidade.html / termos.html / uso.html (via marcador BUILD:FOOTER)
 *   - paginas geradas de /docs/* (chamado direto em docsLayout)
 *
 * Links usam paths absolutos (/#secao, /docs, /uso) para funcionar em
 * qualquer pagina de origem (home, docs, legais).
 */
function renderFooter() {
  return `<footer class="footer" role="contentinfo">
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand-header">
            <svg class="footer-brand-icon" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <g clip-path="url(#fci)">
                <mask id="fcm" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><path d="M512 0H0v512h512V0Z" fill="white"/></mask>
                <g mask="url(#fcm)">
                  <path d="M389.12 0H122.88C55.015 0 0 55.015 0 122.88v266.24C0 456.985 55.015 512 122.88 512h266.24C456.985 512 512 456.985 512 389.12V122.88C512 55.015 456.985 0 389.12 0Z" fill="url(#fcg)"/>
                  <path d="M245.694 308.926C216.282 325.906 178.673 315.829 161.692 286.417C144.711 257.005 154.789 219.397 184.201 202.416C205.921 189.876 228.797 188.777 247.849 202.64C255.025 205.489 276.221 212.607 305.477 195.767C333.611 179.475 338.762 158.548 340.104 150.199C337.294 126.52 351.79 105.657 373.751 92.979C403.163 75.999 440.771 86.076 457.751 115.488C474.732 144.899 464.656 182.508 435.244 199.489C415.023 211.163 389.571 214.618 370.969 203.224C363.067 200.213 346.789 194.21 318.614 210.429C289.401 227.345 284.968 244.839 283.847 252.478C283.834 256.597 283.834 254.717 283.834 258.883C284.968 266.301 289.401 282.689 318.614 299.605C346.789 315.824 363.067 309.821 370.969 306.81C389.571 295.416 415.023 299.977 435.244 311.65C464.656 328.631 474.732 366.24 457.751 395.652C440.771 425.064 403.163 435.141 373.751 418.16C351.79 405.482 337.294 383.514 340.104 359.835C338.762 351.486 333.611 330.559 305.477 314.267C276.221 297.427 255.025 304.545 247.849 307.394C246.26 308.75 247.679 307.78 245.694 308.926Z" fill="#FC9E1C"/>
                  <path d="M46.002 255.57C46.002 347.67 120.663 422.331 212.763 422.331C238.73 422.331 263.31 416.396 285.223 405.808C288.992 403.987 292.682 402.028 296.287 399.938C296.72 399.686 297.153 399.433 297.584 399.178C305.931 392.389 310.158 382.037 310.158 370.439C310.158 349.99 293.581 333.413 273.132 333.413C269.623 333.413 267.333 333.901 264.117 334.813C259.706 337.687 255.038 340.201 250.156 342.313C238.732 347.254 225.028 351.097 211.79 351.097C159.905 351.097 116.738 307.93 116.738 256.045C116.738 204.16 159.905 160.993 211.79 160.993C226.5 160.993 241.526 165.479 253.922 171.507C255.977 172.505 257.989 173.577 259.957 174.718C264.351 176.557 269.175 176.467 274.237 176.467C294.686 176.467 311.263 159.89 311.263 139.441C311.263 128.148 306.207 119.14 298.235 112.349C297.588 111.962 296.939 111.58 296.287 111.202C292.412 108.956 288.438 106.86 284.374 104.925C262.676 94.592 238.395 88.809 212.763 88.809C120.663 88.809 46.002 163.471 46.002 255.57Z" fill="white"/>
                </g>
              </g>
              <defs>
                <linearGradient id="fcg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop stop-color="#1E7FD4"/><stop offset="1" stop-color="#1A3A6E"/></linearGradient>
                <clipPath id="fci"><rect width="512" height="512" fill="white"/></clipPath>
              </defs>
            </svg>
            <div>
              <div class="footer-brand-name">ConvertaFlow</div>
              <div class="footer-brand-sub">Omnichannel + IA</div>
            </div>
          </div>
          <p class="footer-brand-desc">A plataforma que transforma conversas em conversões. Centralize WhatsApp, Instagram, chat do site, e-mail marketing e mais — tudo com IA integrada.</p>
          <div class="footer-social">
            <a href="https://www.instagram.com/convertaflow/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
            <a href="https://www.facebook.com/convertaflow" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="https://www.youtube.com/@ConvertaFlow" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
            <a href="https://www.convertaflow.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
          </div>
        </div>

        <div class="footer-col">
          <div class="footer-col-title">Produto</div>
          <a href="/#recursos">Recursos</a>
          <a href="/#precos">Preços</a>
          <a href="/#ia">Lia IA</a>
          <a href="/#automacao">Automação</a>
          <a href="/#canais">Canais</a>
        </div>

        <div class="footer-col">
          <div class="footer-col-title">Recursos</div>
          <a href="/#faq">FAQ</a>
          <a href="/docs">Central de Ajuda</a>
          <a href="#">Blog</a>
        </div>

        <div class="footer-col">
          <div class="footer-col-title">Empresa</div>
          <a href="#">Sobre</a>
          <a href="#">Contato</a>
          <a href="#">Parceiros</a>
          <a href="#">Carreiras</a>
        </div>
      </div>

      <div class="footer-bottom">
        <div class="footer-copyright">
          &copy; 2024–2026 ConvertaFlow. Todos os direitos reservados.
        </div>
        <div class="footer-legal">
          <a href="/uso">Termos de Uso</a>
          <a href="/privacidade">Política de Privacidade</a>
          <a href="/termos">Termos de Serviço</a>
        </div>
      </div>
    </div>
  </footer>`;
}

const STATIC_HTML_FILES = [
  path.join(LP_ROOT, "index.html"),
  path.join(LP_ROOT, "privacidade.html"),
  path.join(LP_ROOT, "termos.html"),
  path.join(LP_ROOT, "uso.html"),
];

/**
 * Injeta renderFooter() entre os marcadores BUILD:FOOTER_START/END
 * em todas as paginas estaticas (home + legais).
 */
function updateFooterInStaticHtml() {
  const footer = renderFooter();
  let updated = 0;
  for (const file of STATIC_HTML_FILES) {
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, "utf-8");
    const after = replaceBetweenMarkers(
      before,
      "<!-- BUILD:FOOTER_START -->",
      "<!-- BUILD:FOOTER_END -->",
      footer
    );
    if (after !== before) {
      fs.writeFileSync(file, after, "utf-8");
      updated++;
    }
  }
  console.log(`  ✔ rodape sincronizado em ${updated}/${STATIC_HTML_FILES.length} paginas estaticas`);
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

// SVG icon reusado no header e em outros lugares (lupa)
const SEARCH_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

/**
 * Extrai headings H2/H3 do HTML ja renderizado (com ids injetados pelo
 * renderMarkdownWithLinks). Retorna [{level, id, text}].
 */
function extractTocFromHtml(html) {
  const result = [];
  const re = /<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    result.push({
      level: parseInt(m[1], 10),
      id: m[2],
      text: m[3].replace(/<[^>]+>/g, "").trim(),
    });
  }
  return result;
}

function renderToc(headings) {
  if (!headings.length) return "";
  const items = headings
    .map(
      (h) =>
        `<a href="#${h.id}" class="docs-toc-link docs-toc-link--h${h.level}" data-toc-target="${h.id}">${escapeHtml(h.text)}</a>`
    )
    .join("");
  return `<div class="docs-toc"><div class="docs-toc-title">Nesta página</div>${items}</div>`;
}

/**
 * Sidebar de navegacao entre categorias/artigos. current pode ser:
 *   { categoryId } ou { categoryId, articleSlug } ou null
 * A categoria "atual" aparece expandida com seus artigos visiveis.
 */
function renderDocsSidebar(index, current) {
  const cats = index.categories.filter((c) => c.articles.length > 0);
  const currentCat = current ? current.categoryId : null;
  const currentSlug = current ? current.articleSlug : null;

  const groups = cats
    .map((cat) => {
      const isActive = cat.id === currentCat;
      const items = isActive
        ? `<div class="docs-sidebar-items">${cat.articles
            .map(
              (a) =>
                `<a href="/docs/${cat.id}/${a.slug}" class="docs-sidebar-item ${a.slug === currentSlug ? "is-current" : ""}">${escapeHtml(a.title)}</a>`
            )
            .join("")}</div>`
        : "";
      return `
        <div class="docs-sidebar-group ${isActive ? "is-active" : ""}">
          <a href="/docs/${cat.id}" class="docs-sidebar-group-title" style="--cat-color:${cat.color}">
            <span class="docs-sidebar-group-icon" style="color:${cat.color}">${renderIcon(cat.icon, 16)}</span>
            <span class="docs-sidebar-group-label">${escapeHtml(cat.title)}</span>
            <span class="docs-sidebar-group-count">${cat.articles.length}</span>
          </a>
          ${items}
        </div>
      `;
    })
    .join("");

  return `
    <nav class="docs-sidebar-nav" aria-label="Navegação da documentação">
      <a href="/docs" class="docs-sidebar-home ${!currentCat ? "is-current" : ""}">
        <span class="docs-sidebar-home-icon">${renderIcon("BookOpenIcon", 16)}</span>
        Central de Ajuda
      </a>
      ${groups}
    </nav>
  `;
}

/**
 * JS inline injetado na pagina de artigo — scroll-spy no TOC + feedback "Foi util".
 */
const DOCS_ARTICLE_JS = `
(function () {
  // Scroll-spy no TOC
  var tocLinks = document.querySelectorAll(".docs-toc-link[data-toc-target]");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (link) {
      var t = document.getElementById(link.dataset.tocTarget);
      if (t) map[link.dataset.tocTarget] = link;
    });
    var targets = Object.keys(map).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var active;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (active) active.classList.remove("is-active");
          active = map[e.target.id];
          if (active) active.classList.add("is-active");
        }
      });
    }, { rootMargin: "-96px 0px -66% 0px", threshold: 0 });
    targets.forEach(function (t) { obs.observe(t); });
  }

  // Feedback "Foi util?"
  var feedback = document.querySelector(".docs-feedback");
  if (feedback) {
    var slug = feedback.dataset.slug;
    var key = "cf-docs-vote-" + slug;
    var thanks = feedback.querySelector(".docs-feedback-thanks");
    var btns = feedback.querySelectorAll("button[data-vote]");
    var existing = null;
    try { existing = localStorage.getItem(key); } catch (e) {}
    function mark(vote) {
      btns.forEach(function (b) {
        b.disabled = true;
        if (b.dataset.vote === vote) b.classList.add("is-selected");
      });
      if (thanks) thanks.hidden = false;
    }
    if (existing) mark(existing);
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        try { localStorage.setItem(key, b.dataset.vote); } catch (e) {}
        mark(b.dataset.vote);
      });
    });
  }

  // Sidebar drawer (mobile)
  var toggle = document.querySelector(".docs-sidebar-toggle");
  var sidebar = document.getElementById("docs-sidebar");
  var backdrop = document.getElementById("docs-sidebar-backdrop");
  if (toggle && sidebar) {
    function open() { sidebar.classList.add("is-open"); if (backdrop) backdrop.hidden = false; }
    function close() { sidebar.classList.remove("is-open"); if (backdrop) backdrop.hidden = true; }
    toggle.addEventListener("click", function () {
      sidebar.classList.contains("is-open") ? close() : open();
    });
    if (backdrop) backdrop.addEventListener("click", close);
  }
})();
`;

/**
 * Layout compartilhado para todas as paginas de docs.
 * sidebar/toc sao strings HTML ou null (home nao tem nenhum dos dois).
 */
function docsLayout({ title, description, canonical, bodyContent, sidebar, toc, showHeaderSearch, extraScripts }) {
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
    <div class="docs-navbar-inner">
      ${sidebar ? `<button type="button" class="docs-sidebar-toggle" aria-label="Abrir menu de navegação">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
      </button>` : ""}
      <a href="/" class="docs-navbar-brand">ConvertaFlow</a>
      <a href="/docs" class="docs-navbar-divider" aria-label="Central de Ajuda">Ajuda</a>
      ${showHeaderSearch ? `
      <form action="/docs" method="get" class="docs-navbar-search" role="search">
        <span class="docs-navbar-search-icon" aria-hidden="true">${SEARCH_ICON_SVG}</span>
        <input type="search" name="q" class="docs-navbar-search-input" placeholder="Pesquisar artigos..." aria-label="Pesquisar artigos" autocomplete="off" />
      </form>
      ` : ""}
      <div class="docs-navbar-right">
        <a href="/" class="docs-navbar-back">&larr; Voltar ao site</a>
      </div>
    </div>
  </nav>

  ${sidebar ? '<div class="docs-sidebar-backdrop" id="docs-sidebar-backdrop" hidden></div>' : ""}

  <main class="docs-main">
    <div class="docs-layout ${sidebar && toc ? "docs-layout--3col" : sidebar ? "docs-layout--2col" : "docs-layout--1col"}">
      ${sidebar ? `<aside class="docs-sidebar" id="docs-sidebar">${sidebar}</aside>` : ""}
      <div class="docs-content">
        ${bodyContent}
      </div>
      ${toc ? `<aside class="docs-toc-wrap">${toc}</aside>` : ""}
    </div>
  </main>

  ${renderFooter()}

  ${extraScripts ? `<script>${extraScripts}</script>` : ""}
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
  const categoriesWithArticles = index.categories.filter((cat) => cat.articles.length > 0);

  // Mapa slug -> { article, category } para resolver populares e alimentar a busca
  const articleIndex = {};
  for (const cat of categoriesWithArticles) {
    for (const art of cat.articles) {
      articleIndex[art.slug] = { article: art, category: cat };
    }
  }

  const cards = categoriesWithArticles
    .map((cat) => `
      <a href="/docs/${cat.id}" class="docs-cat-card" data-cat-id="${escapeHtml(cat.id)}" data-cat-title="${escapeHtml(cat.title)}" style="--cat-color: ${cat.color}">
        <div class="docs-cat-icon" style="background: ${cat.color}15; color: ${cat.color}">
          ${renderIcon(cat.icon, 24)}
        </div>
        <h3 class="docs-cat-title">${escapeHtml(cat.title)}</h3>
        <p class="docs-cat-desc">${escapeHtml(cat.description)}</p>
        <div class="docs-cat-count">${cat.articles.length} artigo${cat.articles.length !== 1 ? "s" : ""}</div>
      </a>
    `)
    .join("");

  // Artigos populares (curadoria manual via FEATURED_SLUGS)
  const featuredCards = FEATURED_SLUGS
    .map((slug) => articleIndex[slug])
    .filter(Boolean)
    .map(({ article, category }) => `
      <a href="/docs/${category.id}/${article.slug}" class="docs-featured-card">
        <span class="docs-featured-eyebrow" style="color: ${category.color}">
          <span class="docs-featured-eyebrow-icon" style="color: ${category.color}">${renderIcon(category.icon, 14)}</span>
          ${escapeHtml(category.title)}
        </span>
        <span class="docs-featured-title">${escapeHtml(article.title)}</span>
      </a>
    `)
    .join("");

  // Indice inline (embed no HTML) para filtro client-side — evita fetch extra
  const searchIndexData = categoriesWithArticles.flatMap((cat) =>
    cat.articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      description: a.description || "",
      cat: cat.id,
      catTitle: cat.title,
      catColor: cat.color,
    }))
  );

  const bodyContent = `
    <div class="docs-hero">
      <h1>Como podemos te ajudar?</h1>
      <p>Guias, tutoriais e respostas para tirar o máximo da plataforma ConvertaFlow.</p>
      <div class="docs-search-wrap">
        <span class="docs-search-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <input
          type="search"
          id="docs-search-input"
          class="docs-search-input"
          placeholder="Pesquisar artigos..."
          autocomplete="off"
          aria-label="Pesquisar artigos"
        />
        <button type="button" id="docs-search-clear" class="docs-search-clear" aria-label="Limpar busca" hidden>&times;</button>
      </div>
    </div>

    ${featuredCards ? `
    <section class="docs-featured" id="docs-featured-section">
      <h2 class="docs-section-title">Artigos populares</h2>
      <div class="docs-featured-grid">
        ${featuredCards}
      </div>
    </section>
    ` : ""}

    <section class="docs-categories" id="docs-categories-section">
      <h2 class="docs-section-title">Explorar por categoria</h2>
      <div class="docs-cat-grid">
        ${cards}
      </div>
    </section>

    <section class="docs-search-results" id="docs-search-results" hidden>
      <h2 class="docs-section-title" id="docs-search-results-title">Resultados</h2>
      <div class="docs-search-results-list" id="docs-search-results-list"></div>
      <div class="docs-no-results" id="docs-no-results" hidden>
        <p>Nada encontrado. Tente outros termos.</p>
      </div>
    </section>

    <script id="docs-search-index" type="application/json">${JSON.stringify(searchIndexData)}</script>
    <script>${DOCS_SEARCH_JS}</script>
  `;

  return docsLayout({
    title: "Central de Ajuda",
    description: "Guias, tutoriais e respostas sobre WhatsApp, campanhas, IA, automação e CRM no ConvertaFlow.",
    canonical: "https://convertaflow.com/docs",
    bodyContent,
    sidebar: null,
    toc: null,
    showHeaderSearch: false,
  });
}

// ── Category: lista de artigos da categoria ──

function generateDocsCategoryPage(category, index) {
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
    <nav class="docs-breadcrumb-inline" aria-label="Você está em">
      <a href="/docs">Central de Ajuda</a>
      <span class="docs-breadcrumb-sep" aria-hidden="true">/</span>
      <span class="docs-breadcrumb-current">${escapeHtml(category.title)}</span>
    </nav>
    <header class="docs-page-header">
      <div class="docs-hero-eyebrow" style="color: ${category.color}">Categoria</div>
      <h1>${escapeHtml(category.title)}</h1>
      <p class="docs-page-desc">${escapeHtml(category.description)}</p>
    </header>
    <div class="docs-article-list">
      ${articles}
    </div>
  `;

  return docsLayout({
    title: category.title,
    description: category.description,
    canonical: `https://convertaflow.com/docs/${category.id}`,
    bodyContent,
    sidebar: renderDocsSidebar(index, { categoryId: category.id }),
    toc: null,
    showHeaderSearch: true,
    extraScripts: DOCS_ARTICLE_JS,
  });
}

// ── Article: artigo individual ──

function generateDocsArticlePage(article, category, allArticlesMap, prevNext, index) {
  const html = renderMarkdownWithLinks(article.content, allArticlesMap);

  // Remove H1 do inicio (title ja vem no hero) — renderizado pelo marked
  const htmlNoH1 = html.replace(/^\s*<h1[^>]*>.*?<\/h1>\s*/i, "");

  const tocHeadings = extractTocFromHtml(htmlNoH1);

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
    <nav class="docs-breadcrumb-inline" aria-label="Você está em">
      <a href="/docs">Central de Ajuda</a>
      <span class="docs-breadcrumb-sep" aria-hidden="true">/</span>
      <a href="/docs/${category.id}">${escapeHtml(category.title)}</a>
      <span class="docs-breadcrumb-sep" aria-hidden="true">/</span>
      <span class="docs-breadcrumb-current">${escapeHtml(article.title)}</span>
    </nav>
    <article class="docs-article">
      <header class="docs-article-header">
        <h1>${escapeHtml(article.title)}</h1>
        <p class="docs-article-desc">${escapeHtml(article.description)}</p>
        <div class="docs-article-meta">
          <span>${readingTime} min de leitura</span>
          ${updatedAtStr ? `<span class="docs-article-dot">·</span><span>Atualizado em ${updatedAtStr}</span>` : ""}
        </div>
      </header>

      <div class="docs-article-body">
        ${htmlNoH1}
      </div>

      <section class="docs-feedback" data-slug="${escapeHtml(article.slug)}">
        <h3 class="docs-feedback-title">Este artigo foi útil?</h3>
        <div class="docs-feedback-buttons">
          <button type="button" data-vote="yes" class="docs-feedback-btn">
            <span aria-hidden="true">👍</span> Sim
          </button>
          <button type="button" data-vote="no" class="docs-feedback-btn">
            <span aria-hidden="true">👎</span> Não
          </button>
        </div>
        <p class="docs-feedback-thanks" hidden>Obrigado pelo feedback!</p>
      </section>

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

  return docsLayout({
    title: article.title,
    description: article.description,
    canonical: `https://convertaflow.com/docs/${category.id}/${article.slug}`,
    bodyContent: bodyContent + jsonLd,
    sidebar: renderDocsSidebar(index, { categoryId: category.id, articleSlug: article.slug }),
    toc: renderToc(tocHeadings),
    showHeaderSearch: true,
    extraScripts: DOCS_ARTICLE_JS,
  });
}

// ── JS client-side da busca na home /docs ──

const DOCS_SEARCH_JS = `
(function () {
  var data;
  try { data = JSON.parse(document.getElementById("docs-search-index").textContent); }
  catch (e) { return; }

  var input = document.getElementById("docs-search-input");
  var clearBtn = document.getElementById("docs-search-clear");
  var featured = document.getElementById("docs-featured-section");
  var categories = document.getElementById("docs-categories-section");
  var resultsSection = document.getElementById("docs-search-results");
  var resultsList = document.getElementById("docs-search-results-list");
  var resultsTitle = document.getElementById("docs-search-results-title");
  var noResults = document.getElementById("docs-no-results");

  function normalize(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
  }

  function render(matches) {
    resultsList.innerHTML = matches.map(function (m) {
      return '<a href="/docs/' + m.cat + '/' + m.slug + '" class="docs-search-result">' +
        '<span class="docs-search-result-eyebrow" style="color:' + m.catColor + '">' + m.catTitle + '</span>' +
        '<span class="docs-search-result-title">' + escapeText(m.title) + '</span>' +
        (m.description ? '<span class="docs-search-result-desc">' + escapeText(m.description) + '</span>' : '') +
      '</a>';
    }).join("");
  }

  function escapeText(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function onInput() {
    var q = normalize(input.value.trim());
    if (!q) {
      clearBtn.hidden = true;
      if (featured) featured.hidden = false;
      categories.hidden = false;
      resultsSection.hidden = true;
      return;
    }
    clearBtn.hidden = false;
    if (featured) featured.hidden = true;
    categories.hidden = true;
    resultsSection.hidden = false;

    var matches = data.filter(function (item) {
      return normalize(item.title).indexOf(q) !== -1 ||
             normalize(item.description).indexOf(q) !== -1 ||
             normalize(item.catTitle).indexOf(q) !== -1;
    });

    resultsTitle.textContent = matches.length
      ? matches.length + (matches.length === 1 ? " artigo encontrado" : " artigos encontrados")
      : "Resultados";

    if (matches.length) {
      noResults.hidden = true;
      resultsList.hidden = false;
      render(matches);
    } else {
      noResults.hidden = false;
      resultsList.hidden = true;
      resultsList.innerHTML = "";
    }
  }

  input.addEventListener("input", onInput);
  clearBtn.addEventListener("click", function () {
    input.value = "";
    input.focus();
    onInput();
  });

  // Prefill via ?q= (busca do header das paginas internas redireciona pra ca)
  try {
    var params = new URLSearchParams(window.location.search);
    var initialQ = params.get("q");
    if (initialQ) {
      input.value = initialQ;
      onInput();
      input.focus();
    }
  } catch (e) {}

  // Atalho "/" para focar a busca (padrao do Stripe)
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== input && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      input.focus();
    }
    if (e.key === "Escape" && document.activeElement === input) {
      input.value = "";
      input.blur();
      onInput();
    }
  });
})();
`;

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
  padding: 12px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-sm);
}
.docs-navbar-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.docs-navbar-brand {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  flex-shrink: 0;
}
.docs-navbar-divider {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
  padding: 3px 10px;
  background: var(--surface-low);
  border-radius: var(--radius-sm, 6px);
  flex-shrink: 0;
  transition: background var(--transition-fast);
}
.docs-navbar-divider:hover { background: var(--surface-high); color: var(--text-primary); }
.docs-navbar-search {
  flex: 1;
  max-width: 420px;
  position: relative;
  display: flex;
  align-items: center;
}
.docs-navbar-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
  display: flex;
}
.docs-navbar-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px 8px 38px;
  font: inherit;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--surface-low);
  border: 1px solid var(--surface-high);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color var(--transition-base), background var(--transition-base);
}
.docs-navbar-search-input::placeholder { color: var(--text-muted); }
.docs-navbar-search-input:focus {
  background: #fff;
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 3px rgba(30, 127, 212, 0.1);
}
.docs-navbar-right { display: flex; gap: 20px; align-items: center; margin-left: auto; }
.docs-navbar-link, .docs-navbar-back {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
  transition: color var(--transition-fast);
  white-space: nowrap;
}
.docs-navbar-link:hover, .docs-navbar-back:hover { color: var(--brand-primary); }
.docs-sidebar-toggle {
  display: none;
  background: transparent;
  border: none;
  padding: 6px;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm, 6px);
}
.docs-sidebar-toggle:hover { background: var(--surface-low); }

/* ─── Breadcrumb inline (dentro do conteudo) ─── */
.docs-breadcrumb-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  color: var(--text-muted);
}
.docs-breadcrumb-inline a { color: var(--text-secondary); font-weight: 500; }
.docs-breadcrumb-inline a:hover { color: var(--brand-primary); }
.docs-breadcrumb-sep { color: var(--text-muted); }
.docs-breadcrumb-current { color: var(--text-primary); font-weight: 500; }

/* ─── Layout grid (main) ─── */
.docs-main { padding: 40px 0 80px; }
.docs-layout {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  display: grid;
  gap: 40px;
}
.docs-layout--1col { grid-template-columns: 1fr; }
.docs-layout--2col { grid-template-columns: 260px minmax(0, 1fr); }
.docs-layout--3col { grid-template-columns: 260px minmax(0, 1fr) 220px; }
.docs-content { min-width: 0; }

/* ─── Sidebar ─── */
.docs-sidebar {
  position: sticky;
  top: 80px;
  align-self: start;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding-right: 12px;
  scrollbar-width: thin;
}
.docs-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
}
.docs-sidebar-home {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: var(--text-primary);
  font-weight: 600;
  border-radius: var(--radius-sm, 6px);
  margin-bottom: 8px;
  transition: background var(--transition-fast);
}
.docs-sidebar-home:hover { background: var(--surface-low); }
.docs-sidebar-home.is-current { background: var(--surface-low); }
.docs-sidebar-home-icon { display: flex; color: var(--text-muted); }
.docs-sidebar-group { display: flex; flex-direction: column; }
.docs-sidebar-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  color: var(--text-secondary);
  font-weight: 600;
  border-radius: var(--radius-sm, 6px);
  transition: background var(--transition-fast), color var(--transition-fast);
}
.docs-sidebar-group-title:hover { background: var(--surface-low); color: var(--text-primary); }
.docs-sidebar-group.is-active .docs-sidebar-group-title {
  color: var(--text-primary);
  background: var(--surface-low);
}
.docs-sidebar-group-icon { display: inline-flex; }
.docs-sidebar-group-icon svg { display: block; }
.docs-sidebar-group-label { flex: 1; }
.docs-sidebar-group-count {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--surface-high);
  padding: 2px 6px;
  border-radius: 10px;
}
.docs-sidebar-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 4px 0 12px 28px;
  padding-left: 10px;
  border-left: 1px solid var(--surface-high);
}
.docs-sidebar-item {
  padding: 6px 10px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: var(--radius-sm, 6px);
  transition: background var(--transition-fast), color var(--transition-fast);
  line-height: 1.4;
}
.docs-sidebar-item:hover { background: var(--surface-low); color: var(--text-primary); }
.docs-sidebar-item.is-current {
  background: rgba(30, 127, 212, 0.08);
  color: var(--brand-primary);
  font-weight: 600;
}
.docs-sidebar-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(13, 27, 62, 0.4);
  z-index: 90;
}

/* ─── TOC (direita, artigos) ─── */
.docs-toc-wrap {
  position: sticky;
  top: 80px;
  align-self: start;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}
.docs-toc {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 16px;
  border-left: 1px solid var(--surface-high);
  font-size: 13px;
}
.docs-toc-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.docs-toc-link {
  padding: 4px 0;
  color: var(--text-secondary);
  line-height: 1.4;
  transition: color var(--transition-fast);
  border-left: 2px solid transparent;
  margin-left: -18px;
  padding-left: 16px;
}
.docs-toc-link:hover { color: var(--text-primary); }
.docs-toc-link--h3 { padding-left: 28px; font-size: 12px; }
.docs-toc-link.is-active {
  color: var(--brand-primary);
  font-weight: 600;
  border-left-color: var(--brand-primary);
}

/* ─── Article page header (Fase 2) ─── */
.docs-page-header { margin-bottom: 32px; }
.docs-page-header h1 { font-size: 32px; margin-bottom: 8px; letter-spacing: -0.02em; }
.docs-page-desc { font-size: 16px; color: var(--text-muted); line-height: 1.6; }

.docs-article-meta {
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

/* ─── Foi util? (feedback) ─── */
.docs-feedback {
  margin-top: 64px;
  padding: 24px;
  background: var(--surface-low);
  border-radius: var(--radius-lg);
  text-align: center;
}
.docs-feedback-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}
.docs-feedback-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.docs-feedback-btn {
  padding: 8px 20px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  background: #fff;
  color: var(--text-primary);
  border: 1px solid var(--surface-high);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition-base), transform var(--transition-base);
}
.docs-feedback-btn:hover:not(:disabled) {
  border-color: var(--brand-primary);
  transform: translateY(-1px);
}
.docs-feedback-btn:disabled { cursor: default; opacity: 0.6; }
.docs-feedback-btn.is-selected {
  opacity: 1;
  border-color: var(--brand-primary);
  background: rgba(30, 127, 212, 0.08);
  color: var(--brand-primary);
}
.docs-feedback-thanks {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-muted);
}

/* ─── Hero (home) ─── */
.docs-hero { text-align: center; max-width: 720px; margin: 0 auto 48px; }
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
.docs-cat-icon svg { display: block; }

/* ─── Hero search ─── */
.docs-search-wrap {
  position: relative;
  max-width: 640px;
  margin: 32px auto 0;
}
.docs-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 16px 52px 16px 52px;
  font: inherit;
  font-size: 16px;
  color: var(--text-primary);
  background: var(--surface-card);
  border: 1px solid var(--surface-high);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  outline: none;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}
.docs-search-input::placeholder { color: var(--text-muted); }
.docs-search-input:focus {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 4px rgba(30, 127, 212, 0.12), var(--shadow-md);
}
.docs-search-icon {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
  display: flex;
}
.docs-search-clear {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--surface-high);
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background var(--transition-base);
}
.docs-search-clear:hover { background: var(--surface-highest, #e5e7eb); color: var(--text-primary); }
.docs-search-clear[hidden] { display: none; }

/* ─── Section titles (home) ─── */
.docs-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 20px;
  max-width: 1100px;
  margin-left: auto;
  margin-right: auto;
}

/* ─── Featured articles ─── */
.docs-featured { margin-bottom: 56px; }
.docs-featured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  max-width: 1100px;
  margin: 0 auto;
}
.docs-featured-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: var(--surface-card);
  border: 1px solid var(--surface-high);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: transform var(--transition-base), border-color var(--transition-base), box-shadow var(--transition-base);
}
.docs-featured-card:hover {
  transform: translateY(-1px);
  border-color: var(--brand-primary);
  box-shadow: var(--shadow-sm);
}
.docs-featured-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.docs-featured-eyebrow-icon { display: inline-flex; }
.docs-featured-eyebrow-icon svg { display: block; }
.docs-featured-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.35;
}

/* ─── Categories section wrapper ─── */
.docs-categories { margin-bottom: 40px; }

/* ─── Search results (home) ─── */
.docs-search-results { margin-bottom: 40px; }
.docs-search-results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 1100px;
  margin: 0 auto;
}
.docs-search-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 18px;
  background: var(--surface-card);
  border: 1px solid var(--surface-high);
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: border-color var(--transition-base), transform var(--transition-base);
}
.docs-search-result:hover {
  border-color: var(--brand-primary);
  transform: translateX(2px);
}
.docs-search-result-eyebrow {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.docs-search-result-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.docs-search-result-desc { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
.docs-no-results {
  max-width: 1100px;
  margin: 0 auto;
  padding: 48px 20px;
  text-align: center;
  color: var(--text-muted);
  background: var(--surface-card);
  border: 1px dashed var(--surface-high);
  border-radius: var(--radius-lg);
}

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

/* ─── Footer (compartilhado com home + paginas legais) ─── */
.footer { background: #0a0f1e; padding: 64px 0 32px; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 48px; }
.footer-brand-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.footer-brand-icon { width: 40px; height: 40px; flex-shrink: 0; }
.footer-brand-name { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em; margin-bottom: 2px; }
.footer-brand-sub { font-size: 9px; font-weight: 400; color: rgba(255,255,255,0.45); text-transform: uppercase; letter-spacing: 0.04em; }
.footer-brand-desc { font-size: 14px; color: rgba(255,255,255,0.5); line-height: 1.6; max-width: 320px; }
.footer-col-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); margin-bottom: 20px; }
.footer-col a { display: block; font-size: 14px; color: rgba(255,255,255,0.6); padding: 6px 0; transition: color var(--transition-fast); }
.footer-col a:hover { color: #ffffff; }
.footer-social { display: flex; gap: 12px; margin-top: 20px; }
.footer-social a { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.06); transition: background var(--transition-fast), transform var(--transition-fast); }
.footer-social a:hover { background: rgba(255,255,255,0.12); transform: translateY(-2px); }
.footer-social svg { width: 18px; height: 18px; fill: rgba(255,255,255,0.5); transition: fill var(--transition-fast); }
.footer-social a:hover svg { fill: #ffffff; }
.footer-bottom { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.footer-copyright { font-size: 13px; color: rgba(255,255,255,0.35); }
.footer-legal { display: flex; gap: 24px; }
.footer-legal a { font-size: 13px; color: rgba(255,255,255,0.35); transition: color var(--transition-fast); }
.footer-legal a:hover { color: rgba(255,255,255,0.7); }

/* ─── Responsive ─── */
@media (max-width: 1180px) {
  /* TOC some em telas medianas para dar ar ao conteudo */
  .docs-layout--3col { grid-template-columns: 240px minmax(0, 1fr); }
  .docs-toc-wrap { display: none; }
}
@media (max-width: 991px) {
  .footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
  .docs-layout--2col, .docs-layout--3col { grid-template-columns: 1fr; gap: 24px; }
  .docs-sidebar-toggle { display: inline-flex; align-items: center; }
  .docs-navbar-divider { display: none; }
  .docs-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    max-width: 85vw;
    height: 100vh;
    max-height: none;
    background: #fff;
    padding: 72px 16px 24px 20px;
    border-right: 1px solid var(--surface-high);
    box-shadow: var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.15));
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    z-index: 95;
  }
  .docs-sidebar.is-open { transform: translateX(0); }
  .docs-sidebar-backdrop:not([hidden]) { display: block; }
}
@media (max-width: 640px) {
  .docs-hero h1 { font-size: 28px; }
  .docs-page-header h1 { font-size: 26px; }
  .docs-article-header h1 { font-size: 24px; }
  .docs-article-body h2 { font-size: 19px; }
  .docs-main { padding: 32px 0 64px; }
  .docs-prev-next-wrapper { grid-template-columns: 1fr; }
  .docs-search-input { padding: 14px 44px 14px 44px; font-size: 15px; }
  .docs-search-icon { left: 14px; }
  .docs-search-wrap { margin-top: 24px; }
  .docs-featured-grid { grid-template-columns: 1fr; }
  .docs-navbar-right { gap: 12px; }
  .docs-navbar-back { font-size: 13px; }
  .docs-navbar-search { max-width: none; }
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
    fs.writeFileSync(path.join(catDir, "index.html"), generateDocsCategoryPage(cat, index), "utf-8");
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
      fs.writeFileSync(path.join(artDir, "index.html"), generateDocsArticlePage(article, cat, allArticlesMap, prevNext, index), "utf-8");
      artCount++;
    }
  }

  console.log(`  ✔ ${catCount} categoria(s) + ${artCount} artigo(s) gerados em /docs`);
  if (skipCount > 0) console.log(`  ⚠ ${skipCount} artigo(s) pulado(s) (sem data/docs/{slug}.json)`);

  const expectedArticles = categoriesWithArticles.reduce((n, c) => n + c.articles.length, 0);
  return {
    expectedCategories: categoriesWithArticles.length,
    generatedCategories: catCount,
    expectedArticles,
    generatedArticles: artCount,
    skippedArticles: skipCount,
  };
}

function runHealthCheck({ docsStats, plansCount }) {
  const problems = [];

  if (docsStats) {
    if (docsStats.generatedArticles !== docsStats.expectedArticles) {
      problems.push(
        `Artigos: esperados ${docsStats.expectedArticles}, gerados ${docsStats.generatedArticles}` +
          (docsStats.skippedArticles ? ` (${docsStats.skippedArticles} sem data/docs/{slug}.json)` : "")
      );
    }
    if (docsStats.generatedCategories !== docsStats.expectedCategories) {
      problems.push(
        `Categorias: esperadas ${docsStats.expectedCategories}, geradas ${docsStats.generatedCategories}`
      );
    }
  }

  if (plansCount !== null && plansCount < 4) {
    problems.push(`Planos: esperados ao menos 4 (essencial/profissional/business/enterprise), encontrados ${plansCount}`);
  }

  if (problems.length > 0) {
    console.error("\n❌ Health check falhou:");
    for (const p of problems) console.error(`  • ${p}`);
    console.error("\nBuild abortado. Corrija os problemas acima antes de fazer deploy.\n");
    process.exit(1);
  }

  console.log("\n🩺 Health check OK");
  if (docsStats) {
    console.log(`   • ${docsStats.generatedCategories} categorias + ${docsStats.generatedArticles} artigos`);
  }
  if (plansCount !== null) console.log(`   • ${plansCount} planos`);
}

function main() {
  console.log("🏗️  ConvertaFlow LP — Build iniciado");

  let plansCount = null;

  // 1. Atualiza index.html com planos
  if (fs.existsSync(PLANS_FILE)) {
    const plans = JSON.parse(fs.readFileSync(PLANS_FILE, "utf-8"));
    plansCount = plans.length;
    console.log(`\n📊 Atualizando index.html (${plans.length} planos)...`);
    updateIndexHtml(plans);
  } else {
    console.warn("  [WARN] data/plans.json nao encontrado. index.html mantido como esta.");
  }

  // 1b. Sincroniza rodape em todas as paginas estaticas (home + legais)
  console.log("\n🔗 Sincronizando rodape (home + legais)...");
  updateFooterInStaticHtml();

  // 2. Gera paginas /docs/*
  console.log("\n📚 Gerando paginas /docs/*...");
  const docsStats = buildDocsPages();

  // 3. Health check — aborta o build se algo faltar
  runHealthCheck({ docsStats, plansCount });

  console.log("\n✅ Build concluido!\n");
}

main();
