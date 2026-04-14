# SYNC-API.md — Integração LP ↔ App ConvertaFlow

> Contrato de sincronização entre a **Landing Page** (`convertaflow.com`) e o **App principal** (`app.convertaflow.com`).
>
> Este documento é a fonte de verdade sobre como a LP consome dados do App.
> **Versão:** 2.0 | **Criado em:** 2026-04-13 | **Implementado em:** 2026-04-14

---

## 0. Status de implementação (LEIA PRIMEIRO)

**Tudo já está configurado e deployado.** Este documento descreve como o sistema funciona — não é mais um plano a executar.

| Item | Status | Localização |
|---|---|---|
| API pública no app (`/api/public/*`) | ✅ Deployada | Commit `2cfe43e` no repo `cristianosbernardes/converta-flow` |
| Deploy Hook na Vercel da LP | ✅ Criado | Nome: `app-docs-updated`, branch `main` |
| Secret `LP_DEPLOY_HOOK_URL` no GitHub do app | ✅ Configurado | Repo `cristianosbernardes/converta-flow` |
| Env var `DOCS_API_URL` na Vercel da LP | ✅ Setada | Valor: `https://app.convertaflow.com` (production/preview/development) |
| GitHub Action `trigger-lp-rebuild` | ✅ Ativo | `.github/workflows/trigger-lp-rebuild.yml` no app |
| Scripts `sync.js` + `build.js` (modo dual) | ✅ Commitados | Commit `b772e08` neste repo |
| Páginas `/docs/*` gerando localmente | ✅ Testado | 13 categorias + 73 artigos |
| Páginas `/docs/*` deployadas em produção | ⏳ Ver abaixo | Depende do primeiro build remoto da Vercel |

**Fluxo completo após implementação:**
```
Cristiano edita doc no app (docs/knowledge/*.md ou help-data.ts)
   → commit + push no repo do app
     → GitHub Action trigger-lp-rebuild detecta mudança
       → POST no Deploy Hook da Vercel
         → Vercel rebuilda a LP
           → npm run build chama sync.js (modo remoto via DOCS_API_URL)
             → sync.js baixa docs da API publica do app
               → build.js gera /docs/* HTMLs estaticos
                 → LP deployada em convertaflow.com/docs/*
```

---

## 1. Contexto e objetivo

Até 2026-04-13 o `scripts/sync.js` lia arquivos diretamente do filesystem (pasta vizinha `../app-converta-flow`). Isso funcionava apenas na máquina do Cristiano.

**Problema:** para atualizar a LP, era necessário:
1. Abrir o terminal local da LP
2. Rodar `npm run dev` (sync + build)
3. Commitar o HTML gerado
4. Fazer push

**Solução definida:** o App vai expor uma **API pública** em `app.convertaflow.com/api/public/*`, e a LP vai consumir dela tanto localmente quanto em produção. Um **Deploy Hook da Vercel** será acionado quando os docs mudarem no App, disparando rebuild automático da LP.

**Por que não é container:** ~75 arquivos markdown (≈400KB total), leitura simples de filesystem, rebuild esporádico. Next.js API routes na Vercel (serverless) atendem com folga.

---

## 2. Arquitetura de namespaces

```
app.convertaflow.com/api/public/        ← NOVO: API pública consumida pela LP
  ├── /api/public/docs                  → lista todos os artigos (metadata)
  ├── /api/public/docs/[slug]           → conteúdo markdown de 1 artigo
  ├── /api/public/plans                 → planos com preços atualizados
  └── /api/public/changelog             → novidades/release notes (fase 2)

app.convertaflow.com/api/               ← INTERNO (não mexer)
  ├── /api/geo                          → detecção de país (checkout)
  ├── /api/help-search                  → busca da Central de Ajuda interna
  └── /api/suggestions                  → formulário de sugestões

backend-python :8000                    ← INTERNO (autenticado por tenant)
email-engine :8001                      ← AWS SES (container isolado)
```

**Garantia de não-conflito com o Email Engine (AWS SES):**
- `/api/public/*` é namespace exclusivo para consumo externo/SEO
- Email Engine roda em outro container (porta 8001), rotas começam com `/email/*`
- Se um dia for preciso expor status de email publicamente, será `/api/public/email-*` — sem colisão

---

## 3. Contrato da API

### 3.1. `GET /api/public/docs`

**Descrição:** Lista todos os artigos públicos agrupados por categoria.

**Resposta (200 OK):**
```json
{
  "version": "2026-04-13T10:00:00Z",
  "categories": [
    {
      "id": "getting-started",
      "title": "Primeiros Passos",
      "description": "Launchpad, configuração inicial...",
      "icon": "BookOpenIcon",
      "color": "#1e7fd4",
      "articles": [
        {
          "slug": "getting-started-launchpad",
          "title": "O Launchpad",
          "description": "Checklist de configuração inicial com 6 etapas",
          "updatedAt": "2026-04-11T14:32:00Z"
        }
      ]
    }
  ]
}
```

**Cache:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` (5 min)

**CORS:** `Access-Control-Allow-Origin: *` (dado público, sem risco)

---

### 3.2. `GET /api/public/docs/[slug]`

**Descrição:** Retorna o conteúdo completo de 1 artigo em markdown + metadata.

**Parâmetros:**
- `slug` (path) — ex: `getting-started-launchpad`

**Resposta (200 OK):**
```json
{
  "slug": "getting-started-launchpad",
  "title": "O Launchpad",
  "description": "Checklist de configuração inicial com 6 etapas",
  "category": {
    "id": "getting-started",
    "title": "Primeiros Passos"
  },
  "content": "# O Launchpad\n\nO Launchpad é o checklist...",
  "updatedAt": "2026-04-11T14:32:00Z",
  "readingTimeMinutes": 4
}
```

**Resposta (404 Not Found):** `{ "error": "Article not found" }`

**Observações:**
- O campo `content` é markdown bruto — a LP pode renderizar com `marked`, `markdown-it` ou similar
- Links internos no formato `doc:slug` precisam ser resolvidos para URLs da LP (ver seção 5.3)

---

### 3.3. `GET /api/public/plans`

**Descrição:** Substitui o parsing de migrations do sync.js por dados direto do banco.

**Resposta (200 OK):** mesmo formato do atual `data/plans.json` (compatível com `build.js`).

```json
{
  "version": "2026-04-13T10:00:00Z",
  "plans": [
    {
      "name": "Essencial",
      "slug": "essencial",
      "price_monthly_cents": 4990,
      "price_annual_cents": 47904,
      "max_users": 1,
      "max_connections": 1,
      "...": "...",
      "features": { "...": "..." },
      "pricing": {
        "monthly": { "integer": 49, "cents": "90", "total": "49.90" },
        "annual":  { "integer": 39, "cents": "92", "total": "39.92" }
      }
    }
  ]
}
```

**Vantagem sobre o parsing atual de migrations:** dados sempre consistentes com o banco, zero chance de parser quebrar com migration nova.

---

## 4. Deploy Hook da Vercel

### 4.1. Setup (passo único, manual)

1. Dashboard Vercel → projeto `lp-principal-converta-flow`
2. Settings → Git → **Deploy Hooks**
3. Criar hook:
   - Nome: `app-docs-updated`
   - Branch: `main`
4. Copiar a URL gerada (formato: `https://api.vercel.com/v1/integrations/deploy/prj_xxx/xxx`)
5. Guardar como secret `LP_DEPLOY_HOOK_URL` no Infisical (ou `.env` do App)

### 4.2. Trigger

O App dispara o hook em 2 momentos:

**A) Manual (admin):** botão "Republicar LP" em `/admin/settings` (fase 2)

**B) Automático:** GitHub Action no repo do App detecta mudanças em `docs/knowledge/**` e chama o hook:

```yaml
# .github/workflows/trigger-lp-rebuild.yml
name: Trigger LP Rebuild
on:
  push:
    branches: [main]
    paths:
      - 'docs/knowledge/**'
      - 'frontend/src/lib/help-data.ts'
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Call Vercel Deploy Hook
        run: curl -X POST "${{ secrets.LP_DEPLOY_HOOK_URL }}"
```

---

## 5. Mudanças necessárias no sync.js da LP

### 5.1. Modo dual: local (filesystem) vs remoto (API)

```js
// scripts/sync.js
const DOCS_API_URL = process.env.DOCS_API_URL || null;
const USE_REMOTE = !!DOCS_API_URL;

async function fetchDocs() {
  if (USE_REMOTE) {
    // Produção (Vercel build): busca da API
    const res = await fetch(`${DOCS_API_URL}/api/public/docs`);
    return res.json();
  } else {
    // Local: lê filesystem (comportamento atual)
    return readLocalDocs();
  }
}
```

**Variáveis de ambiente na Vercel (LP):**
- `DOCS_API_URL=https://app.convertaflow.com` — ativa modo remoto na build

**Sem `DOCS_API_URL`:** sync.js continua funcionando como hoje (útil para dev offline).

---

### 5.2. Persistência local para SEO

A LP precisa ter o HTML **pré-renderizado** (não pode depender de JS para SEO do Google). Fluxo:

1. Vercel build roda `npm run dev` → `sync.js` → `build.js`
2. `sync.js` em modo remoto baixa docs via API e salva em `data/docs/*.json`
3. `build.js` injeta nos marcadores `<!-- BUILD:* -->` no HTML

**Conclusão:** o HTML final **gerado pela Vercel** já tem todo o conteúdo. Google indexa normalmente.

---

### 5.3. Resolver links `doc:slug`

No App, os artigos usam `[texto](doc:slug)` e o renderer interno resolve para `/help/docs/{categoria}/{slug}`.

**Na LP pública**, a URL é diferente (ex: `convertaflow.com/docs/{categoria}/{slug}`).

O `build.js` deve pós-processar o markdown substituindo todos os `doc:slug` pelas URLs da LP. O endpoint `/api/public/docs` já retorna `category.id` por artigo, então é lookup simples:

```js
function resolveDocLinks(markdown, allArticles) {
  return markdown.replace(/\]\(doc:([a-z0-9-]+)\)/g, (_, slug) => {
    const art = allArticles.find(a => a.slug === slug);
    return art ? `](/docs/${art.category.id}/${slug})` : '](/docs)';
  });
}
```

---

## 6. Rotas públicas da LP (geradas estaticamente)

Estrutura sugerida para o convertaflow.com:

```
/                              → index.html (já existe)
/privacidade                   → privacidade.html (já existe)
/termos                        → termos.html (já existe)
/uso                           → uso.html (já existe)

/docs                          → NOVO: índice de categorias (gerado pelo build)
/docs/{categoria}              → NOVO: lista de artigos da categoria
/docs/{categoria}/{slug}       → NOVO: artigo individual
```

Cada rota é um HTML estático gerado pelo `build.js` a partir do template + dados da API.

**SEO:** cada artigo deve ter:
- `<title>` = título do artigo + " — ConvertaFlow"
- `<meta name="description">` = description do artigo
- `<link rel="canonical">` = URL canônica
- JSON-LD `Article` schema

---

## 7. CORS e segurança

### 7.1. CORS no App

```typescript
// frontend/src/app/api/public/docs/route.ts
export async function GET() {
  const data = await getAllDocs();
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  });
}
```

**Justificativa do `*`:** dados públicos (docs + planos), sem risco de exfiltração. Mesma política dos docs do Stripe, Vercel, etc.

### 7.2. Sem autenticação

Nenhum endpoint `/api/public/*` requer token. É conteúdo de marketing/ajuda, indexável pelo Google.

### 7.3. Rate limiting

Vercel Edge já aplica rate limit automático por IP. Para proteção extra contra scraping abusivo, adicionar no futuro: `@upstash/ratelimit` com Redis (50 req/min por IP).

---

## 8. Ordem de implementação recomendada

### Fase 1 — API no App (quando Cristiano autorizar)
1. Criar `frontend/src/app/api/public/docs/route.ts`
2. Criar `frontend/src/app/api/public/docs/[slug]/route.ts`
3. Criar `frontend/src/app/api/public/plans/route.ts`
4. Testar localmente em `http://localhost:3000/api/public/docs`
5. Deploy Vercel → validar em `https://app.convertaflow.com/api/public/docs`

### Fase 2 — Adaptar sync.js da LP
1. Adicionar modo dual local/remoto no `sync.js`
2. Adicionar lookup de `doc:slug` no `build.js`
3. Gerar páginas estáticas `/docs/...`
4. Adicionar var `DOCS_API_URL` no ambiente Vercel da LP

### Fase 3 — Automação
1. Criar Deploy Hook da LP no Vercel
2. Criar GitHub Action no App que dispara o hook em mudanças de `docs/knowledge/**`
3. Testar fluxo end-to-end: editar um doc no App → commit → push → LP rebuilda sozinha

---

## 9. Referências técnicas

**Arquivos-chave no App (`D:\Plataformas - DEV\converta-flow\app-converta-flow`):**
- `frontend/src/lib/help-data.ts` — metadata estruturada de todos os artigos
- `frontend/src/app/api/help-search/route.ts` — exemplo de leitura de `docs/knowledge/*.md`
- `docs/knowledge/*.md` — 75+ artigos markdown (fonte de verdade)
- `backend-python/alembic/versions/018b_*, 021_*, 030_*, 031_*` — migrations que o sync.js parseia hoje

**Arquivos-chave na LP (este repo):**
- `scripts/sync.js` — precisa adicionar modo remoto
- `scripts/build.js` — precisa adicionar geração das rotas `/docs/*`
- `index.html` — marcadores `<!-- BUILD:* -->` já existem
- `data/plans.json` — gerado pelo sync (vai passar a vir da API)

---

## 10. FAQ para o Claude Code da LP

**P: Preciso adicionar backend (container, Node server)?**
R: Não. A LP continua 100% estática. O sync.js roda apenas no build (local ou Vercel), consumindo a API do App.

**P: E se a API do App estiver fora do ar?**
R: O build da LP falha. Tratativa recomendada: fallback para o `data/` commitado do último build bem-sucedido. Adicionar try/catch no sync.js.

**P: E se eu quiser testar localmente sem a API rodando?**
R: Rode `npm run dev` sem a var `DOCS_API_URL` — o sync lê o filesystem como sempre fez.

**P: Como adicionar um artigo novo?**
R: Adicione no App em 2 lugares: (1) arquivo `docs/knowledge/novo-artigo.md`, (2) registro em `frontend/src/lib/help-data.ts`. Commit+push no App → GitHub Action dispara rebuild da LP automaticamente.

**P: E a Central de Ajuda interna do App (`/help/docs`) continua funcionando?**
R: Sim, intacta. Ela lê os mesmos arquivos diretamente — os endpoints públicos são só uma camada adicional de exposição.

**P: Preciso commitar `data/` e `docs/` gerados?**
R: Não. Estão no `.gitignore`. A Vercel gera em cada build via `npm run build` (que chama `prebuild` = sync.js, depois build.js).

**P: Como testar a integração completa sem fazer push?**
R: Rode localmente com `DOCS_API_URL=https://app.convertaflow.com npm run dev`. Se a API estiver no ar, você está testando o mesmo fluxo da Vercel build.

---

## 11. Arquivos tocados nesta implementação (2026-04-14)

### Repo `cristianosbernardes/converta-flow` (app)

**Novos:**
- `frontend/src/app/api/public/docs/route.ts`
- `frontend/src/app/api/public/docs/[slug]/route.ts`
- `frontend/src/app/api/public/plans/route.ts`
- `.github/workflows/trigger-lp-rebuild.yml`

**Modificados:**
- `frontend/src/middleware.ts` — adicionado `/api/public(.*)` à `isPublicRoute` do Clerk

### Repo `cristianosbernardes/lp-principal-converta-flow` (landing)

**Novos:**
- `SYNC-API.md` (este documento)
- `scripts/sync.js` — reescrito com modo dual local/remoto
- `scripts/build.js` — estendido para gerar `/docs/*`
- `package-lock.json`

**Modificados:**
- `package.json` — dependência `marked@^14.1.3`, versão 1.1.0
- `vercel.json` — removido rewrite universal pra index.html (quebrava /docs/*); adicionado `buildCommand` e `cleanUrls`
- `.gitignore` — liberou `scripts/*` e `SYNC-API.md`; ignorou artefatos de build (`data/`, `docs/`, `docs-styles.css`)
- `CLAUDE.md` — atualizado pra descrever o novo fluxo (não vai pro repo por `.gitignore`)

**Não versionados (gerados em build):**
- `data/plans.json`, `data/docs/*.json`
- `docs/**/index.html` (86 arquivos: 1 index + 13 categorias + 72 artigos)
- `docs-styles.css`

### Configurações na Vercel (team `team_Mn6DTH6bmXmMQ3rwrjZTakpV`)

**Projeto `lp-principal-converta-flow`:**
- Env var `DOCS_API_URL=https://app.convertaflow.com` (production/preview/development)
- Deploy Hook `app-docs-updated` criado (branch `main`)

**Projeto `converta-flow`:**
- Env var `BACKEND_PYTHON_URL=https://ai.convertaflow.com` (production/preview)

### Secret no GitHub (`cristianosbernardes/converta-flow`)

- `LP_DEPLOY_HOOK_URL` — URL do Deploy Hook da LP (usado pelo workflow `trigger-lp-rebuild`)

---

## 12. Observações importantes

### Backend Python está em `ai.convertaflow.com`, não em `api.convertaflow.com`

- `api.convertaflow.com` → backend Node.js (porta 8080 na VPS) — tudo protegido por Clerk
- `ai.convertaflow.com` → backend Python (FastAPI, porta 8000 na VPS) — tem endpoints públicos como `/billing/plans`

A rota `/api/public/plans` no Next.js faz proxy para `${BACKEND_PYTHON_URL}/billing/plans`, por isso precisa de `BACKEND_PYTHON_URL=https://ai.convertaflow.com` na Vercel.

### Links internos (doc:slug)

Nos arquivos `.md` do app, use `[texto](doc:slug)`. O `build.js` resolve automaticamente para `/docs/{categoria}/{slug}`. Isso funciona porque:
1. `help-data.ts` mapeia slug → categoria
2. `GET /api/public/docs` retorna esse mapeamento
3. `build.js` usa o mapa ao renderizar markdown

### `.gitignore` deliberado

Os arquivos `BRAND.md`, `DESIGN.md`, `LIA.md`, `FLOWBUILDER.md`, `CLAUDE.md` estão no `.gitignore` por decisão do Cristiano — são documentos internos/confidenciais. **Não mexer nessa regra sem autorização explícita.**

Os scripts `sync.js`, `build.js` e `SYNC-API.md` FORAM liberados nessa implementação após discussão com o Cristiano. Contêm lógica genérica (fetch de API, render markdown, template HTML).

---

**Fim do documento.** Qualquer dúvida de integração ou alteração estrutural, consulte o Cristiano antes de implementar.
