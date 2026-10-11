# Indexák – landing page „Najdi evropské dvojče" · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postavit a nasadit mobilní konverzní landing page „Indexák", která srovnává ETF z NYSE s jejich evropskými (UCITS) dvojčaty a za e-mail nabízí PDF návod ke koupi u českých brokerů; kontakty do Brevo s double opt-in, měření celé cesty.

**Architecture:** Astro 5 se statickým výstupem (rychlé LCP) a React ostrůvky jen pro interaktivní části (formuláře, výběr fondů, kalkulačka, výběr brokera, cookie lišta). Dvě serverless API routes na Vercelu (`/api/subscribe`, `/api/profile`) mluví s Brevo, Meta CAPI a Upstash. Jediný zdroj dat `src/data/*.json` napájí stránku, kalkulačku, PDF i reklamy.

**Tech Stack:** Node 20+, Astro 5, @astrojs/react, @astrojs/vercel, React 19, TypeScript (strict), SCSS (sass), Vitest + @testing-library/react + jsdom, Playwright, @react-pdf/renderer, @upstash/ratelimit + @upstash/redis, posthog-js.

**Spec:** `docs/superpowers/specs/2026-10-11-etf-dvojcata-landing-design.md` (v2, schválená). Každý implementátor čte spec i tento plán.

## Global Constraints

- Veškeré texty pro návštěvníka česky, vykání; žádné sliby výnosů; žádné „nejlepší"/„nejlevnější" – používat „nejnižší poplatek (TER)".
- Žádný údaj se nedomýšlí: každá hodnota fondu/brokera je `Sourced<T>` s `sourceUrl` (https) a `asOf` (YYYY-MM-DD). Neověřitelný údaj se nezobrazí ani nedá do PDF.
- Primární zdroj = stránka/factsheet vydavatele (brokera); agregátor jen ke kontrole.
- Syntetické (swapové) fondy se nezařazují. QQQ se nezařazuje.
- Skupiny `us-total` a `us-dividend` mohou mít prázdné `twins`, pokud alternativu nelze ověřit u vydavatele; UI (Task 10) i PDF (Task 13) to musí zobrazit poctivě, ne chybou.
- `id` fondu = ticker na burze uvedené v `exchange`; ticker u konkrétního brokera je v `brokers.json`.
- Volba „Zatím žádný“ u brokera se jen měří (`broker_selected` s `broker: 'none'`), na `/api/profile` se neposílá.
- TER zobrazovat `cs-CZ`, 2 desetinná místa, např. `0,03 %` (SPY 0.0945 → `0,09 %`). Částky v Kč zaokrouhlit na stovky, formát `6 900 Kč` (nezlomitelné mezery).
- Kalkulačka: R = 7 % p.a. (ilustrativní), srovnávací fond TER 1,5 % p.a. „(příklad)", vklad 500–50 000 Kč (výchozí 3 000), horizont 5–40 let (výchozí 20).
- Mobile first: návrh pro 390×844; tlačítko formuláře v hero musí být nad ohybem.
- Vizuál: papírově bílé pozadí, černá typografie, jediná signální barva tmavě zelená, tickery a čísla v neproporcionálním písmu s `font-variant-numeric: tabular-nums`; žádné přechody, glassmorphism, ikonky v kartách, loga vydavatelů ani brokerů.
- Výkon: LCP < 1,5 s (mobil, 4G), CLS < 0,1; analytika se načítá async až po vykreslení.
- Přístupnost: WCAG AA kontrast, popisky polí, ovladatelné klávesnicí, `prefers-reduced-motion`.
- Bez souhlasu: PostHog jen `cookieless_mode`, žádné `aid`; Meta Pixel, CAPI a GA4 nikdy. Souhlas se ukládá jen do `localStorage` klíče `ix_consent`.
- `/dekujeme`, `/potvrzeno` mají `noindex`.
- Provozovatel (správce údajů) se bere výhradně z `src/lib/operator.ts`; nikde jinde natvrdo.
- Secrets jen v env proměnných (seznam v `.env.example`); žádný klíč do klienta kromě `PUBLIC_*`.
- Commit po každém úkolu; zprávy commitů anglicky ve formátu `feat:`/`test:`/`docs:`/`chore:`.

## Review Focus

1. **Formulář odeslaný bez JavaScriptu** (nativní POST `x-www-form-urlencoded`) → server vygeneruje `aid` a vrátí 303 na `/dekujeme?aid=…`; při chybě 303 na `/?error=…#form`. Test: Task 6 (API) + Task 15 (E2E s vypnutým JS).
2. **Dvojí ťuknutí / duplicitní e-mail** → tlačítko je během odesílání `disabled`, odejde jediný request; duplicita v Brevu (HTTP 400 „duplicate") = úspěch. Test: Task 6 (duplicita), Task 8 (jediný request).
3. **Kalkulačka s prázdným, nečíselným nebo mimorozsahovým vstupem** („", „3 000", „0", „999999") → hodnoty se ořežou do rozsahu, nikdy `NaN` ani záporná čísla ve výstupu. Test: Task 4 (`clampInputs`), Task 10 (komponenta).
4. **Návštěvník odmítne cookies** → stránka i formulář fungují, `/api/subscribe` neposílá CAPI, PostHog nedostane `aid`. Test: Task 5 (track), Task 6 (CAPI jen při `consent_marketing=1`).
5. **Telefon v různých formátech** (`777 123 456`, `+420777123456`, `00420 777 123 456`, `+421…`, `12345`) → CZ formáty se normalizují na `+420XXXXXXXXX`, ostatní se odmítnou s hláškou; bez souhlasu (a) se neodešle, s (a) bez (b) se odešle. Test: Task 6 (`normalizeCzPhone`), Task 7 (API), Task 12 (komponenta).

---

## File Structure

```
astro.config.mjs            Astro + React + Vercel adapter, output 'static'
vercel.json                 bezpečnostní hlavičky, CSP
.env.example                seznam proměnných prostředí
vitest.config.ts, playwright.config.ts, tsconfig.json, package.json
src/
  data/etf-pairs.json       fondy a skupiny (Sourced hodnoty)
  data/brokers.json         brokeři, dostupnost dvojčat, poplatky, postupy
  lib/types.ts              sdílené typy dat
  lib/pairs.ts              přístup k datům + validace
  lib/calc.ts               kalkulace poplatků (čisté funkce)
  lib/format.ts             formátování Kč a TER
  lib/validate.ts           e-mail, telefon (sdílené klient/server)
  lib/copy.ts               texty hero, formulářů, souhlasů; varianty
  lib/operator.ts           údaje provozovatele
  lib/consent.ts            stav souhlasu
  lib/track.ts              analytika podle souhlasu, aid
  server/parse-body.ts      JSON i form-encoded
  server/brevo.ts           Brevo API
  server/meta-capi.ts       Meta Conversions API
  server/ratelimit.ts       Upstash rate limit
  pages/api/subscribe.ts    POST – double opt-in
  pages/api/profile.ts      POST – broker, telefon, souhlasy
  pages/index.astro, dekujeme.astro, potvrzeno.astro,
        zasady-ochrany-osobnich-udaju.astro, cookies.astro, 404.astro
  layouts/Base.astro        <head>, meta/OG, noindex, analytika, cookie lišta
  styles/tokens.scss, styles/global.scss
  components/
    Hero.astro, AnswerCard.astro, WhyNot.astro, GuidePreview.astro,
    Faq.astro, Footer.astro                      (statické)
    LeadForm.tsx, StickyCta.tsx, FundPicker.tsx, FundCard.tsx,
    FeeCalculator.tsx, BrokerPicker.tsx, PhoneOffer.tsx,
    ConsentBanner.tsx                             (React ostrůvky)
  pdf/GuideDocument.tsx     šablona PDF
scripts/build-pdf.tsx       generuje public/navod-etf.pdf (prebuild)
scripts/render-ads.ts       renderuje ads/*.png z ads/templates/*.html
public/fonts/               TTF s českou diakritikou
ads/                        kreativy A/B, 4:5 a 9:16
tests/unit, tests/api, tests/e2e
README.md
```

## Shared Contracts (závazné pro všechny úkoly)

```ts
// src/lib/types.ts
export type Sourced<T> = { value: T; sourceUrl: string; asOf: string };
export type GroupId = 'sp500' | 'world' | 'us-total' | 'us-dividend';
export type BrokerId = 'xtb' | 'trading212' | 'fio' | 'degiro';
export interface Fund {
  id: string;                 // ticker jako klíč, např. 'VOO', 'SPYL'
  kind: 'us' | 'ucits';
  name: Sourced<string>;
  isin: Sourced<string>;
  ter: Sourced<number>;       // v procentech: 0.03 = 0,03 %
  exchange: Sourced<string>;  // 'NYSE Arca', 'Xetra', ...
  domicile: Sourced<'US' | 'IE' | 'LU'>;
  distribution: Sourced<'acc' | 'dist'>;
  replication: Sourced<'physical' | 'synthetic'>;
  index: Sourced<string>;
  kidUrl?: string;
}
export interface Group {
  id: GroupId; label: string;
  originals: string[]; twins: string[];
  exactTwin: boolean; calcEnabled: boolean; note?: string;
}
export interface EtfData { asOf: string; funds: Record<string, Fund>; groups: Group[] }
export interface BrokerListing { fundId: string; ticker: Sourced<string>; available: Sourced<boolean> }
export interface Broker {
  id: BrokerId; name: string; asOf: string;
  buyFee: Sourced<string>; listings: BrokerListing[];
  steps: Sourced<string[]>;
}
export type HeroVariant = 'a' | 'b';
export type Placement = 'hero' | 'card' | 'calc' | 'preview';
export type EventName =
  | 'page_view' | 'form_viewed' | 'form_started' | 'form_submitted' | 'form_error'
  | 'thankyou_viewed' | 'broker_selected' | 'phone_submitted' | 'doi_confirmed'
  | 'pdf_downloaded' | 'pair_selected' | 'card_cta_clicked' | 'calc_used'
  | 'calc_result_viewed' | 'sticky_cta_clicked' | 'faq_opened'
  | 'source_link_clicked' | 'scroll_depth';
```

## Tasks (owner part file)

| # | Úkol | Část |
|---|---|---|
| 1 | Kostra projektu, design tokeny, Base layout, 404, operator | A |
| 2 | Data fondů: types, etf-pairs.json (ověřená), pairs.ts | A |
| 3 | Data brokerů: brokers.json (ověřená), twinsAtBroker | A |
| 4 | Kalkulace a formátování: calc.ts, format.ts | A |
| 5 | Souhlas a analytika: consent.ts, track.ts, ConsentBanner, /cookies | B |
| 6 | API /api/subscribe + validate.ts + server/* | B |
| 7 | API /api/profile | B |
| 8 | LeadForm (progresivní vylepšení) | B |
| 9 | Hero, AnswerCard, StickyCta, copy.ts | C |
| 10 | Další fondy a kalkulačka UI: FundPicker, FundCard, FeeCalculator | C |
| 11 | Zbytek homepage, patička, zásady zpracování | C |
| 12 | Děkovací stránky: /dekujeme, /potvrzeno, BrokerPicker, PhoneOffer | C |
| 13 | PDF návod | D |
| 14 | Reklamní kreativy A/B | D |
| 15 | Bezpečnost, nasazení, výkon, E2E na produkci | D |
| 16 | README | D |

### Interfaces per task (závazné názvy a signatury)

**Task 1** – Produces: `src/layouts/Base.astro` props `{ title: string; description: string; noindex?: boolean; ogImage?: string }`; `src/lib/operator.ts` `export const OPERATOR: { name: string; ico: string; address: string; email: string; phone: string; web: string }` (Clientelo Czech s.r.o., IČO 22193456, Platnéřská 90/13, Staré Město, 110 00 Praha 1, fundraising@clientelo.cz, +420 725 345 102 – převzato z patičky clientelo.cz; v README označeno k odsouhlasení); SCSS tokeny v `src/styles/tokens.scss` (`$paper`, `$ink`, `$signal`, `$muted`, `$rule`, `$font-text`, `$font-mono`, spacing `$s1..$s6`) a jejich CSS proměnné `--paper`, `--ink`, `--signal`, `--muted`, `--rule`; npm skripty `dev`, `build`, `test`, `test:e2e`, `lint` (`astro check`); `prebuild` (PDF) přidá Task 13. `Base.astro` má `<slot name="head" />` (přidá Task 9). `.env.example` obsahuje i `PUBLIC_META_PIXEL_ID`.

**Task 2** – Consumes: types. Produces `src/lib/pairs.ts`: `getData(): EtfData`, `getGroup(id: GroupId): Group`, `getFund(id: string): Fund`, `twinsSortedByTer(id: GroupId): Fund[]` (vzestupně podle TER, při shodě abecedně podle id), `originalsOf(id: GroupId): Fund[]`, `validateData(d: EtfData): string[]` (prázdné pole = OK). Skupiny a fondy dle spec §5.1 a §6.

**Task 3** – Produces in `src/lib/pairs.ts`: `getBrokers(): Broker[]`, `getBroker(id: BrokerId): Broker`, `twinsAtBroker(b: BrokerId, g: GroupId): { fund: Fund; ticker: string }[]` (jen `available.value === true`, řazeno jako `twinsSortedByTer`), `validateBrokers(b: Broker[], d: EtfData): string[]`.

**Task 4** – Produces `src/lib/calc.ts`: `MODEL_RETURN = 0.07`, `COMPARISON_TER = 1.5`, `LIMITS = { monthly: { min: 500, max: 50000, default: 3000 }, years: { min: 5, max: 40, default: 20 } }`, `clampInputs(monthly: unknown, years: unknown): { monthly: number; years: number }`, `futureValue(monthly: number, years: number, annualReturn: number, terPercent: number): number`, `computeFees(input: { monthly: number; years: number; funds: { id: string; ter: number }[]; annualReturn?: number }): FeeResult` kde `FeeResult = { deposited: number; gross: number; rows: { id: string; ter: number; fv: number; feesPaid: number }[]; comparison: { ter: number; fv: number; feesPaid: number } }`. `src/lib/format.ts`: `formatCzk(n: number): string` (zaokrouhlení na stovky), `formatTer(p: number): string`.

**Task 5** – Produces `src/lib/consent.ts`: `CONSENT_VERSION = '2026-10-11'`, `type ConsentState = { analytics: boolean; meta: boolean; ga4: boolean; version: string; decidedAt: string }`, `getConsent(): ConsentState | null`, `setConsent(c: Pick<ConsentState,'analytics'|'meta'|'ga4'>): ConsentState`, `onConsentChange(cb: (c: ConsentState) => void): () => void`, `openConsentSettings(): void`. `src/lib/track.ts`: `initAnalytics(): void`, `track(e: EventName, props?: Record<string, string | number | boolean>): void`, `getAid(): string` (z `?aid=` v URL, jinak `crypto.randomUUID()` v paměti), `getUtm(): Record<string, string>`, `firePixelLead(eventId: string): void` (jen se souhlasem `meta`). Komponenta `ConsentBanner.tsx` (bez props), stránka `/cookies`.

**Task 6** – Produces `src/lib/validate.ts`: `isValidEmail(s: string): boolean`, `normalizeCzPhone(s: string): string | null`. `src/server/parse-body.ts`: `parseBody(req: Request): Promise<{ data: Record<string, string>; isForm: boolean }>`. `src/server/ratelimit.ts`: `checkRateLimit(key: string): Promise<boolean>` (bez env → `true` + warning). `src/server/brevo.ts`: `createDoiContact(i: { email: string; aid: string; attributes: Record<string, string | number> }): Promise<{ ok: true } | { ok: false; error: 'brevo' }>`, `upsertProfile(i: ProfileInput): Promise<{ ok: true } | { ok: false; error: 'brevo' | 'phone_taken' }>` kde `ProfileInput = { aid: string; broker?: BrokerId; phone?: string; consentCall?: boolean; consentPartners?: boolean; consentTextVersion: string }`. `src/server/meta-capi.ts`: `sendLeadEvent(i: { email: string; eventId: string; ip: string; userAgent: string; sourceUrl: string }): Promise<void>`. Endpoint `POST /api/subscribe` – pole: `email, aid, event_id, pair, calc_deposit, calc_horizon, placement, utm_source, utm_medium, utm_campaign, utm_content, consent_text_version, consent_marketing ('1'|'0'), website (honeypot)`; JSON odpověď `{ ok: true, redirect: '/dekujeme?aid=…' } | { ok: false, error: 'invalid_email' | 'rate_limited' | 'server' }`; form → 303.

**Task 7** – Consumes Task 6. Endpoint `POST /api/profile` (JSON) – pole `aid, broker?, phone?, consent_call?, consent_partners?, consent_text_version`; odpověď `{ ok: true } | { ok: false, error: 'invalid_phone' | 'consent_required' | 'phone_taken' | 'rate_limited' | 'server' }`.

**Task 8** – Consumes Tasks 5, 6. Creates `src/lib/copy.ts` with `FORM_COPY: { button: string; micro: string; errorInvalid: string; errorServer: string }` and `CONSENT_TEXT_VERSION = '2026-10-11'`. Produces `LeadForm.tsx` props `{ placement: Placement; pair?: string; calc?: { deposit: number; horizon: number }; id?: string }`; SSR výstup je funkční `<form method="post" action="/api/subscribe">`; po úspěchu `location.assign(redirect)`. Formulář #1 má `id="form"`. Hodnoty skrytých polí `pair` a `placement` čte při odeslání z DOM (`new FormData(form)`), aby je mohl přepsat odkaz z `FundCard` (Task 10). Nastavení cookies otevírá kterýkoli `[data-consent-open]` (kontrakt Task 5).

**Task 9** – Extends `src/lib/copy.ts` (keeps Task 8 exports): `heroVariantFromUtm(utmContent: string | null): HeroVariant` (`'b'` když začíná na `b`, jinak `'a'`), `HERO_COPY: Record<HeroVariant, { h1: string; sub: string }>`. (`PHONE_COPY` vytvoří Task 12.). Komponenty `Hero.astro` (props `{ variant: HeroVariant }`), `AnswerCard.astro` (bez props, skupina `sp500`), `StickyCta.tsx` (bez props). Varianta se na statické stránce přepíná klientským skriptem z `utm_content` bez posunu layoutu (oba texty v HTML, viditelný jeden).

**Task 10** – Consumes Tasks 2, 4, 5, 8. Produces `FundPicker.tsx` (bez props; skupiny `world`, `us-total`, `us-dividend`), `FundCard.tsx` props `{ groupId: GroupId; onCta: (groupId: GroupId) => void }`, `FeeCalculator.tsx` props `{ initialGroup?: 'sp500' | 'world' }` (skupiny s `calcEnabled`).

**Task 11** – Produces `WhyNot.astro`, `GuidePreview.astro`, `Faq.astro`, `Footer.astro`, stránka `/zasady-ochrany-osobnich-udaju` a složení `index.astro` v pořadí spec §4.

**Task 12** – Consumes Tasks 3, 5, 7, 9. Produces `BrokerPicker.tsx` (bez props), `PhoneOffer.tsx` props `{ page: 'dekujeme' | 'potvrzeno' }`, stránky `/dekujeme`, `/potvrzeno` (PDF odkaz `/navod-etf.pdf`).

**Task 13** – Consumes Tasks 1 (`OPERATOR`), 2, 3, 4 (`formatTer`). Produces `scripts/build-pdf.tsx` → `public/navod-etf.pdf`, `src/pdf/GuideDocument.tsx`, npm `prebuild`.

**Task 14** – Consumes Tasks 2, 3, 4, 9, 13 (fonty). Produces navíc `public/og.png` (1200×630). Produces `ads/templates/{a,b}.html`, `scripts/render-ads.ts` (npm `ads`), výstupy `ads/a-4x5.png`, `ads/a-9x16.png`, `ads/b-4x5.png`, `ads/b-9x16.png`.

**Task 15** – Produces `vercel.json` (CSP a hlavičky), `docs/brevo-setup.md` (atributy dle Task 6/7, šablona DOI, automatizace, ruční ověření chybových kódů Brevo), nasazení, Lighthouse report `docs/lighthouse-mobile.json`, E2E proti `BASE_URL`.

**Task 16** – Produces `README.md` (obsah dle spec §15 + odkaz na produkční URL a PostHog dashboard ; odkazuje na `docs/brevo-setup.md` z Task 15).

---

## Část A – Tasks 1–4

> Pracovní adresář: kořen repozitáře `/home/claude/landing-page-etf` (dále jen „kořen"). Všechny příkazy se spouštějí z kořene. Node ≥ 20 (ověřeno 22.x).

---

### Task 1: Kostra projektu, design tokeny, Base layout, 404, operator

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `tests/setup.ts`
- Create: `src/styles/tokens.scss`, `src/styles/global.scss`
- Create: `src/layouts/Base.astro`, `src/pages/index.astro` (dočasný – nahradí Task 11), `src/pages/404.astro`, `public/favicon.svg`
- Create: `src/lib/operator.ts`
- Test: `tests/unit/operator.test.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Consumes: –
- Produces:
  - `src/layouts/Base.astro` props `{ title: string; description: string; noindex?: boolean; ogImage?: string }` (výchozí `ogImage = '/og.png'`, převádí se na absolutní URL přes `Astro.site`).
  - `src/lib/operator.ts`: `export const OPERATOR: { name: string; ico: string; address: string; email: string; phone: string; web: string }`.
  - `src/styles/tokens.scss`: `$paper`, `$ink`, `$signal`, `$muted`, `$rule`, `$font-text`, `$font-mono`, `$s1`…`$s6`; `src/styles/global.scss` z nich vytvoří CSS proměnné `--paper`, `--ink`, `--signal`, `--muted`, `--rule` na `:root`.
  - npm skripty: `dev`, `build`, `test`, `test:e2e`, `lint`. (`prebuild` pro PDF přidá až Task 13 – viz poznámka v kroku 2.)

**Rozhodnutí (závazná pro další úkoly):**

| Token | Hodnota | Kontrast na `$paper` | Použití |
|---|---|---|---|
| `$paper` | `#F6F3EA` | – | pozadí (papírově bílá, lehce teplá) |
| `$ink` | `#141414` | 16,6 : 1 | text, rámečky karet |
| `$signal` | `#0B5D3B` | 7,2 : 1 (bílý text na `$signal` 7,95 : 1) | jediná signální barva: tlačítka, šipka `⇄`, nejnižší TER |
| `$muted` | `#5C5A52` | 6,2 : 1 | sekundární text, zdroje, data |
| `$rule` | `#C9C3B3` | 1,6 : 1 (jen dekorativní linky, nikdy text) | linky tabulek, oddělovače |
| `$font-text` | `'Newsreader Variable', 'Iowan Old Style', Georgia, serif` | | nadpisy i text – „novinová" serifová antikva s opsz osou |
| `$font-mono` | `'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace` | | tickery, ISIN, TER, částky; vždy s `font-variant-numeric: tabular-nums` |
| `$s1…$s6` | `0.25rem`, `0.5rem`, `1rem`, `1.5rem`, `2rem`, `3rem` | | rozestupy |

Fonty self-hostované přes `@fontsource-variable/newsreader` (celá osa `wght`, import `@fontsource-variable/newsreader/index.css`) a `@fontsource/ibm-plex-mono` (váhy 400 a 600: `@fontsource/ibm-plex-mono/400.css`, `/600.css`). Oba balíčky obsahují subsety `latin` + `latin-ext` s `unicode-range`, takže prohlížeč stáhne jen to, co čeština potřebuje; `font-display: swap` je výchozí.

- [ ] **Step 1: Inicializovat package.json a nainstalovat závislosti**

```bash
cd /home/claude/landing-page-etf
npm init -y
npm pkg set name="indexak" private=true type="module" engines.node=">=20"
npm pkg delete main scripts.test
npm install astro@^5 @astrojs/react@^4 @astrojs/vercel@^8 react@^19 react-dom@^19 \
  @fontsource-variable/newsreader@^5 @fontsource/ibm-plex-mono@^5
npm install -D typescript@^5 @astrojs/check@^0.9 @types/react@^19 @types/react-dom@^19 sass@^1 \
  vitest@^3 jsdom@^26 @testing-library/react@^16 @testing-library/dom@^10 @testing-library/jest-dom@^6 \
  @playwright/test@^1
npx playwright install chromium
```
Očekávaný výsledek: `package.json` obsahuje uvedené závislosti s majory 5/4/8/19/…; `npx astro --version` vypíše `5.x`.

> Ruční `package.json` místo `npm create astro`: kořen už obsahuje `docs/` a `.git`, šablona by přidala nepotřebné soubory a vlastní README.

- [ ] **Step 2: Nastavit npm skripty a .gitignore**

```bash
npm pkg set scripts.dev="astro dev" scripts.build="astro build" scripts.test="vitest run" \
  scripts.test:e2e="playwright test" scripts.lint="astro check"
```
`.gitignore`:
```
node_modules/
dist/
.astro/
.vercel/
.env
.env.*
!.env.example
test-results/
playwright-report/
```
Poznámka: `prebuild` (generování PDF) přidá Task 13 spolu se `scripts/build-pdf.tsx`; teď by build selhal na chybějícím skriptu.

- [ ] **Step 3: Vytvořit `.env.example`** (všechny proměnné ze spec §10, prázdné hodnoty)

```dotenv
# Brevo (server)
BREVO_API_KEY=
BREVO_LIST_ID=
BREVO_DOI_TEMPLATE_ID=
# Meta (Pixel ID je veřejné, CAPI token jen server)
META_PIXEL_ID=
META_CAPI_TOKEN=
META_TEST_EVENT_CODE=
# Analytika (klient)
PUBLIC_POSTHOG_KEY=
PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
PUBLIC_META_PIXEL_ID=
PUBLIC_GA4_ID=
# Web
SITE_URL=http://localhost:4321
# Upstash rate limit (server)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 4: Konfigurace Astro, TypeScript, Vitest, Playwright**

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  output: 'static',
  adapter: vercel(),
  integrations: [react()],
  trailingSlash: 'never',
});
```
`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules"],
  "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "react", "resolveJsonModule": true }
}
```
`vitest.config.ts` – `defineConfig` z `vitest/config`: `test.include = ['tests/unit/**/*.test.{ts,tsx}', 'tests/api/**/*.test.ts']`, `test.environment = 'node'` (komponentové testy si přepnou `// @vitest-environment jsdom` v hlavičce souboru), `test.setupFiles = ['tests/setup.ts']`.
`tests/setup.ts`: jediný řádek `import '@testing-library/jest-dom/vitest';`.
`playwright.config.ts`:
- `testDir: 'tests/e2e'`, `use.baseURL: process.env.BASE_URL ?? 'http://localhost:4321'`,
- `projects: [{ name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } }]` (Chromium – emulace iPhonu by vyžadovala WebKit),
- `webServer`: jen když není `BASE_URL` → `{ command: 'npm run dev -- --port 4321', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI }` (`astro preview` adaptér Vercel nepodporuje; Task 15 pouští E2E proti nasazené URL přes `BASE_URL`).

- [ ] **Step 5: Napsat failing unit test pro operátora**

`tests/unit/operator.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { OPERATOR } from '../../src/lib/operator';

describe('OPERATOR', () => {
  it('holds Clientelo footer data', () => {
    expect(OPERATOR).toEqual({
      name: 'Clientelo Czech s.r.o.',
      ico: '22193456',
      address: 'Platnéřská 90/13, Staré Město, 110 00 Praha 1',
      email: 'fundraising@clientelo.cz',
      phone: '+420 725 345 102',
      web: 'https://clientelo.cz',
    });
  });
  it('ICO has a valid Czech checksum', () => {
    const d = OPERATOR.ico.split('').map(Number);
    const sum = d.slice(0, 7).reduce((s, n, i) => s + n * (8 - i), 0);
    expect((11 - (sum % 11)) % 10).toBe(d[7]);
  });
});
```

- [ ] **Step 6: Spustit a ověřit FAIL**

```bash
npx vitest run tests/unit/operator.test.ts
```
Očekáváno: FAIL – `Failed to resolve import "../../src/lib/operator"`.

- [ ] **Step 7: Implementovat `src/lib/operator.ts`**

`export const OPERATOR = { … } as const satisfies { name: string; ico: string; address: string; email: string; phone: string; web: string };` s hodnotami přesně z testu. Komentář nad konstantou: `// Převzato z patičky clientelo.cz; k odsouhlasení Clienteliem (spec §16). Jediné místo s údaji provozovatele.`

- [ ] **Step 8: Spustit a ověřit PASS**

```bash
npx vitest run tests/unit/operator.test.ts
```
Očekáváno: `2 passed`.

- [ ] **Step 9: Vytvořit design tokeny a globální styly**

`src/styles/tokens.scss` – proměnné přesně dle tabulky výše (žádné další barvy).
`src/styles/global.scss`:
- `@use 'tokens' as *;`
- `:root { --paper: #{$paper}; --ink: #{$ink}; --signal: #{$signal}; --muted: #{$muted}; --rule: #{$rule}; color-scheme: light; }`
- `*, *::before, *::after { box-sizing: border-box; }`, `body { margin: 0; background: var(--paper); color: var(--ink); font-family: $font-text; font-size: 1.0625rem; line-height: 1.5; -webkit-text-size-adjust: 100%; }`
- `code, kbd, samp { font-family: $font-mono; font-variant-numeric: tabular-nums; }`
- `a { color: var(--ink); text-decoration-color: var(--signal); text-underline-offset: 0.15em; }`
- `:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }`
- `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }`
- žádné přechody, stíny ani `backdrop-filter`.

- [ ] **Step 10: Napsat failing E2E smoke test**

`tests/e2e/smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('homepage returns 200, lang cs, indexable, paper background', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https?:\/\/.+\/og\.png$/);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(246, 243, 234)');
});

test('unknown URL renders 404 page with noindex', async ({ page }) => {
  const res = await page.goto('/neexistujici-stranka');
  expect(res?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.getByRole('link', { name: 'Zpět na úvod' })).toHaveAttribute('href', '/');
});
```

- [ ] **Step 11: Spustit a ověřit FAIL**

```bash
npx playwright test tests/e2e/smoke.spec.ts
```
Očekáváno: FAIL – dev server vrátí 404 pro `/` (stránky zatím neexistují), `expect(res?.status()).toBe(200)` → `Received: 404`.

- [ ] **Step 12: Implementovat `Base.astro`, `index.astro`, `404.astro`, favicon**

`src/layouts/Base.astro`:
- Frontmatter: `interface Props { title: string; description: string; noindex?: boolean; ogImage?: string }`; importy `'@fontsource-variable/newsreader/index.css'`, `'@fontsource/ibm-plex-mono/400.css'`, `'@fontsource/ibm-plex-mono/600.css'`, `'../styles/global.scss'`; `const canonical = new URL(Astro.url.pathname, Astro.site)`; `const og = new URL(ogImage ?? '/og.png', Astro.site)`.
- `<html lang="cs">`, v `<head>` v tomto pořadí: `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>{title}</title>`, `<meta name="description">`, `{noindex && <meta name="robots" content="noindex, nofollow">}`, `<link rel="canonical">` (jen když `!noindex`), `<meta name="theme-color" content="#F6F3EA">`, `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`, OG: `og:type=website`, `og:locale=cs_CZ`, `og:site_name=Indexák`, `og:title`, `og:description`, `og:url`, `og:image` (absolutní), `og:image:width=1200`, `og:image:height=630`, `twitter:card=summary_large_image`.
- `<body><slot /></body>`. Analytiku a cookie lištu doplní Task 5.

`src/pages/index.astro` (dočasný, Task 11 ho přepíše): `<Base title="Indexák – evropská dvojčata amerických ETF" description="Které evropské ETF sledují stejný index jako VOO, SPY a IVV a kolik stojí.">` s `<main><h1>Indexák</h1></main>`.

`src/pages/404.astro`: `<Base title="Stránka nenalezena · Indexák" description="Tato stránka neexistuje." noindex>`, `<main>` s `<h1>Tuhle stránku nemáme.</h1>`, odstavec „Odkaz je možná zastaralý.“ a `<a href="/">Zpět na úvod</a>`.

`public/favicon.svg`: čtverec 32×32 s pozadím `#0B5D3B` a bílým znakem `⇄` (text v SVG, `font-family="monospace"`).

Poznámka: `public/og.png` (1200×630) v kostře nemá vlastníka – viz rozpory na konci části A. Smoke test kontroluje jen meta tag, ne existenci souboru.

- [ ] **Step 13: Spustit E2E a build, ověřit PASS**

```bash
npx playwright test tests/e2e/smoke.spec.ts
npm run build
npm run lint
npm test
```
Očekáváno: Playwright `2 passed`; build skončí `Complete!` a vytvoří `.vercel/output/static/index.html`; `astro check` `0 errors`; Vitest `2 passed`.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example astro.config.mjs tsconfig.json \
  vitest.config.ts playwright.config.ts tests/setup.ts tests/unit/operator.test.ts tests/e2e/smoke.spec.ts \
  src/styles src/layouts/Base.astro src/pages/index.astro src/pages/404.astro src/lib/operator.ts public/favicon.svg
git commit -m "chore: scaffold Astro 5 project with design tokens, base layout, 404 and operator data"
```

---

### Task 2: Data fondů – types, etf-pairs.json (ověřená), pairs.ts

**Files:**
- Create: `src/lib/types.ts` (doslovná kopie „Shared Contracts" z kostry, nic navíc)
- Create: `src/data/etf-pairs.json`
- Create: `src/lib/pairs.ts`
- Test: `tests/unit/pairs.test.ts`

**Interfaces:**
- Consumes: `src/lib/types.ts` (`Sourced`, `Fund`, `Group`, `GroupId`, `EtfData`).
- Produces (`src/lib/pairs.ts`):
  - `getData(): EtfData`
  - `getGroup(id: GroupId): Group` – neznámé id → `throw new Error('Unknown group: ' + id)`
  - `getFund(id: string): Fund` – neznámé id → `throw new Error('Unknown fund: ' + id)`
  - `twinsSortedByTer(id: GroupId): Fund[]` – vzestupně podle `ter.value`, při shodě abecedně podle `id`
  - `originalsOf(id: GroupId): Fund[]` – v pořadí z `group.originals`
  - `validateData(d: EtfData): string[]` – prázdné pole = OK; každá chyba má tvar `"<cesta>: <zpráva>"` (viz Step 5)

**Rozhodnutí o skupinách (dle spec §5.1):**

| Group `id` | `label` | `originals` | `twins` | `exactTwin` | `calcEnabled` | `note` |
|---|---|---|---|---|---|---|
| `sp500` | `S&P 500` | `VOO, SPY, IVV` | `SPYL, VUAA, CSPX` | `true` | `true` | – |
| `world` | `Celý svět` | `VT` | `SPYY, VWCE, FWRA` | `false` | `true` | `VT sleduje FTSE Global All Cap. Evropské fondy sledují příbuzné indexy (MSCI ACWI, FTSE All-World) – liší se hlavně podílem malých firem.` |
| `us-total` | `Celý americký trh` | `VTI` | `ZPR3` | `false` | `false` | `Přesné dvojče neexistuje. Nejbližší alternativa sleduje Russell 3000 místo CRSP US Total Market – oba pokrývají prakticky celý americký trh.` |
| `us-dividend` | `Americké dividendové akcie` | `SCHD` | `FUSD` | `false` | `false` | `UCITS fond na index Dow Jones U.S. Dividend 100 neexistuje. Alternativa sleduje jiný index – americké firmy s kvalitou a dividendovým výnosem.` |

Volba dividendové alternativy pro SCHD: **Fidelity US Quality Income UCITS ETF (Dist)** (`FUSD`, ISIN `IE00BYXVGX24`) – jako SCHD kombinuje kvalitativní filtr a dividendový výnos, jen USA, fyzická replikace, nejnižší TER z amerických dividendových UCITS kandidátů. Pokud se u Fidelity nepotvrdí fyzická replikace nebo některé pole, použije se náhradník **SPDR S&P US Dividend Aristocrats UCITS ETF (Dist)** (`IE00B6YX5D40`, id = ticker ověřený u SSGA). Pokud nejde ověřit ani ten, `twins: []` a FundCard ukáže jen poznámku.

Pravidlo pro Russell 3000: fond `ZPR3` (SPDR Russell 3000 US Total Market UCITS ETF, `IE00BKY7WX37`, ticker na Xetře `ZPR3`) se do JSON dá jen s TER ověřeným na ssga.com. Jinak `us-total.twins = []` a poznámka se změní na `Přesné dvojče neexistuje.` + vysvětlení indexu bez jmenování fondu.

**Výchozí očekávání hodnot (spec §6; implementátor KAŽDOU ověří u vydavatele):**

| id | kind | ISIN (očekávané) | TER | exchange (očekávaná) | dom. | dist. | index |
|---|---|---|---|---|---|---|---|
| VOO | us | US9229083632 | 0.03 | NYSE Arca | US | dist | S&P 500 |
| SPY | us | US78462F1030 | 0.0945 | NYSE Arca | US | dist | S&P 500 |
| IVV | us | US4642872000 | 0.03 | NYSE Arca | US | dist | S&P 500 |
| VTI | us | US9229087690 | 0.03 | NYSE Arca | US | dist | CRSP US Total Market |
| VT | us | US9220427424 | 0.06 | NYSE Arca | US | dist | FTSE Global All Cap |
| SCHD | us | US8085247976 | 0.06 | NYSE Arca | US | dist | Dow Jones U.S. Dividend 100 |
| SPYL | ucits | IE000XZSV718 | 0.03 | Xetra | IE | acc | S&P 500 |
| VUAA | ucits | IE00BFMXXD54 | 0.07 | Xetra | IE | acc | S&P 500 |
| CSPX | ucits | IE00B5BMR087 | 0.07 | London Stock Exchange | IE | acc | S&P 500 |
| SPYY | ucits | IE00B44Z5B48 | 0.12 | Xetra | IE | acc | MSCI ACWI |
| VWCE | ucits | IE00BK5BQT80 | 0.14 (od 28. 7. 2026) | Xetra | IE | acc | FTSE All-World |
| FWRA | ucits | IE000716YHJ7 | 0.15 | London Stock Exchange | IE | acc | FTSE All-World |
| ZPR3 | ucits | IE00BKY7WX37 | ověřit | Xetra | IE | acc | Russell 3000 |
| FUSD | ucits | IE00BYXVGX24 | 0.25 | London Stock Exchange | IE | dist | Fidelity US Quality Income |

Všechny ISINy v tabulce mají platnou kontrolní číslici (ověřeno při psaní plánu). Všechny UCITS fondy musí mít `replication.value === 'physical'`.

- [ ] **Step 1: Vytvořit `src/lib/types.ts`**

Zkopírovat blok „Shared Contracts" z `00-skeleton.md` beze změny (komentář `// src/lib/types.ts` vynechat). Ověření: `npx tsc --noEmit -p .` bez chyb.

- [ ] **Step 2: Ověřit data fondů u vydavatelů**

Pro každý fond z tabulky otevřít stránku produktu/factsheet vydavatele (WebFetch; URL najít přes WebSearch `site:<doména> <ISIN>`):
- Vanguard US: `investor.vanguard.com` (VOO, VTI, VT); Vanguard UCITS: `vanguard.co.uk` nebo `de.vanguard` (VUAA, VWCE)
- SSGA: `ssga.com` (SPY, SPYL, SPYY, ZPR3, případně SPYD)
- iShares: `ishares.com` (IVV, CSPX)
- Schwab: `schwabassetmanagement.com` (SCHD)
- Invesco: `invesco.com` (FWRA)
- Fidelity: `fidelity.co.uk` / `fidelityinternational.com` (FUSD)

Pro každý fond zapsat do pracovní tabulky (scratchpad, necommitovat): `name`, `isin`, `ter`, `exchange`, `domicile`, `distribution`, `replication`, `index`, `kidUrl` (UCITS: odkaz na KID v češtině, pokud existuje, jinak anglicky; US fondy KID nemají – `kidUrl` vynechat), přesnou URL, ze které hodnota pochází, a datum ověření (dnešní, `YYYY-MM-DD`).

Pravidla:
- Hodnota nalezená jen u agregátoru (justETF, trackinsight…) se **nezapisuje**.
- Liší-li se zdroj od tabulky výše, platí vydavatel; tabulku v plánu neupravovat, změnu zapsat do commit message.
- Fond, u kterého nejde ověřit kterékoli povinné pole, se do JSON nedá (u ZPR3 a FUSD platí pravidla výše). Pokud by šlo o fond skupiny `sp500`, úkol se zastaví a eskaluje (BLOCKED) – karta v hero bez něj nedává smysl.
- `exchange` u UCITS fondu = burza, na které má fond právě ticker rovný `id` (např. CSPX → London Stock Exchange; na Xetře je CSPX pod tickerem SXR8 – to řeší brokers.json).

Výsledek: pracovní tabulka 14 (nebo méně dle pravidel) fondů, každé pole s https URL a datem.

- [ ] **Step 3: Zapsat `src/data/etf-pairs.json`**

Struktura `EtfData`: `asOf` = datum ověření; `funds` = objekt klíčovaný `id` (klíč === `fund.id`); každé pole `{ "value": …, "sourceUrl": "https://…", "asOf": "YYYY-MM-DD" }`; `groups` v pořadí `sp500`, `world`, `us-total`, `us-dividend` s hodnotami z tabulky skupin. Pořadí `originals` přesně `["VOO","SPY","IVV"]`. Ukázka jednoho fondu (hodnoty URL dle skutečného ověření):
```json
"SPYL": {
  "id": "SPYL", "kind": "ucits",
  "name": { "value": "SPDR S&P 500 UCITS ETF (Acc)", "sourceUrl": "https://www.ssga.com/…", "asOf": "2026-10-11" },
  "isin": { "value": "IE000XZSV718", "sourceUrl": "https://www.ssga.com/…", "asOf": "2026-10-11" },
  "ter": { "value": 0.03, "sourceUrl": "https://www.ssga.com/…", "asOf": "2026-10-11" },
  "…": "exchange, domicile, distribution, replication, index stejně",
  "kidUrl": "https://www.ssga.com/…kid…pdf"
}
```

- [ ] **Step 4: Napsat failing testy pro `pairs.ts`**

`tests/unit/pairs.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getData, getGroup, getFund, twinsSortedByTer, originalsOf, validateData } from '../../src/lib/pairs';
import type { EtfData } from '../../src/lib/types';

const SOURCED = ['name', 'isin', 'ter', 'exchange', 'domicile', 'distribution', 'replication', 'index'] as const;
const clone = (): EtfData => structuredClone(getData());

describe('etf-pairs.json', () => {
  it('passes validateData', () => {
    expect(validateData(getData())).toEqual([]);
  });
  it('every Sourced field has https sourceUrl and ISO asOf', () => {
    for (const f of Object.values(getData().funds))
      for (const k of SOURCED) {
        expect(f[k].sourceUrl, `${f.id}.${k}`).toMatch(/^https:\/\/\S+$/);
        expect(f[k].asOf, `${f.id}.${k}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
  });
  it('contains no synthetic fund and no QQQ', () => {
    const funds = Object.values(getData().funds);
    expect(funds.filter((f) => f.replication.value === 'synthetic')).toEqual([]);
    expect(Object.keys(getData().funds)).not.toContain('QQQ');
  });
  it('defines the four groups in order with spec flags', () => {
    expect(getData().groups.map((g) => [g.id, g.exactTwin, g.calcEnabled])).toEqual([
      ['sp500', true, true], ['world', false, true], ['us-total', false, false], ['us-dividend', false, false],
    ]);
  });
  it('sorts S&P 500 twins by TER, ties alphabetically', () => {
    expect(twinsSortedByTer('sp500').map((f) => f.id)).toEqual(['SPYL', 'CSPX', 'VUAA']);
  });
  it('returns S&P 500 originals in defined order', () => {
    expect(originalsOf('sp500').map((f) => f.id)).toEqual(['VOO', 'SPY', 'IVV']);
    expect(getFund('SPY').ter.value).toBe(0.0945);
  });
  it('throws on unknown ids', () => {
    expect(() => getFund('QQQ')).toThrow('Unknown fund: QQQ');
    expect(() => getGroup('nope' as never)).toThrow('Unknown group: nope');
  });
});

describe('validateData', () => {
  it('reports non-https sourceUrl', () => {
    const d = clone(); d.funds.SPYL.ter.sourceUrl = 'http://x.test';
    expect(validateData(d)).toContain('funds.SPYL.ter.sourceUrl: must be https');
  });
  it('reports non-ISO asOf', () => {
    const d = clone(); d.funds.SPYL.isin.asOf = '11. 10. 2026';
    expect(validateData(d)).toContain('funds.SPYL.isin.asOf: must be YYYY-MM-DD');
  });
  it('reports invalid ISIN check digit', () => {
    const d = clone(); d.funds.SPYL.isin.value = 'IE000XZSV719';
    expect(validateData(d)).toContain('funds.SPYL.isin: invalid ISIN');
  });
  it('reports missing group reference', () => {
    const d = clone(); d.groups[0].twins.push('XXXX');
    expect(validateData(d)).toContain('groups.sp500.twins: unknown fund XXXX');
  });
  it('reports synthetic twin', () => {
    const d = clone(); d.funds.VUAA.replication.value = 'synthetic';
    expect(validateData(d)).toContain('funds.VUAA.replication: synthetic funds are not allowed');
  });
  it('reports QQQ', () => {
    const d = clone(); d.funds.QQQ = { ...structuredClone(d.funds.VOO), id: 'QQQ' };
    expect(validateData(d)).toContain('funds.QQQ: QQQ is excluded');
  });
  it('reports kind mismatch in group', () => {
    const d = clone(); d.groups[0].originals.push('SPYL');
    expect(validateData(d)).toContain('groups.sp500.originals: SPYL must be kind us');
  });
});
```

- [ ] **Step 5: Spustit a ověřit FAIL**

```bash
npx vitest run tests/unit/pairs.test.ts
```
Očekáváno: FAIL – `Failed to resolve import "../../src/lib/pairs"`.

- [ ] **Step 6: Implementovat `src/lib/pairs.ts`**

- `import raw from '../data/etf-pairs.json';` a `const DATA = raw as unknown as EtfData;` (JSON literály TS rozšíří na `string`; správnost hlídá `validateData` v testu).
- `getData`, `getGroup`, `getFund`, `originalsOf`, `twinsSortedByTer` – přímé dotazy nad `DATA` dle Interfaces; řazení `(a, b) => a.ter.value - b.ter.value || a.id.localeCompare(b.id)`.
- `validateData(d)` kontroluje a vrací zprávy v přesně tomto tvaru:

| Kontrola | Zpráva |
|---|---|
| `d.asOf` je `YYYY-MM-DD` a platné datum | `asOf: must be YYYY-MM-DD` |
| klíč fondu === `fund.id` | `funds.<key>.id: must equal key` |
| každé z 8 Sourced polí: `sourceUrl` začíná `https://` | `funds.<id>.<field>.sourceUrl: must be https` |
| každé Sourced pole: `asOf` je `YYYY-MM-DD` a platné datum | `funds.<id>.<field>.asOf: must be YYYY-MM-DD` |
| ISIN `^[A-Z]{2}[A-Z0-9]{9}\d$` a kontrolní číslice (Luhn nad řetězcem, kde písmena → číslo A=10 … Z=35) | `funds.<id>.isin: invalid ISIN` |
| `0 < ter.value < 2` | `funds.<id>.ter: out of range` |
| `replication.value !== 'synthetic'` | `funds.<id>.replication: synthetic funds are not allowed` |
| id `QQQ` | `funds.QQQ: QQQ is excluded` |
| `kind === 'us'` ⇒ `exchange.value === 'NYSE Arca'` | `funds.<id>.exchange: US original must trade on NYSE Arca` |
| `kidUrl` (pokud je) začíná `https://` | `funds.<id>.kidUrl: must be https` |
| každý `GroupId` právě jednou | `groups: missing <id>` / `groups: duplicate <id>` |
| `originals`/`twins` odkazují na existující fond | `groups.<gid>.<originals\|twins>: unknown fund <fid>` |
| originals jsou `kind 'us'`, twins `kind 'ucits'` | `groups.<gid>.originals: <fid> must be kind us` / `groups.<gid>.twins: <fid> must be kind ucits` |
| `originals.length ≥ 1` | `groups.<gid>.originals: empty` |
| `exactTwin` nebo `calcEnabled` ⇒ `twins.length ≥ 2` | `groups.<gid>.twins: at least 2 required` |

- [ ] **Step 7: Spustit a ověřit PASS**

```bash
npx vitest run tests/unit/pairs.test.ts && npm run lint
```
Očekáváno: `14 passed`; `astro check` `0 errors`. Pokud po ověření dat neplatí pořadí `['SPYL','CSPX','VUAA']` (změna TER u vydavatele), upraví se očekávání testu podle ověřených hodnot a změna se uvede v commit message.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/data/etf-pairs.json src/lib/pairs.ts tests/unit/pairs.test.ts
git commit -m "feat: add verified ETF pair data with sources and validated data access layer"
```

---

### Task 3: Data brokerů – brokers.json (ověřená), twinsAtBroker

**Files:**
- Create: `src/data/brokers.json`
- Modify: `src/lib/pairs.ts` (přidat funkce, existující beze změny)
- Test: `tests/unit/brokers.test.ts`, `tests/unit/brokers-fixture.test.ts`

**Interfaces:**
- Consumes: Task 2 (`getData`, `twinsSortedByTer`, typy `Broker`, `BrokerId`, `BrokerListing`).
- Produces (v `src/lib/pairs.ts`):
  - `getBrokers(): Broker[]` – v pořadí `xtb`, `trading212`, `fio`, `degiro`
  - `getBroker(id: BrokerId): Broker` – neznámé id → `throw new Error('Unknown broker: ' + id)`
  - `twinsAtBroker(b: BrokerId, g: GroupId): { fund: Fund; ticker: string }[]` – jen listingy s `available.value === true`, pořadí jako `twinsSortedByTer(g)`, `ticker = listing.ticker.value`
  - `validateBrokers(b: Broker[], d: EtfData): string[]` – prázdné pole = OK

**Pravidla dat:**
- `listings` obsahují jen UCITS fondy ze `twins` některé skupiny.
- Listing se zapíše jen tehdy, když je dostupnost ověřená na webu brokera: `available: true` = fond nalezen ve vyhledávání / seznamu instrumentů brokera; `available: false` = jen když oficiální kompletní seznam instrumentů brokera (s URL) fond neobsahuje. Jinak se listing **vynechá** (pro `twinsAtBroker` totéž co nedostupný). Nikdy odhad.
- `ticker` = ticker, pod kterým fond u brokera najdete (může se lišit od `id`, např. CSPX na Xetře `SXR8`).
- `buyFee.value` = česká věta převzatá ze sazebníku, např. `0 Kč do objemu 100 000 EUR měsíčně, nad něj 0,2 % (min. 10 EUR)` – jen čísla doslova ze sazebníku.
- `steps.value` = 3–6 krátkých kroků v češtině (rozkazovací způsob, vykání: „Otevřete…", „Do vyhledávání zadejte ISIN…"), převzatých z nápovědy brokera; `sourceUrl` = článek nápovědy. Nenajde-li se nápověda k nákupu ETF, úkol se zastaví a eskaluje (BLOCKED) – kroky se nevymýšlejí.
- `asOf` brokera = datum ověření.

- [ ] **Step 1: Ověřit údaje u brokerů**

Pro každého brokera (WebFetch / WebSearch, jen oficiální domény):

| Broker | `id` | Kde ověřit |
|---|---|---|
| XTB | `xtb` | `xtb.com/cz` – sazebník / „Specifikace nástrojů" (ETF), vyhledávání instrumentů, nápověda „Jak koupit ETF" |
| Trading 212 | `trading212` | `trading212.com` – „Instruments" / vyhledávání, stránka poplatků, help centre |
| Fio banka | `fio` | `fio.cz` – sazebník e-Brokera (zahraniční trhy, Xetra/LSE), seznam obchodovatelných ETF, nápověda e-Broker |
| Degiro | `degiro` | `degiro.cz` – ceník, seznam „ETF Core Selection", nápověda k zadání pokynu |

Pro každou dvojici broker × fond z `twins` všech skupin (`SPYL, VUAA, CSPX, SPYY, VWCE, FWRA, ZPR3, FUSD` – jen ty, které jsou v `etf-pairs.json`) zapsat: dostupnost, ticker, burzu, URL a datum. Pro brokera zapsat `buyFee` a `steps` se zdrojem. Pracovní tabulka do scratchpadu.

Výsledek: každý údaj buď ověřen s https URL, nebo vynechán dle pravidel.

- [ ] **Step 2: Zapsat `src/data/brokers.json`**

Pole 4 objektů `Broker` v pořadí `xtb`, `trading212`, `fio`, `degiro`; `name`: `XTB`, `Trading 212`, `Fio banka`, `Degiro`. Ukázka jednoho listingu:
```json
{ "fundId": "CSPX",
  "ticker": { "value": "SXR8", "sourceUrl": "https://…", "asOf": "2026-10-11" },
  "available": { "value": true, "sourceUrl": "https://…", "asOf": "2026-10-11" } }
```

- [ ] **Step 3: Napsat failing testy nad reálnými daty**

`tests/unit/brokers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getData, getBrokers, getBroker, twinsAtBroker, twinsSortedByTer, validateBrokers } from '../../src/lib/pairs';
import type { Broker } from '../../src/lib/types';

const clone = (): Broker[] => structuredClone(getBrokers());

describe('brokers.json', () => {
  it('passes validateBrokers', () => {
    expect(validateBrokers(getBrokers(), getData())).toEqual([]);
  });
  it('lists the four brokers in order', () => {
    expect(getBrokers().map((b) => b.id)).toEqual(['xtb', 'trading212', 'fio', 'degiro']);
    expect(() => getBroker('revolut' as never)).toThrow('Unknown broker: revolut');
  });
  it('twinsAtBroker keeps TER order and only available listings', () => {
    for (const b of getBrokers()) {
      const order = twinsSortedByTer('sp500').map((f) => f.id);
      const got = twinsAtBroker(b.id, 'sp500');
      const ids = got.map((x) => x.fund.id);
      expect(ids).toEqual(order.filter((id) => ids.includes(id)));
      for (const x of got) {
        const l = b.listings.find((l) => l.fundId === x.fund.id)!;
        expect(l.available.value).toBe(true);
        expect(x.ticker).toBe(l.ticker.value);
      }
    }
  });
});

describe('validateBrokers', () => {
  it('reports unknown fundId', () => {
    const b = clone(); b[0].listings.push({ ...structuredClone(b[0].listings[0]), fundId: 'VOO' });
    expect(validateBrokers(b, getData())).toContain('brokers.xtb.listings.VOO: not a UCITS twin');
    const c = clone(); c[0].listings.push({ ...structuredClone(c[0].listings[0]), fundId: 'XXXX' });
    expect(validateBrokers(c, getData())).toContain('brokers.xtb.listings.XXXX: unknown fund');
  });
  it('reports non-https sources', () => {
    const b = clone(); b[1].buyFee.sourceUrl = 'http://x.test';
    expect(validateBrokers(b, getData())).toContain('brokers.trading212.buyFee.sourceUrl: must be https');
  });
  it('reports empty steps', () => {
    const b = clone(); b[2].steps.value = [];
    expect(validateBrokers(b, getData())).toContain('brokers.fio.steps: empty');
  });
});
```
Pozn.: testy předpokládají, že XTB má aspoň jeden listing; pokud ne, použije se v testu první broker s neprázdnými `listings` (index upravit, zprávy s jeho `id`).

`tests/unit/brokers-fixture.test.ts` (deterministický test filtrování a řazení přes mock JSON):
```ts
import { describe, it, expect, vi } from 'vitest';

const src = { sourceUrl: 'https://example.com', asOf: '2026-10-11' };
vi.mock('../../src/data/brokers.json', () => ({
  default: [{
    id: 'xtb', name: 'XTB', asOf: '2026-10-11',
    buyFee: { value: '0 Kč', ...src }, steps: { value: ['Krok'], ...src },
    listings: [
      { fundId: 'VUAA', ticker: { value: 'VUAA', ...src }, available: { value: true, ...src } },
      { fundId: 'CSPX', ticker: { value: 'SXR8', ...src }, available: { value: true, ...src } },
      { fundId: 'SPYL', ticker: { value: 'SPYL', ...src }, available: { value: false, ...src } },
    ],
  }],
}));

describe('twinsAtBroker (fixture)', () => {
  it('drops unavailable, sorts by TER then id, returns broker ticker', async () => {
    const { twinsAtBroker } = await import('../../src/lib/pairs');
    expect(twinsAtBroker('xtb', 'sp500').map((x) => [x.fund.id, x.ticker])).toEqual([['CSPX', 'SXR8'], ['VUAA', 'VUAA']]);
  });
});
```

- [ ] **Step 4: Spustit a ověřit FAIL**

```bash
npx vitest run tests/unit/brokers.test.ts tests/unit/brokers-fixture.test.ts
```
Očekáváno: FAIL – `getBrokers is not a function` / `does not provide an export named 'getBrokers'`.

- [ ] **Step 5: Implementovat v `src/lib/pairs.ts`**

- `import brokersRaw from '../data/brokers.json'; const BROKERS = brokersRaw as unknown as Broker[];`
- `getBrokers`, `getBroker`, `twinsAtBroker` dle Interfaces (`twinsSortedByTer(g)` → filtr na listingy brokera s `available.value === true` → mapování na `{ fund, ticker }`).
- `validateBrokers(b, d)` – zprávy přesně:

| Kontrola | Zpráva |
|---|---|
| ids jsou právě `xtb, trading212, fio, degiro` v tomto pořadí | `brokers: expected xtb,trading212,fio,degiro` |
| `asOf` broker `YYYY-MM-DD` | `brokers.<id>.asOf: must be YYYY-MM-DD` |
| `buyFee`, `steps`: `sourceUrl` https, `asOf` ISO | `brokers.<id>.<buyFee\|steps>.sourceUrl: must be https` / `….asOf: must be YYYY-MM-DD` |
| `buyFee.value` neprázdný | `brokers.<id>.buyFee: empty` |
| `steps.value.length ≥ 1` | `brokers.<id>.steps: empty` |
| listing `fundId` existuje v `d.funds` | `brokers.<id>.listings.<fundId>: unknown fund` |
| listing `fundId` je v `twins` některé skupiny | `brokers.<id>.listings.<fundId>: not a UCITS twin` |
| `fundId` u brokera nejvýše jednou | `brokers.<id>.listings.<fundId>: duplicate` |
| `ticker` a `available`: https + ISO | `brokers.<id>.listings.<fundId>.<ticker\|available>.sourceUrl: must be https` / `….asOf: must be YYYY-MM-DD` |
| `ticker.value` odpovídá `^[A-Z0-9.]{2,12}$` | `brokers.<id>.listings.<fundId>.ticker: invalid` |

- [ ] **Step 6: Spustit a ověřit PASS**

```bash
npx vitest run tests/unit && npm run lint
```
Očekáváno: všechny unit testy zelené (operator 2, pairs 14, brokers 6, fixture 1); `astro check` `0 errors`.

- [ ] **Step 7: Commit**

```bash
git add src/data/brokers.json src/lib/pairs.ts tests/unit/brokers.test.ts tests/unit/brokers-fixture.test.ts
git commit -m "feat: add verified broker availability data and twinsAtBroker lookup"
```

---

### Task 4: Kalkulace a formátování – calc.ts, format.ts

**Files:**
- Create: `src/lib/calc.ts`, `src/lib/format.ts`
- Test: `tests/unit/calc.test.ts`, `tests/unit/format.test.ts`

**Interfaces:**
- Consumes: –
- Produces:
  - `src/lib/calc.ts`: `MODEL_RETURN = 0.07`, `COMPARISON_TER = 1.5`, `LIMITS = { monthly: { min: 500, max: 50000, default: 3000 }, years: { min: 5, max: 40, default: 20 } } as const`, `clampInputs(monthly: unknown, years: unknown): { monthly: number; years: number }`, `futureValue(monthly: number, years: number, annualReturn: number, terPercent: number): number`, `computeFees(input: { monthly: number; years: number; funds: { id: string; ter: number }[]; annualReturn?: number }): FeeResult`, `export type FeeResult = { deposited: number; gross: number; rows: { id: string; ter: number; fv: number; feesPaid: number }[]; comparison: { ter: number; fv: number; feesPaid: number } }`.
  - `src/lib/format.ts`: `formatCzk(n: number): string`, `formatTer(p: number): string`.

**Model (spec §5.2):** Rᵢ = R − TER/100; rᵢ = (1 + Rᵢ)^(1/12) − 1; n = years · 12; FVᵢ = C · ((1 + rᵢ)ⁿ − 1) / rᵢ (vklad na konci měsíce); pro rᵢ = 0 je FVᵢ = C · n. `gross` = FV s TER 0; `feesPaid` = `gross − fv`; `deposited` = C · n.

**Chování `clampInputs` (Review Focus 3):** pro každý vstup: `number` se použije přímo; `string` se zbaví všech bílých znaků včetně NBSP (`/[\s  ]/g`), `,` → `.`, pak `Number()`; prázdný řetězec, `null`, `undefined`, jiný typ nebo nekonečná/NaN hodnota → `default`; jinak `Math.round` a ořezání do `[min, max]`. `computeFees` volá `clampInputs` na `monthly` a `years`, takže výstup nikdy neobsahuje `NaN` ani záporné číslo.

**Formát:** oddělovač tisíců i mezera před `Kč` a `%` je NBSP ` ` (Intl v některých ICU vrací ` `, proto se výstup Intl normalizuje: všechny `\s`/` ` → ` `). `formatCzk`: `Math.round(n / 100) * 100`, `-0` → `0`, `Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 })` + `' Kč'`. `formatTer`: `Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` + `' %'`.

- [ ] **Step 1: Napsat failing testy pro `calc.ts`**

`tests/unit/calc.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MODEL_RETURN, COMPARISON_TER, LIMITS, clampInputs, futureValue, computeFees } from '../../src/lib/calc';

const near = (actual: number, expected: number, tol: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

describe('constants', () => {
  it('match spec', () => {
    expect(MODEL_RETURN).toBe(0.07);
    expect(COMPARISON_TER).toBe(1.5);
    expect(LIMITS).toEqual({ monthly: { min: 500, max: 50000, default: 3000 }, years: { min: 5, max: 40, default: 20 } });
  });
});

describe('futureValue', () => {
  it('3000 Kč / 20 let / 7 % / TER 0,03', () => near(futureValue(3000, 20, 0.07, 0.03), 1517433, 5));
  it('TER 0 = gross', () => near(futureValue(3000, 20, 0.07, 0), 1522609, 5));
  it('TER difference 0,03 vs 0,07 ≈ 6 870', () =>
    near(futureValue(3000, 20, 0.07, 0.03) - futureValue(3000, 20, 0.07, 0.07), 6870, 5));
  it('TER difference 0,03 vs 0,15 ≈ 20 507', () =>
    near(futureValue(3000, 20, 0.07, 0.03) - futureValue(3000, 20, 0.07, 0.15), 20507, 5));
  it('TER difference 0,03 vs 1,5 ≈ 230 837', () =>
    near(futureValue(3000, 20, 0.07, 0.03) - futureValue(3000, 20, 0.07, 1.5), 230837, 10));
  it('zero net return returns plain sum, no division by zero', () =>
    expect(futureValue(1000, 10, 0.015, 1.5)).toBe(120000));
});

describe('clampInputs', () => {
  it.each([
    ['', 20, { monthly: 3000, years: 20 }],
    ['3 000', 20, { monthly: 3000, years: 20 }],
    ['3 000', '25', { monthly: 3000, years: 25 }],
    [0, 20, { monthly: 500, years: 20 }],
    [-100, 20, { monthly: 500, years: 20 }],
    [999999, 20, { monthly: 50000, years: 20 }],
    ['abc', 20, { monthly: 3000, years: 20 }],
    [3000, NaN, { monthly: 3000, years: 20 }],
    [3000, 2, { monthly: 3000, years: 5 }],
    [3000, '45', { monthly: 3000, years: 40 }],
    [2999.6, 19.6, { monthly: 3000, years: 20 }],
    [undefined, null, { monthly: 3000, years: 20 }],
  ])('clampInputs(%j, %j)', (m, y, expected) => expect(clampInputs(m, y)).toEqual(expected));
});

describe('computeFees', () => {
  const funds = [{ id: 'SPYL', ter: 0.03 }, { id: 'CSPX', ter: 0.07 }, { id: 'VUAA', ter: 0.07 }];
  const r = computeFees({ monthly: 3000, years: 20, funds });

  it('deposited = 720 000', () => expect(r.deposited).toBe(720000));
  it('gross = FV at TER 0', () => expect(r.gross).toBe(futureValue(3000, 20, MODEL_RETURN, 0)));
  it('keeps fund order and computes feesPaid = gross − fv', () => {
    expect(r.rows.map((x) => x.id)).toEqual(['SPYL', 'CSPX', 'VUAA']);
    for (const row of r.rows) {
      expect(row.fv).toBe(futureValue(3000, 20, MODEL_RETURN, row.ter));
      expect(row.feesPaid).toBe(r.gross - row.fv);
    }
    near(r.rows[0].feesPaid, 5176, 5);
  });
  it('SPYL vs VUAA fee difference ≈ 6 870', () => near(r.rows[2].feesPaid - r.rows[0].feesPaid, 6870, 5));
  it('comparison row uses COMPARISON_TER', () => {
    expect(r.comparison.ter).toBe(1.5);
    near(r.comparison.feesPaid, 236013, 10);
    near(r.rows[0].fv - r.comparison.fv, 230837, 10);
  });
  it('clamps invalid input instead of producing NaN', () => {
    const bad = computeFees({ monthly: NaN, years: -3, funds });
    expect(bad.deposited).toBe(3000 * 5 * 12);
    for (const n of [bad.gross, ...bad.rows.flatMap((x) => [x.fv, x.feesPaid]), bad.comparison.feesPaid]) {
      expect(Number.isFinite(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Spustit a ověřit FAIL**

```bash
npx vitest run tests/unit/calc.test.ts
```
Očekáváno: FAIL – `Failed to resolve import "../../src/lib/calc"`.

- [ ] **Step 3: Implementovat `src/lib/calc.ts`**

Konstanty a typ `FeeResult` přesně dle Interfaces. `futureValue` dle vzorce v sekci Model (větev `r === 0` → `monthly * n`). `clampInputs` dle „Chování clampInputs". `computeFees`: `const { monthly, years } = clampInputs(input.monthly, input.years)`; `R = input.annualReturn ?? MODEL_RETURN`; `gross = futureValue(monthly, years, R, 0)`; `rows = input.funds.map(f => ({ id: f.id, ter: f.ter, fv, feesPaid: gross - fv }))` (pořadí beze změny – řadí volající přes `twinsSortedByTer`); `comparison` stejně s `COMPARISON_TER`; `deposited = monthly * years * 12`. Žádné zaokrouhlování v `calc.ts` – zaokrouhluje jen `formatCzk`.

- [ ] **Step 4: Spustit a ověřit PASS**

```bash
npx vitest run tests/unit/calc.test.ts
```
Očekáváno: všechny testy `passed` (25).

- [ ] **Step 5: Napsat failing testy pro `format.ts`**

`tests/unit/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatCzk, formatTer } from '../../src/lib/format';

const NB = ' ';

describe('formatCzk', () => {
  it.each([
    [6870, `6${NB}900${NB}Kč`],
    [20507, `20${NB}500${NB}Kč`],
    [230837, `230${NB}800${NB}Kč`],
    [1517433, `1${NB}517${NB}400${NB}Kč`],
    [720000, `720${NB}000${NB}Kč`],
    [950, `1${NB}000${NB}Kč`],
    [50, `100${NB}Kč`],
    [49, `0${NB}Kč`],
    [-0.4, `0${NB}Kč`],
  ])('formatCzk(%d)', (n, s) => expect(formatCzk(n)).toBe(s));

  it('uses no plain or narrow spaces', () => expect(formatCzk(1517433)).not.toMatch(/[  ]/));
});

describe('formatTer', () => {
  it.each([
    [0.0945, `0,09${NB}%`],
    [0.03, `0,03${NB}%`],
    [0.07, `0,07${NB}%`],
    [0.12, `0,12${NB}%`],
    [1.5, `1,50${NB}%`],
  ])('formatTer(%d)', (p, s) => expect(formatTer(p)).toBe(s));
});
```

- [ ] **Step 6: Spustit a ověřit FAIL**

```bash
npx vitest run tests/unit/format.test.ts
```
Očekáváno: FAIL – `Failed to resolve import "../../src/lib/format"`.

- [ ] **Step 7: Implementovat `src/lib/format.ts`**

Dva moduly-level formátovače `Intl.NumberFormat('cs-CZ', …)` (instancovat jednou) a funkce dle sekce Formát; normalizace mezer `s.replace(/[\s ]/g, ' ')`; `-0` ošetřit `Math.round(n / 100) * 100 || 0`.

- [ ] **Step 8: Spustit a ověřit PASS**

```bash
npx vitest run tests/unit && npm run lint
```
Očekáváno: všechny unit testy zelené (format 15 nových); `astro check` `0 errors`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/calc.ts src/lib/format.ts tests/unit/calc.test.ts tests/unit/format.test.ts
git commit -m "feat: add fee calculator model and Czech currency/TER formatting"
```

---


## Část B – souhlas, analytika, API, formulář (Task 5–8)

**Ověřená externí API (k 11. 10. 2026), na která se úkoly odkazují:**

| API | Co používáme | Zdroj |
|---|---|---|
| Brevo – double opt-in | `POST https://api.brevo.com/v3/contacts/doubleOptinConfirmation`, hlavička `api-key`; povinné `email`, `includeListIds: number[]`, `templateId: number`, `redirectionUrl`; volitelné `attributes`; úspěch `201` (prázdné tělo, akceptujeme i `204`); chyba `400` | https://developers.brevo.com/reference/createdoicontact |
| Brevo – kontakt | `POST https://api.brevo.com/v3/contacts`; `ext_id` stačí jako identifikátor (e-mail povinný jen bez `ext_id`/`SMS`), `attributes.SMS`, `updateEnabled: true`; úspěch `201`/`204`; konflikt identifikátoru → 4xx | https://developers.brevo.com/reference/createcontact |
| Brevo – formát chyb | tělo `{ "code": "duplicate_parameter", "message": "…" }`; kódy `duplicate_parameter`, `invalid_parameter`, `unauthorized`, … | https://developers.brevo.com/docs/how-it-works |
| Meta Conversions API | `POST https://graph.facebook.com/v25.0/{PIXEL_ID}/events?access_token=…`; `data[]` s `event_name`, `event_time` (unix s), `event_id`, `action_source: 'website'`, `event_source_url`, `user_data.em` (trim + lowercase + SHA-256), `client_ip_address` a `client_user_agent` (nehashovat, UA povinný pro web); `test_event_code` na nejvyšší úrovni vedle `data` | https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api , https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters |
| PostHog JS | `posthog.init(key, { api_host: 'https://eu.i.posthog.com', person_profiles: 'identified_only', cookieless_mode: 'always' })`; `always` = žádné cookies ani storage (v projektu musí být zapnuté „Cookieless server hash mode"); `identify()` v režimu `always` posílá trvalé ID → bez souhlasu ho nevoláme | https://posthog.com/docs/libraries/js/config , https://posthog.com/tutorials/cookieless-tracking |
| Upstash ratelimit | `new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix })`, `await rl.limit(key)` → `{ success, … }` | https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms |
| Astro 5 endpointy | `src/pages/api/*.ts`, v `output: 'static'` nutné `export const prerender = false`; `export const POST: APIRoute`; `context.clientAddress` = IP požadavku (jen on-demand routy) | https://docs.astro.build/en/guides/endpoints/ , https://docs.astro.build/en/reference/api-reference/ |

**Konvence části B:**
- Testy v `jsdom` začínají řádkem `// @vitest-environment jsdom`, API testy `// @vitest-environment node`.
- Serverové moduly čtou env přes `process.env.X` **v okamžiku volání** (ne při importu), aby šly v testech měnit `vi.stubEnv`. Klientské moduly čtou `import.meta.env.PUBLIC_*`.
- Endpointy nevolají `context.redirect`; 303 vrací jako `new Response(null, { status: 303, headers: { Location } })`, aby testy stačil kontext `{ request, clientAddress }`.
- `UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i` – lokální (neexportovaná) konstanta v souborech, které ji potřebují.

---

### Task 5: Souhlas a analytika – consent.ts, track.ts, ConsentBanner, /cookies

**Files:**
- Create: `src/lib/consent.ts`, `src/lib/track.ts`, `src/components/ConsentBanner.tsx`, `src/pages/cookies.astro`
- Modify: `src/layouts/Base.astro` (vložení lišty a spuštění analytiky), `src/styles/global.scss` (styly `.consent`)
- Test: `tests/unit/consent.test.ts`, `tests/unit/track.test.ts`, `tests/unit/ConsentBanner.test.tsx`

**Interfaces:**
- Consumes: `EventName` z `src/lib/types.ts` (Task 2), `OPERATOR` z `src/lib/operator.ts` (Task 1), `Base.astro` (Task 1), env `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST`, `PUBLIC_GA4_ID`, `PUBLIC_META_PIXEL_ID` (viz rozpory na konci části).
- Produces:
  - `src/lib/consent.ts`: `CONSENT_VERSION = '2026-10-11'`, `type ConsentState = { analytics: boolean; meta: boolean; ga4: boolean; version: string; decidedAt: string }`, `getConsent(): ConsentState | null`, `setConsent(c: Pick<ConsentState,'analytics'|'meta'|'ga4'>): ConsentState`, `onConsentChange(cb: (c: ConsentState) => void): () => void`, `openConsentSettings(): void`.
  - `src/lib/track.ts`: `initAnalytics(): void`, `track(e: EventName, props?: Record<string, string | number | boolean>): void`, `getAid(): string`, `getUtm(): Record<string, string>`, `firePixelLead(eventId: string): void`.
  - `ConsentBanner.tsx` (bez props); stránka `/cookies`.
  - DOM kontrakt pro Task 11 (patička) a `/cookies`: libovolný `<button type="button" data-consent-open>` otevře nastavení (ConsentBanner poslouchá kliknutí na dokumentu), takže statická Astro komponenta nepotřebuje vlastní skript.

- [ ] **Step 1: Doinstalovat závislost**

```bash
npm i posthog-js@^1
```
Očekávání: `posthog-js` je v `dependencies` v `package.json`.

- [ ] **Step 2: Napsat failing testy pro consent.ts** – `tests/unit/consent.test.ts` (jsdom)

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_VERSION, getConsent, setConsent, onConsentChange, openConsentSettings } from '../../src/lib/consent';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('consent', () => {
  it('returns null when nothing is stored', () => {
    expect(getConsent()).toBeNull();
  });
  it('stores state under ix_consent with version and ISO time', () => {
    const s = setConsent({ analytics: true, meta: false, ga4: false });
    expect(s).toEqual({ analytics: true, meta: false, ga4: false, version: '2026-10-11', decidedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
    expect(JSON.parse(localStorage.getItem('ix_consent')!)).toEqual(s);
    expect(getConsent()).toEqual(s);
    expect(CONSENT_VERSION).toBe('2026-10-11');
  });
  it('returns null for corrupted JSON', () => {
    localStorage.setItem('ix_consent', '{oops');
    expect(getConsent()).toBeNull();
  });
  it('returns null for a different version (re-ask after text change)', () => {
    localStorage.setItem('ix_consent', JSON.stringify({ analytics: true, meta: true, ga4: true, version: '2025-01-01', decidedAt: '2025-01-01T00:00:00.000Z' }));
    expect(getConsent()).toBeNull();
  });
  it('survives blocked storage: get → null, set → returns state without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(getConsent()).toBeNull();
    expect(setConsent({ analytics: false, meta: false, ga4: false }).analytics).toBe(false);
  });
  it('notifies subscribers and supports unsubscribe', () => {
    const cb = vi.fn();
    const off = onConsentChange(cb);
    setConsent({ analytics: false, meta: true, ga4: false });
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ analytics: false, meta: true, ga4: false }));
    off();
    setConsent({ analytics: true, meta: true, ga4: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });
  it('openConsentSettings dispatches ix:consent-open on window', () => {
    const cb = vi.fn();
    window.addEventListener('ix:consent-open', cb);
    openConsentSettings();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Spustit, očekávat FAIL**

```bash
npx vitest run tests/unit/consent.test.ts
```
Očekávaný výstup: `FAIL tests/unit/consent.test.ts` … `Failed to resolve import "../../src/lib/consent"`.

- [ ] **Step 4: Implementovat `src/lib/consent.ts`**
  - Exporty přesně dle Interfaces. Klíč `localStorage` `'ix_consent'`.
  - `getConsent()`: `try { JSON.parse(localStorage.getItem('ix_consent')) } catch { return null }`; vrací `null`, když chybí, není objekt se třemi booleany nebo `version !== CONSENT_VERSION`. Na serveru (`typeof window === 'undefined'`) vrací `null`.
  - `setConsent(c)`: složí `{ ...c, version: CONSENT_VERSION, decidedAt: new Date().toISOString() }`, zápis v `try/catch` (selhání ignoruje), dispatchne `new CustomEvent('ix:consent-change', { detail: state })` na `window`, vrátí stav.
  - `onConsentChange(cb)`: listener na `ix:consent-change` volá `cb(e.detail)`; vrací funkci, která listener odebere.
  - `openConsentSettings()`: `window.dispatchEvent(new Event('ix:consent-open'))`.

- [ ] **Step 5: Spustit, očekávat PASS**

```bash
npx vitest run tests/unit/consent.test.ts
```
Očekávání: `7 passed`.

- [ ] **Step 6: Napsat failing testy pro track.ts** – `tests/unit/track.test.ts` (jsdom, mock `posthog-js`; Review Focus 4)

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted: the same mock object survives vi.resetModules() in load()
const posthog = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn() }));
vi.mock('posthog-js', () => ({ default: posthog }));

const AID = '11111111-1111-4111-8111-111111111111';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const consent = (c: { analytics: boolean; meta: boolean; ga4: boolean }) =>
  localStorage.setItem('ix_consent', JSON.stringify({ ...c, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' }));
const load = async () => { vi.resetModules(); return import('../../src/lib/track'); };
const ready = () => vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.head.innerHTML = '';
  delete (window as any).fbq; delete (window as any).gtag; delete (window as any).dataLayer;
  history.replaceState({}, '', '/');
  vi.stubEnv('PUBLIC_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('PUBLIC_POSTHOG_HOST', 'https://eu.i.posthog.com');
  vi.stubEnv('PUBLIC_META_PIXEL_ID', '1234567890');
  vi.stubEnv('PUBLIC_GA4_ID', 'G-TEST123');
});

describe('track without consent', () => {
  it('inits PostHog cookieless, never identifies, never sends aid', async () => {
    const t = await load();
    t.initAnalytics(); await ready();
    expect(posthog.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({
      api_host: 'https://eu.i.posthog.com', cookieless_mode: 'always', person_profiles: 'identified_only',
    }));
    t.track('form_viewed', { placement: 'hero' });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith('form_viewed', { placement: 'hero' }, undefined));
    expect(posthog.identify).not.toHaveBeenCalled();
    for (const call of posthog.capture.mock.calls) expect(call[1]).not.toHaveProperty('aid');
  });
  it('loads neither Meta Pixel nor GA4 and sets Consent Mode v2 default denied', async () => {
    const t = await load();
    t.initAnalytics(); await ready();
    expect(document.querySelector('script[src*="connect.facebook.net"]')).toBeNull();
    expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    expect(Array.from((window as any).dataLayer[0])).toEqual(['consent', 'default', {
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied',
    }]);
  });
  it('firePixelLead is a no-op without meta consent', async () => {
    const t = await load();
    t.initAnalytics(); await ready();
    expect(() => t.firePixelLead('evt-1')).not.toThrow();
    expect((window as any).fbq).toBeUndefined();
  });
});

describe('track with consent', () => {
  it('analytics consent → persistent mode + identify(aid from URL)', async () => {
    consent({ analytics: true, meta: false, ga4: false });
    history.replaceState({}, '', `/dekujeme?aid=${AID}`);
    const t = await load();
    t.initAnalytics(); await ready();
    const cfg = posthog.init.mock.calls[0][1] as Record<string, unknown>;
    expect(cfg.cookieless_mode).toBeUndefined();
    expect(cfg.persistence).toBe('localStorage+cookie');
    expect(posthog.identify).toHaveBeenCalledWith(AID);
  });
  it('consent granted mid-session → identify, Pixel and GA4 load, consent update', async () => {
    const t = await load();
    const { setConsent } = await import('../../src/lib/consent');
    t.initAnalytics(); await ready();
    setConsent({ analytics: true, meta: true, ga4: true });
    await vi.waitFor(() => expect(posthog.identify).toHaveBeenCalledWith(t.getAid()));
    expect(document.querySelector('script[src="https://connect.facebook.net/en_US/fbevents.js"]')).not.toBeNull();
    expect(document.querySelector('script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]')).not.toBeNull();
    expect((window as any).dataLayer.map((a: IArguments) => Array.from(a)))
      .toContainEqual(['consent', 'update', { analytics_storage: 'granted' }]);
  });
  it('firePixelLead sends Lead with eventID for dedup', async () => {
    consent({ analytics: false, meta: true, ga4: false });
    const t = await load();
    t.initAnalytics(); await ready();
    const fbq = vi.fn(); (window as any).fbq = fbq;
    t.firePixelLead('evt-1');
    expect(fbq).toHaveBeenCalledWith('track', 'Lead', {}, { eventID: 'evt-1' });
  });
});

describe('helpers', () => {
  it('getAid: from ?aid=, otherwise a stable in-memory UUID', async () => {
    let t = await load();
    const a = t.getAid();
    expect(a).toMatch(UUID);
    expect(t.getAid()).toBe(a);
    history.replaceState({}, '', `/?aid=${AID}`);
    t = await load();
    expect(t.getAid()).toBe(AID);
  });
  it('getAid ignores a malformed ?aid=', async () => {
    history.replaceState({}, '', '/?aid=<script>');
    const t = await load();
    expect(t.getAid()).toMatch(UUID);
  });
  it('getUtm returns only utm_* params present in the URL', async () => {
    history.replaceState({}, '', '/?utm_source=meta&utm_campaign=launch&utm_content=b&foo=1');
    const t = await load();
    expect(t.getUtm()).toEqual({ utm_source: 'meta', utm_campaign: 'launch', utm_content: 'b' });
  });
  it('form_submitted is sent instantly via sendBeacon (survives redirect)', async () => {
    const t = await load();
    t.initAnalytics(); await ready();
    t.track('form_submitted', { placement: 'hero' });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith(
      'form_submitted', { placement: 'hero' }, { send_instantly: true, transport: 'sendBeacon' }));
  });
  it('without PUBLIC_POSTHOG_KEY: no init, track does not throw', async () => {
    vi.stubEnv('PUBLIC_POSTHOG_KEY', '');
    const t = await load();
    t.initAnalytics();
    expect(() => t.track('page_view')).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
    expect(posthog.init).not.toHaveBeenCalled();
  });
  it('initAnalytics twice → init once; page_view sent with UTM and path', async () => {
    history.replaceState({}, '', '/?utm_source=meta&utm_content=a');
    const t = await load();
    t.initAnalytics(); t.initAnalytics(); await ready();
    expect(posthog.init).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledWith(
      'page_view', { path: '/', utm_source: 'meta', utm_content: 'a' }, undefined));
  });
});
```

- [ ] **Step 7: Spustit, očekávat FAIL**

```bash
npx vitest run tests/unit/track.test.ts
```
Očekávaný výstup: `FAIL tests/unit/track.test.ts` … `Failed to resolve import "../../src/lib/track"`.

- [ ] **Step 8: Implementovat `src/lib/track.ts`**
  - Exporty přesně dle Interfaces, nic dalšího.
  - Stav modulu: `aid` (lazy), `ph` (instance po načtení), `queue: [EventName, props][]`, `started: boolean`, `loaded = { meta: false, ga4: false }`, `lastConsent`.
  - `getAid()`: `?aid=` z `location.search`, pokud vyhovuje `UUID_RE`; jinak jednou `crypto.randomUUID()` a drží v paměti (nic neukládá do storage).
  - `getUtm()`: z `location.search` jen neprázdné `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` (nic se neukládá).
  - `initAnalytics()` (při druhém volání nic nedělá):
    1. GA4 Consent Mode v2: `window.dataLayer ??= []`, `window.gtag = function () { dataLayer.push(arguments) }`, `gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' })`.
    2. `apply(getConsent())` pro Pixel/GA4 (viz níže).
    3. Pokud chybí `PUBLIC_POSTHOG_KEY` → konec (track bude no-op).
    4. `const { default: posthog } = await import('posthog-js')` (dynamicky – PostHog není v kritické cestě hydratace ostrůvků), `posthog.init(key, cfg)` kde `cfg = { api_host: PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com', person_profiles: 'identified_only', capture_pageview: false, autocapture: false, disable_session_recording: true }` a navíc bez souhlasu `analytics` `cookieless_mode: 'always'`, se souhlasem `persistence: 'localStorage+cookie'` a po init `posthog.identify(getAid())`.
    5. Vyprázdní frontu, pošle `page_view` s `{ path: location.pathname, ...getUtm() }` (variantu hero lze v PostHogu odvodit z `utm_content`).
    6. `onConsentChange(apply)`.
  - `apply(c)`: `c?.meta && !loaded.meta` → stub `fbq` (standardní snippet: fronta + `fbq.version='2.0'`), `<script async src="https://connect.facebook.net/en_US/fbevents.js">`, `fbq('init', PUBLIC_META_PIXEL_ID)`, `fbq('track', 'PageView')`. `c?.ga4 && !loaded.ga4` → `<script async src="https://www.googletagmanager.com/gtag/js?id=${PUBLIC_GA4_ID}">`, `gtag('consent','update',{ analytics_storage: 'granted' })`, `gtag('js', new Date())`, `gtag('config', PUBLIC_GA4_ID)`. `c?.analytics` a dříve ne → `ph?.identify(getAid())`. Pokud byl některý účel dříve `true` a nyní `false` → `location.reload()` (načtené skripty nelze spolehlivě vypnout; po reloadu se nenačtou).
  - `track(e, props = {})`: nikdy nepřidává `aid`; volá `ph.capture(e, props, e === 'form_submitted' ? { send_instantly: true, transport: 'sendBeacon' } : undefined)`, před načtením řadí do fronty. Výjimky z PostHogu polyká (`try/catch`).
  - `firePixelLead(eventId)`: jen když `getConsent()?.meta === true` a `typeof window.fbq === 'function'` → `fbq('track', 'Lead', {}, { eventID: eventId })`.
  - Deklarace `window.fbq`, `window.gtag`, `window.dataLayer` v `declare global` uvnitř souboru.

- [ ] **Step 9: Spustit, očekávat PASS**

```bash
npx vitest run tests/unit/track.test.ts
```
Očekávání: `12 passed`.

- [ ] **Step 10: Napsat failing testy pro ConsentBanner** – `tests/unit/ConsentBanner.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ConsentBanner from '../../src/components/ConsentBanner';
import { getConsent, setConsent, openConsentSettings } from '../../src/lib/consent';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('ConsentBanner', () => {
  it('shows Odmítnout and Přijmout vše with identical styling', () => {
    render(<ConsentBanner />);
    const reject = screen.getByRole('button', { name: 'Odmítnout' });
    const accept = screen.getByRole('button', { name: 'Přijmout vše' });
    expect(reject.className).toBe(accept.className);
    expect(screen.getByRole('link', { name: /cookies/i }).getAttribute('href')).toBe('/cookies');
  });
  it('Odmítnout stores all purposes false and hides the banner', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Odmítnout' }));
    expect(getConsent()).toMatchObject({ analytics: false, meta: false, ga4: false });
    expect(screen.queryByRole('region', { name: 'Souhlas s cookies' })).toBeNull();
  });
  it('Přijmout vše stores all purposes true', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Přijmout vše' }));
    expect(getConsent()).toMatchObject({ analytics: true, meta: true, ga4: true });
  });
  it('Nastavení offers unchecked purposes; saving only Meta stores only Meta', () => {
    render(<ConsentBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení' }));
    const boxes = [/Analytika/, /Meta/, /Google Analytics 4/].map((n) => screen.getByRole('checkbox', { name: n }) as HTMLInputElement);
    expect(boxes.map((b) => b.checked)).toEqual([false, false, false]);
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Uložit volbu' }));
    expect(getConsent()).toMatchObject({ analytics: false, meta: true, ga4: false });
  });
  it('hidden when decided; reopens with saved state via openConsentSettings and [data-consent-open]', () => {
    setConsent({ analytics: true, meta: false, ga4: false });
    render(<><ConsentBanner /><button type="button" data-consent-open>Nastavení cookies</button></>);
    expect(screen.queryByRole('region', { name: 'Souhlas s cookies' })).toBeNull();
    act(() => openConsentSettings());
    expect((screen.getByRole('checkbox', { name: /Analytika/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Uložit volbu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nastavení cookies' }));
    expect(screen.getByRole('region', { name: 'Souhlas s cookies' })).toBeTruthy();
  });
});
```

- [ ] **Step 11: Spustit, očekávat FAIL**

```bash
npx vitest run tests/unit/ConsentBanner.test.tsx
```
Očekávaný výstup: `Failed to resolve import "../../src/components/ConsentBanner"`.

- [ ] **Step 12: Implementovat `src/components/ConsentBanner.tsx`** (default export, bez props)
  - Stav: `open` (výchozí `getConsent() === null`), `settings` (bool), `draft` (`{analytics, meta, ga4}` z uloženého stavu nebo samé `false`).
  - `useEffect`: listener `ix:consent-open` → `open = true, settings = true, draft = getConsent() ?? all false`; delegovaný `click` na `document` pro `target.closest('[data-consent-open]')` → `openConsentSettings()`.
  - Markup: `<section role="region" aria-label="Souhlas s cookies" className="consent">`, text: „Bez souhlasu měříme jen anonymně a bez cookies, kolik lidí stránku navštívilo a odeslalo formulář. Se souhlasem použijeme analytiku PostHog, Meta Pixel a Google Analytics 4." + odkaz `<a href="/cookies">Podrobnosti o cookies</a>`. Tlačítka `Odmítnout`, `Přijmout vše` (obě `className="consent__btn"`), `Nastavení` (`consent__link`). V nastavení tři `<label><input type="checkbox">` s texty „Analytika (PostHog)", „Sdílení s Meta pro měření reklam (Meta Pixel a Conversions API)", „Google Analytics 4" a tlačítko `Uložit volbu` (`consent__btn`). Každá volba → `setConsent(...)`, `open = false`.
  - SCSS v `global.scss`: `.consent` fixně dole, `background: var(--paper)`, `border-top: 1px solid var(--rule)`; `.consent__btn` jeden styl (stejná výška, rámeček `var(--ink)`, bez barevného zvýraznění jednoho z tlačítek); min. velikost cíle 44 px.

- [ ] **Step 13: Spustit, očekávat PASS**

```bash
npx vitest run tests/unit/ConsentBanner.test.tsx
```
Očekávání: `5 passed`.

- [ ] **Step 14: Zapojit do `src/layouts/Base.astro`** – na konec `<body>`:

```astro
<ConsentBanner client:only="react" />
<script>
  import { initAnalytics } from '../lib/track';
  const start = () => initAnalytics();
  if ('requestIdleCallback' in window) requestIdleCallback(start); else setTimeout(start, 1);
</script>
```
`client:only` – lišta se nerenderuje na serveru (stav je jen v `localStorage`), fixní pozice → žádný CLS.

- [ ] **Step 15: Vytvořit `src/pages/cookies.astro`** (Base, `title="Cookies a měření"`), sekce:
  1. **Kdo** – provozovatel z `OPERATOR` (`name`, `ico`, `address`, `email`).
  2. **Účely** (tabulka účel / nástroj / právní základ / doba): nezbytné uložení volby (`localStorage` `ix_consent`, do změny volby); anonymní měření bez cookies (PostHog cookieless, bez trvalého identifikátoru); analytika se souhlasem (PostHog, cookie `ph_*`); sdílení s Meta pro měření reklam (Meta Pixel cookie `_fbp` + Conversions API: hash e-mailu, IP, prohlížeč – jen se souhlasem); Google Analytics 4 (cookie `_ga`, `_ga_*`). Doby uložení cookies převzít z dokumentace nástrojů k datu publikace a uvést ten den.
  3. **Příjemci**: PostHog Inc. (EU cloud, Frankfurt), Meta Platforms Ireland Ltd., Google Ireland Ltd., Brevo (Sendinblue SAS) – jen pro formulář, Upstash – krátkodobě IP adresa pro ochranu před zneužitím.
  4. **Odvolání**: „Souhlas můžete kdykoli změnit nebo odvolat:" + `<button type="button" data-consent-open>Změnit nastavení cookies</button>`; odkaz na `/zasady-ochrany-osobnich-udaju`.
  5. Poznámka „Verze textu: 2026-10-11" (shodná s `CONSENT_VERSION`).

- [ ] **Step 16: Ověřit build stránky**

```bash
npx astro build && grep -c -e "Meta Platforms Ireland" -e "data-consent-open" -e "ix_consent" .vercel/output/static/cookies/index.html
```
Očekávání: build bez chyb, `grep` vypíše číslo ≥ 3. (Přímo `astro build`, ne `npm run build` – `prebuild` s PDF vzniká až v Task 13.)

- [ ] **Step 17: Celá sada + commit**

```bash
npx vitest run && git add src/lib/consent.ts src/lib/track.ts src/components/ConsentBanner.tsx src/pages/cookies.astro src/layouts/Base.astro src/styles/global.scss tests/unit/consent.test.ts tests/unit/track.test.ts tests/unit/ConsentBanner.test.tsx package.json package-lock.json && git commit -m "feat: consent state, consent-gated analytics, cookie banner and /cookies page"
```

---

### Task 6: API /api/subscribe + validate.ts + server/*

**Files:**
- Create: `src/lib/validate.ts`, `src/server/parse-body.ts`, `src/server/ratelimit.ts`, `src/server/brevo.ts`, `src/server/meta-capi.ts`, `src/pages/api/subscribe.ts`
- Test: `tests/unit/validate.test.ts`, `tests/unit/parse-body.test.ts`, `tests/unit/ratelimit.test.ts`, `tests/unit/brevo.test.ts`, `tests/api/helpers.ts`, `tests/api/subscribe.test.ts`

**Interfaces:**
- Consumes: `BrokerId`, `Placement` (`src/lib/types.ts`); env `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_DOI_TEMPLATE_ID`, `SITE_URL`, `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Produces (přesně dle kostry):
  - `src/lib/validate.ts`: `isValidEmail(s: string): boolean`, `normalizeCzPhone(s: string): string | null`.
  - `src/server/parse-body.ts`: `parseBody(req: Request): Promise<{ data: Record<string, string>; isForm: boolean }>`.
  - `src/server/ratelimit.ts`: `checkRateLimit(key: string): Promise<boolean>`.
  - `src/server/brevo.ts`: `createDoiContact(...)`, `upsertProfile(i: ProfileInput)`, `type ProfileInput` (signatury dle kostry).
  - `src/server/meta-capi.ts`: `sendLeadEvent(i: { email; eventId; ip; userAgent; sourceUrl }): Promise<void>` (nikdy nehází).
  - `POST /api/subscribe`: vstupní pole a odpovědi dle kostry; JSON `{ ok: true, redirect: '/dekujeme?aid=…' } | { ok: false, error: 'invalid_email' | 'rate_limited' | 'server' }`; form → 303.
- Brevo atributy, které musí v účtu existovat (podklad pro `docs/brevo-setup.md`, Task 15): `AID`, `PAIR`, `PLACEMENT`, `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `UTM_CONTENT`, `CONSENT_TEXT_VERSION`, `CONSENT_AT` (text), `CALC_DEPOSIT`, `CALC_HORIZON` (číslo); pro Task 7 navíc `BROKER` (text), `SMS`, `CONSENT_CALL`, `CONSENT_PARTNERS` (boolean), `CONSENT_CALL_AT` (text).

- [ ] **Step 1: Doinstalovat závislosti**

```bash
npm i @upstash/ratelimit@^2 @upstash/redis@^1
```

- [ ] **Step 2: Failing test validace** – `tests/unit/validate.test.ts` (Review Focus 5)

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isValidEmail, normalizeCzPhone } from '../../src/lib/validate';

describe('isValidEmail', () => {
  it.each([
    ['jan.novak@seznam.cz', true],
    [' Jan.Novak@Email.CZ ', true],
    ['jana+etf@post.example.co.uk', true],
    ['', false],
    ['jan@seznam', false],
    ['jan@@seznam.cz', false],
    ['jan novak@seznam.cz', false],
    ['@seznam.cz', false],
    ['jan@seznam.c', false],
    [`${'a'.repeat(250)}@x.cz`, false],
  ])('%s → %s', (input, ok) => expect(isValidEmail(input)).toBe(ok));
});

describe('normalizeCzPhone', () => {
  it.each([
    ['777 123 456', '+420777123456'],
    ['+420777123456', '+420777123456'],
    ['00420 777 123 456', '+420777123456'],
    ['+420 777-123-456', '+420777123456'],
    ['420777123456', '+420777123456'],
    ['(+420) 601 234 567', '+420601234567'],
  ])('%s → %s', (input, out) => expect(normalizeCzPhone(input)).toBe(out));
  it.each(['+421 905 123 456', '12345', '', '777 123 4567', '+420 077 123 456', '+420 777 123 45a'])(
    '%s → null', (input) => expect(normalizeCzPhone(input)).toBeNull());
});
```

- [ ] **Step 3: Spustit, očekávat FAIL**

```bash
npx vitest run tests/unit/validate.test.ts
```
Očekávaný výstup: `Failed to resolve import "../../src/lib/validate"`.

- [ ] **Step 4: Implementovat `src/lib/validate.ts`** (sdíleno klient/server, bez závislostí)
  - `isValidEmail(s)`: `t = s.trim()`; `t.length <= 254` a `/^[^\s@]+@([^\s@.]+\.)+[^\s@.]{2,}$/.test(t)`.
  - `normalizeCzPhone(s)`: odstranit mezery, `-`, `.`, `(`, `)`; prefix `00420` → `+420`; 12 číslic začínajících `420` → `+` + číslice; 9 číslic → `+420` + číslice; výsledek musí odpovídat `/^\+420[2-9]\d{8}$/`, jinak `null`.

- [ ] **Step 5: Spustit, očekávat PASS**

```bash
npx vitest run tests/unit/validate.test.ts
```
Očekávání: `22 passed`.

- [ ] **Step 6: Failing test parseBody** – `tests/unit/parse-body.test.ts`

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parseBody } from '../../src/server/parse-body';

const req = (body: BodyInit, type: string) =>
  new Request('https://indexak.vercel.app/api/subscribe', { method: 'POST', headers: { 'content-type': type }, body });

describe('parseBody', () => {
  it('parses JSON and stringifies scalar values', async () => {
    expect(await parseBody(req(JSON.stringify({ email: 'a@b.cz', calc_deposit: 3000, consent_call: true }), 'application/json')))
      .toEqual({ data: { email: 'a@b.cz', calc_deposit: '3000', consent_call: 'true' }, isForm: false });
  });
  it('parses x-www-form-urlencoded as form', async () => {
    expect(await parseBody(req('email=a%40b.cz&placement=hero', 'application/x-www-form-urlencoded')))
      .toEqual({ data: { email: 'a@b.cz', placement: 'hero' }, isForm: true });
  });
  it('drops nested objects/arrays and null', async () => {
    expect((await parseBody(req(JSON.stringify({ a: { b: 1 }, c: [1], d: null, e: 'x' }), 'application/json'))).data)
      .toEqual({ e: 'x' });
  });
  it('malformed JSON → empty data', async () => {
    expect(await parseBody(req('{oops', 'application/json'))).toEqual({ data: {}, isForm: false });
  });
  it('unknown content type → empty data, not form', async () => {
    expect(await parseBody(req('x', 'text/plain'))).toEqual({ data: {}, isForm: false });
  });
});
```

- [ ] **Step 7: Spustit, očekávat FAIL** – `npx vitest run tests/unit/parse-body.test.ts` → `Failed to resolve import "../../src/server/parse-body"`.

- [ ] **Step 8: Implementovat `src/server/parse-body.ts`**
  - `content-type` obsahuje `application/json` → `await req.json()` v `try/catch`; z objektu vezme klíče s hodnotou `string | number | boolean` a převede `String(v)`.
  - obsahuje `application/x-www-form-urlencoded` nebo `multipart/form-data` → `await req.formData()`, jen položky typu `string`, `isForm: true`.
  - jinak `{ data: {}, isForm: false }`.

- [ ] **Step 9: Spustit, očekávat PASS** – `npx vitest run tests/unit/parse-body.test.ts` → `5 passed`.

- [ ] **Step 10: Failing test rate limitu** – `tests/unit/ratelimit.test.ts`

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { limit, ctor } = vi.hoisted(() => ({ limit: vi.fn(), ctor: vi.fn() }));
vi.mock('@upstash/ratelimit', () => {
  class Ratelimit { constructor(o: unknown) { ctor(o); } limit = limit; static slidingWindow = vi.fn(() => 'sw'); }
  return { Ratelimit };
});
vi.mock('@upstash/redis', () => ({ Redis: class { constructor(public o: unknown) {} } }));

const load = async () => { vi.resetModules(); return (await import('../../src/server/ratelimit')).checkRateLimit; };

beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe('checkRateLimit', () => {
  it('without Upstash env → true and a warning, no Redis', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', ''); vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await (await load())('subscribe:1.2.3.4')).toBe(true);
    expect(warn).toHaveBeenCalled();
    expect(ctor).not.toHaveBeenCalled();
  });
  describe('with env', () => {
    beforeEach(() => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://eu1-test.upstash.io');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok');
    });
    it('uses slidingWindow(5, "10 m") and passes the key', async () => {
      limit.mockResolvedValue({ success: true });
      const check = await load();
      expect(await check('subscribe:1.2.3.4')).toBe(true);
      const { Ratelimit } = await import('@upstash/ratelimit');
      expect(Ratelimit.slidingWindow).toHaveBeenCalledWith(5, '10 m');
      expect(limit).toHaveBeenCalledWith('subscribe:1.2.3.4');
    });
    it('over the limit → false', async () => {
      limit.mockResolvedValue({ success: false });
      expect(await (await load())('subscribe:1.2.3.4')).toBe(false);
    });
    it('Redis error → fail open (true) and console.error', async () => {
      limit.mockRejectedValue(new Error('timeout'));
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(await (await load())('subscribe:1.2.3.4')).toBe(true);
      expect(err).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 11: Spustit, očekávat FAIL** – `npx vitest run tests/unit/ratelimit.test.ts` → `Failed to resolve import "../../src/server/ratelimit"`.

- [ ] **Step 12: Implementovat `src/server/ratelimit.ts`**
  - Bez `UPSTASH_REDIS_REST_URL`/`_TOKEN` → `console.warn('[ratelimit] Upstash env missing – rate limiting disabled')`, `return true`.
  - Jinak lazy singleton `new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'ix' })`; `return (await rl.limit(key)).success`.
  - Výjimka → `console.error`, `return true` (fail open: výpadek Redis nesmí zablokovat leady z placené reklamy).

- [ ] **Step 13: Spustit, očekávat PASS** – `npx vitest run tests/unit/ratelimit.test.ts` → `4 passed`.

- [ ] **Step 14: Failing test Brevo klienta** – `tests/unit/brevo.test.ts` (mapování odpovědí; detail těla ověřují API testy)

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDoiContact, upsertProfile } from '../../src/server/brevo';

const AID = '11111111-1111-4111-8111-111111111111';
const res = (status: number, body?: object) => new Response(body ? JSON.stringify(body) : null, { status });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('BREVO_API_KEY', 'test-key'); vi.stubEnv('BREVO_LIST_ID', '7');
  vi.stubEnv('BREVO_DOI_TEMPLATE_ID', '12'); vi.stubEnv('SITE_URL', 'https://indexak.vercel.app');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const doi = () => createDoiContact({ email: 'jan.novak@seznam.cz', aid: AID, attributes: { AID } });
const prof = () => upsertProfile({ aid: AID, phone: '+420777123456', consentCall: true, consentTextVersion: '2026-10-11' });

describe('createDoiContact', () => {
  it.each([
    [res(201, {}), { ok: true }],
    [res(204), { ok: true }],
    [res(400, { code: 'duplicate_parameter', message: 'Contact already exist' }), { ok: true }],
    [res(400, { code: 'invalid_parameter', message: 'Invalid email address' }), { ok: false, error: 'brevo' }],
    [res(401, { code: 'unauthorized', message: 'Key not found' }), { ok: false, error: 'brevo' }],
    [res(500), { ok: false, error: 'brevo' }],
  ])('response → %#', async (r, expected) => {
    fetchMock.mockResolvedValue(r);
    expect(await doi()).toEqual(expected);
  });
  it('network error → brevo', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    expect(await doi()).toEqual({ ok: false, error: 'brevo' });
  });
  it('missing BREVO_API_KEY → brevo without fetch', async () => {
    vi.stubEnv('BREVO_API_KEY', '');
    expect(await doi()).toEqual({ ok: false, error: 'brevo' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('upsertProfile', () => {
  it.each([
    [res(201, { id: 21 }), { ok: true }],
    [res(204), { ok: true }],
    [res(400, { code: 'duplicate_parameter', message: 'Unable to update contact, SMS is already associated with another Contact' }), { ok: false, error: 'phone_taken' }],
    [res(400, { code: 'invalid_parameter', message: 'Invalid phone number' }), { ok: false, error: 'brevo' }],
    [res(500), { ok: false, error: 'brevo' }],
  ])('response → %#', async (r, expected) => {
    fetchMock.mockResolvedValue(r);
    expect(await prof()).toEqual(expected);
  });
});
```

- [ ] **Step 15: Spustit, očekávat FAIL** – `npx vitest run tests/unit/brevo.test.ts` → `Failed to resolve import "../../src/server/brevo"`.

- [ ] **Step 16: Implementovat `src/server/brevo.ts`**
  - Exporty: `type ProfileInput` (dle kostry), `createDoiContact`, `upsertProfile`. Interní `brevoPost(path, body)`: `fetch('https://api.brevo.com/v3' + path, { method: 'POST', headers: { 'api-key': BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) })`; čte JSON chyby `{ code, message }` (prázdné tělo tolerovat). Každá chyba → `console.error('[brevo]', status, code)` (bez e-mailu a telefonu v logu).
  - `createDoiContact({ email, aid, attributes })` → `POST /contacts/doubleOptinConfirmation` s tělem `{ email, includeListIds: [Number(BREVO_LIST_ID)], templateId: Number(BREVO_DOI_TEMPLATE_ID), redirectionUrl: `${SITE_URL}/potvrzeno?aid=${aid}`, attributes }`. `201`/`204` → ok; `400` s `code === 'duplicate_parameter'` → ok (duplicita = úspěch, Review Focus 2); jinak `brevo`.
  - `upsertProfile(i)` → `POST /contacts` s tělem `{ ext_id: i.aid, updateEnabled: true, attributes }`, kde `attributes = { AID: aid, CONSENT_TEXT_VERSION }` + `BROKER` (je-li `broker`) + při `phone`: `SMS: phone`, `CONSENT_CALL: consentCall === true`, `CONSENT_PARTNERS: consentPartners === true`, `CONSENT_CALL_AT: new Date().toISOString()`. `201`/`204` → ok; `400` + `duplicate_parameter` a byl zadán `phone` → `phone_taken`; jinak `brevo`.
  - Typ `attributes`: `Record<string, string | number | boolean>`.
  - Ruční ověření před spuštěním (zapsat do `docs/brevo-setup.md` v Task 15): skutečná odpověď Brevo na opakovaný DOI stejného e-mailu a na SMS obsazené jiným kontaktem; pokud se kód liší od `duplicate_parameter`, upravit mapování a test.

- [ ] **Step 17: Spustit, očekávat PASS** – `npx vitest run tests/unit/brevo.test.ts` → `13 passed`.

- [ ] **Step 18: Implementovat `src/server/meta-capi.ts`** (testováno přes endpoint v Step 20)
  - `sendLeadEvent({ email, eventId, ip, userAgent, sourceUrl })`: bez `META_PIXEL_ID` nebo `META_CAPI_TOKEN` → return.
  - `fetch(`https://graph.facebook.com/v25.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_CAPI_TOKEN)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(3000), body })`, kde body = `{ data: [{ event_name: 'Lead', event_time: Math.floor(Date.now() / 1000), event_id: eventId, action_source: 'website', event_source_url: sourceUrl, user_data: { em: [sha256(email.trim().toLowerCase())], client_ip_address: ip, client_user_agent: userAgent } }] }` a `test_event_code: META_TEST_EVENT_CODE` jen když je env neprázdné. Verze Graph API jako neexportovaná konstanta `GRAPH_VERSION = 'v25.0'`.
  - `sha256` přes `createHash('sha256').update(s).digest('hex')` z `node:crypto`.
  - Jakákoli chyba nebo ne-2xx → `console.error('[capi]', status)`, nikdy nehází.

- [ ] **Step 19: Testovací pomocník** – `tests/api/helpers.ts`

```ts
import type { APIContext } from 'astro';
export const SITE = 'https://indexak.vercel.app';
export const AID = '11111111-1111-4111-8111-111111111111';
export const EVENT_ID = '22222222-2222-4222-8222-222222222222';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const base = { origin: SITE, 'user-agent': 'vitest-ua' };
export const jsonReq = (path: string, body: object, headers: Record<string, string> = {}) =>
  new Request(SITE + path, { method: 'POST', headers: { ...base, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
export const formReq = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) =>
  new Request(SITE + path, { method: 'POST', headers: { ...base, 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(fields) });
export const ctx = (request: Request) => ({ request, clientAddress: '203.0.113.7' }) as unknown as APIContext;
export function stubServerEnv(vi: typeof import('vitest').vi) {
  for (const [k, v] of Object.entries({
    BREVO_API_KEY: 'test-key', BREVO_LIST_ID: '7', BREVO_DOI_TEMPLATE_ID: '12', SITE_URL: SITE,
    META_PIXEL_ID: '1234567890', META_CAPI_TOKEN: 'capi-token', META_TEST_EVENT_CODE: 'TEST123',
    UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
  })) vi.stubEnv(k, v);
}
export const calls = (fetchMock: { mock: { calls: unknown[][] } }, host: string) =>
  fetchMock.mock.calls.filter(([u]) => String(u).includes(host));
export const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);
```

- [ ] **Step 20: Failing API testy** – `tests/api/subscribe.test.ts` (Review Focus 1, 2, 4)

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AID, EVENT_ID, SITE, UUID, bodyOf, calls, ctx, formReq, jsonReq, stubServerEnv } from './helpers';

vi.mock('../../src/server/ratelimit', () => ({ checkRateLimit: vi.fn(async () => true) }));
import { checkRateLimit } from '../../src/server/ratelimit';
import { POST, prerender } from '../../src/pages/api/subscribe';

const P = '/api/subscribe';
const full = {
  email: ' Jan.Novak@Seznam.cz ', aid: AID, event_id: EVENT_ID, pair: 'sp500', calc_deposit: '3000', calc_horizon: '20',
  placement: 'calc', utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'launch', utm_content: 'b',
  consent_text_version: '2026-10-11', consent_marketing: '0', website: '',
};
let brevo: () => Response;
let fetchMock: ReturnType<typeof vi.fn>;
const run = (r: Request) => POST(ctx(r));

beforeEach(() => {
  stubServerEnv(vi);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  brevo = () => new Response('{}', { status: 201 });
  fetchMock = vi.fn(async (url: string) =>
    String(url).includes('api.brevo.com') ? brevo() : new Response('{"events_received":1}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});

describe('POST /api/subscribe', () => {
  it('is not prerendered', () => expect(prerender).toBe(false));

  it('JSON success → 200 with redirect and full Brevo DOI payload', async () => {
    const r = await run(jsonReq(P, full));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, redirect: `/dekujeme?aid=${AID}` });
    const [call] = calls(fetchMock, 'api.brevo.com');
    expect(call[0]).toBe('https://api.brevo.com/v3/contacts/doubleOptinConfirmation');
    expect((call[1] as RequestInit).headers).toMatchObject({ 'api-key': 'test-key' });
    expect(bodyOf(call)).toEqual({
      email: 'jan.novak@seznam.cz', includeListIds: [7], templateId: 12,
      redirectionUrl: `${SITE}/potvrzeno?aid=${AID}`,
      attributes: {
        AID, PAIR: 'sp500', CALC_DEPOSIT: 3000, CALC_HORIZON: 20, PLACEMENT: 'calc',
        UTM_SOURCE: 'meta', UTM_CAMPAIGN: 'launch', UTM_CONTENT: 'b',
        CONSENT_TEXT_VERSION: '2026-10-11', CONSENT_AT: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    });
  });

  it('omits empty attributes and falls back to placement hero', async () => {
    await run(jsonReq(P, { email: 'a@seznam.cz', aid: AID, placement: 'evil', consent_text_version: '2026-10-11' }));
    expect(bodyOf(calls(fetchMock, 'api.brevo.com')[0]).attributes).toEqual({
      AID, PLACEMENT: 'hero', CONSENT_TEXT_VERSION: '2026-10-11', CONSENT_AT: expect.any(String),
    });
  });

  // Review Focus 1
  it('form-encoded without aid → server generates aid, 303 to /dekujeme', async () => {
    const { aid: _aid, event_id: _eventId, ...noJs } = full;
    const r = await run(formReq(P, noJs));
    expect(r.status).toBe(303);
    const loc = r.headers.get('location')!;
    expect(loc).toMatch(/^\/dekujeme\?aid=[0-9a-f-]{36}$/);
    const newAid = loc.split('=')[1];
    expect(newAid).toMatch(UUID);
    const body = bodyOf(calls(fetchMock, 'api.brevo.com')[0]);
    expect(body.attributes.AID).toBe(newAid);
    expect(body.redirectionUrl).toBe(`${SITE}/potvrzeno?aid=${newAid}`);
  });
  it('form-encoded invalid email → 303 /?error=invalid_email#form, no Brevo', async () => {
    const r = await run(formReq(P, { ...full, email: 'jan@seznam' }));
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/?error=invalid_email#form');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('form-encoded Brevo failure → 303 /?error=server#form', async () => {
    brevo = () => new Response(null, { status: 500 });
    const r = await run(formReq(P, full));
    expect(r.headers.get('location')).toBe('/?error=server#form');
  });

  it('malformed aid → replaced by a fresh UUID', async () => {
    const r = await run(jsonReq(P, { ...full, aid: 'abc' }));
    const { redirect } = await r.json();
    expect(redirect).toMatch(/^\/dekujeme\?aid=/);
    expect(redirect).not.toContain('abc');
  });

  // Review Focus 2
  it('duplicate contact (400 duplicate_parameter) → success', async () => {
    brevo = () => new Response(JSON.stringify({ code: 'duplicate_parameter', message: 'Contact already exist' }), { status: 400 });
    const r = await run(jsonReq(P, full));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, redirect: `/dekujeme?aid=${AID}` });
  });
  it('other Brevo error → 502 server', async () => {
    brevo = () => new Response(JSON.stringify({ code: 'invalid_parameter', message: 'x' }), { status: 400 });
    const r = await run(jsonReq(P, full));
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ ok: false, error: 'server' });
  });
  it('invalid email JSON → 400 invalid_email, no Brevo', async () => {
    const r = await run(jsonReq(P, { ...full, email: 'jan@@seznam.cz' }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ ok: false, error: 'invalid_email' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honeypot filled → silent success, no Brevo, no CAPI', async () => {
    const r = await run(jsonReq(P, { ...full, website: 'https://spam.example', consent_marketing: '1' }));
    expect(await r.json()).toEqual({ ok: true, redirect: `/dekujeme?aid=${AID}` });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rate limited → 429, key subscribe:<ip>, no Brevo', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(false);
    const r = await run(jsonReq(P, full));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ ok: false, error: 'rate_limited' });
    expect(checkRateLimit).toHaveBeenCalledWith('subscribe:203.0.113.7');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('foreign Origin → 403 server (JSON) / 303 error (form), no Brevo', async () => {
    const r = await run(jsonReq(P, full, { origin: 'https://evil.example' }));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ ok: false, error: 'server' });
    const f = await run(formReq(P, full, { origin: 'https://evil.example' }));
    expect(f.headers.get('location')).toBe('/?error=server#form');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('no Origin but same-site Referer → allowed; neither → 403', async () => {
    const ok = jsonReq(P, full, { referer: `${SITE}/?utm_source=meta` }); ok.headers.delete('origin');
    expect((await run(ok)).status).toBe(200);
    const bad = jsonReq(P, full); bad.headers.delete('origin');
    expect((await run(bad)).status).toBe(403);
  });

  // Review Focus 4
  it('consent_marketing=1 via JSON → CAPI Lead with hashed email and test code', async () => {
    await run(jsonReq(P, { ...full, consent_marketing: '1' }, { referer: `${SITE}/?utm_content=b` }));
    const capi = calls(fetchMock, 'graph.facebook.com');
    expect(capi).toHaveLength(1);
    expect(capi[0][0]).toBe('https://graph.facebook.com/v25.0/1234567890/events?access_token=capi-token');
    const body = bodyOf(capi[0]);
    expect(body.test_event_code).toBe('TEST123');
    expect(body.data[0]).toEqual({
      event_name: 'Lead', event_time: expect.any(Number), event_id: EVENT_ID, action_source: 'website',
      event_source_url: `${SITE}/?utm_content=b`,
      user_data: {
        em: ['6db68d052788e70eb459463eb34370fe983ef838db65641902f02326fabc37a7'], // sha256('jan.novak@seznam.cz')
        client_ip_address: '203.0.113.7', client_user_agent: 'vitest-ua',
      },
    });
  });
  it('consent_marketing=0 → no CAPI', async () => {
    await run(jsonReq(P, full));
    expect(calls(fetchMock, 'graph.facebook.com')).toHaveLength(0);
  });
  it('form-encoded (no JS) with consent_marketing=1 → no CAPI', async () => {
    await run(formReq(P, { ...full, consent_marketing: '1' }));
    expect(calls(fetchMock, 'graph.facebook.com')).toHaveLength(0);
  });
  it('CAPI failure does not break the signup', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('api.brevo.com') ? new Response('{}', { status: 201 }) : new Response('{}', { status: 500 }));
    const r = await run(jsonReq(P, { ...full, consent_marketing: '1' }));
    expect(await r.json()).toEqual({ ok: true, redirect: `/dekujeme?aid=${AID}` });
  });
  it('without META_TEST_EVENT_CODE the field is omitted', async () => {
    vi.stubEnv('META_TEST_EVENT_CODE', '');
    await run(jsonReq(P, { ...full, consent_marketing: '1' }));
    expect(bodyOf(calls(fetchMock, 'graph.facebook.com')[0])).not.toHaveProperty('test_event_code');
  });
});
```

- [ ] **Step 21: Spustit, očekávat FAIL**

```bash
npx vitest run tests/api/subscribe.test.ts
```
Očekávaný výstup: `Failed to resolve import "../../src/pages/api/subscribe"`.

- [ ] **Step 22: Implementovat `src/pages/api/subscribe.ts`**
  - `export const prerender = false;` a `export const POST: APIRoute = async ({ request, clientAddress }) => …`. Žádné další exporty.
  - Neexportované pomocníky: `sameOrigin(req)` – `new URL(SITE_URL).origin` musí být rovno hlavičce `Origin`; když `Origin` chybí, porovnává `new URL(Referer).origin`; bez obou nebo bez `SITE_URL` → `false`. `fail(error, status, isForm)` → form: 303 `Location: /?error=${error}#form`; JSON: `Response.json({ ok: false, error }, { status })`. `success(aid, isForm)` → form: 303 `Location: /dekujeme?aid=${aid}`; JSON: `Response.json({ ok: true, redirect: `/dekujeme?aid=${aid}` })`.
  - Pořadí zpracování:
    1. `const { data, isForm } = await parseBody(request)`.
    2. `!sameOrigin` → `fail('server', 403)`.
    3. `!(await checkRateLimit(`subscribe:${clientAddress}`))` → `fail('rate_limited', 429)`.
    4. `aid = UUID_RE.test(data.aid ?? '') ? data.aid : crypto.randomUUID()`.
    5. `data.website` neprázdné → `success(aid)` (bez Brevo, bez CAPI).
    6. `email = (data.email ?? '').trim().toLowerCase()`; `!isValidEmail(email)` → `fail('invalid_email', 400)`.
    7. Atributy: `AID`, `PLACEMENT` (z `['hero','card','calc','preview']`, jinak `'hero'`), `CONSENT_AT = new Date().toISOString()`; neprázdné řetězce (oříznuté na 100 znaků) `PAIR`, `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `UTM_CONTENT`, `CONSENT_TEXT_VERSION`; `CALC_DEPOSIT`/`CALC_HORIZON` jen když `Number(x)` je konečné kladné celé číslo.
    8. `createDoiContact` → `!ok` → `fail('server', 502)`.
    9. `!isForm && data.consent_marketing === '1' && UUID_RE.test(data.event_id ?? '')` → `await sendLeadEvent({ email, eventId: data.event_id, ip: clientAddress, userAgent: request.headers.get('user-agent') ?? '', sourceUrl: request.headers.get('referer') ?? SITE_URL })`.
    10. `success(aid, isForm)`.

- [ ] **Step 23: Spustit, očekávat PASS**

```bash
npx vitest run tests/api/subscribe.test.ts
```
Očekávání: `19 passed`.

- [ ] **Step 24: Celá sada, typy, commit**

```bash
npx vitest run && npx astro check && git add src/lib/validate.ts src/server src/pages/api/subscribe.ts tests/unit/validate.test.ts tests/unit/parse-body.test.ts tests/unit/ratelimit.test.ts tests/unit/brevo.test.ts tests/api/helpers.ts tests/api/subscribe.test.ts package.json package-lock.json && git commit -m "feat: /api/subscribe with Brevo double opt-in, Meta CAPI, rate limit and validation"
```
Očekávání: všechny testy zelené, `astro check` `0 errors`.

---

### Task 7: API /api/profile

**Files:**
- Create: `src/pages/api/profile.ts`
- Test: `tests/api/profile.test.ts`

**Interfaces:**
- Consumes: `parseBody`, `checkRateLimit`, `upsertProfile`, `ProfileInput` (Task 6), `normalizeCzPhone` (Task 6), `BrokerId` (`src/lib/types.ts`), env `SITE_URL`.
- Produces: `POST /api/profile` (JSON) – pole `aid, broker?, phone?, consent_call?, consent_partners?, consent_text_version`; odpověď `{ ok: true } | { ok: false, error: 'invalid_phone' | 'consent_required' | 'phone_taken' | 'rate_limited' | 'server' }`. HTTP: `200`, `400` (`invalid_phone`, `consent_required`, neplatné `aid`/`broker`), `403` (cizí Origin), `409` (`phone_taken`), `429`, `502` (Brevo).
- Pro Task 12: booleany posílat jako JSON `true`/`false` (server přijme `true`/`'true'`/`'1'`); volba „Zatím žádný" se posílá bez `broker` (není `BrokerId`).

- [ ] **Step 1: Failing API testy** – `tests/api/profile.test.ts` (Review Focus 5)

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AID, bodyOf, calls, ctx, jsonReq, stubServerEnv } from './helpers';

vi.mock('../../src/server/ratelimit', () => ({ checkRateLimit: vi.fn(async () => true) }));
import { checkRateLimit } from '../../src/server/ratelimit';
import { POST, prerender } from '../../src/pages/api/profile';

const P = '/api/profile';
const V = '2026-10-11';
let brevo: () => Response;
let fetchMock: ReturnType<typeof vi.fn>;
const run = async (body: object, headers?: Record<string, string>) => {
  const r = await POST(ctx(jsonReq(P, body, headers)));
  return { status: r.status, json: await r.json() };
};
const sent = () => calls(fetchMock, 'api.brevo.com');

beforeEach(() => {
  stubServerEnv(vi);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  brevo = () => new Response(JSON.stringify({ id: 21 }), { status: 201 });
  fetchMock = vi.fn(async () => brevo());
  vi.stubGlobal('fetch', fetchMock);
});

describe('POST /api/profile', () => {
  it('is not prerendered', () => expect(prerender).toBe(false));

  it('broker only → upsert by ext_id with BROKER, no SMS', async () => {
    expect(await run({ aid: AID, broker: 'xtb', consent_text_version: V })).toEqual({ status: 200, json: { ok: true } });
    expect(sent()[0][0]).toBe('https://api.brevo.com/v3/contacts');
    expect(bodyOf(sent()[0])).toEqual({ ext_id: AID, updateEnabled: true, attributes: { AID, BROKER: 'xtb', CONSENT_TEXT_VERSION: V } });
  });

  it.each([
    ['777 123 456', '+420777123456'],
    ['00420 777 123 456', '+420777123456'],
    ['+420777123456', '+420777123456'],
  ])('phone %s with consent (a) without (b) → SMS %s', async (phone, sms) => {
    expect((await run({ aid: AID, phone, consent_call: true, consent_partners: false, consent_text_version: V })).json).toEqual({ ok: true });
    expect(bodyOf(sent()[0]).attributes).toEqual({
      AID, SMS: sms, CONSENT_CALL: true, CONSENT_PARTNERS: false,
      CONSENT_CALL_AT: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), CONSENT_TEXT_VERSION: V,
    });
  });
  it('phone with both consents → CONSENT_PARTNERS true', async () => {
    await run({ aid: AID, phone: '777123456', consent_call: true, consent_partners: true, consent_text_version: V });
    expect(bodyOf(sent()[0]).attributes.CONSENT_PARTNERS).toBe(true);
  });
  it.each(['+421 905 123 456', '12345', '777 123 4567'])('invalid phone %s → 400 invalid_phone, no Brevo', async (phone) => {
    expect(await run({ aid: AID, phone, consent_call: true, consent_text_version: V }))
      .toEqual({ status: 400, json: { ok: false, error: 'invalid_phone' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([undefined, false, 'false', '0'])('phone with consent_call=%s → 400 consent_required, no Brevo', async (cc) => {
    expect(await run({ aid: AID, phone: '777 123 456', consent_call: cc, consent_text_version: V }))
      .toEqual({ status: 400, json: { ok: false, error: 'consent_required' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('consent_partners without phone is ignored', async () => {
    await run({ aid: AID, broker: 'fio', consent_partners: true, consent_text_version: V });
    expect(bodyOf(sent()[0]).attributes).not.toHaveProperty('CONSENT_PARTNERS');
  });
  it('unknown broker → 400 server, no Brevo', async () => {
    expect(await run({ aid: AID, broker: 'revolut', consent_text_version: V })).toEqual({ status: 400, json: { ok: false, error: 'server' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([undefined, 'abc'])('aid=%s → 400 server', async (aid) => {
    expect((await run({ aid, broker: 'xtb', consent_text_version: V })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('nothing to save → 200 ok without Brevo', async () => {
    expect(await run({ aid: AID, consent_text_version: V })).toEqual({ status: 200, json: { ok: true } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('SMS used by another contact → 409 phone_taken', async () => {
    brevo = () => new Response(JSON.stringify({ code: 'duplicate_parameter', message: 'Unable to update contact, SMS is already associated with another Contact' }), { status: 400 });
    expect(await run({ aid: AID, phone: '777 123 456', consent_call: true, consent_text_version: V }))
      .toEqual({ status: 409, json: { ok: false, error: 'phone_taken' } });
  });
  it('Brevo failure → 502 server', async () => {
    brevo = () => new Response(null, { status: 500 });
    expect(await run({ aid: AID, broker: 'xtb', consent_text_version: V })).toEqual({ status: 502, json: { ok: false, error: 'server' } });
  });
  it('rate limited → 429, key profile:<ip>', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce(false);
    expect(await run({ aid: AID, broker: 'xtb', consent_text_version: V })).toEqual({ status: 429, json: { ok: false, error: 'rate_limited' } });
    expect(checkRateLimit).toHaveBeenCalledWith('profile:203.0.113.7');
  });
  it('foreign Origin → 403 server', async () => {
    expect(await run({ aid: AID, broker: 'xtb', consent_text_version: V }, { origin: 'https://evil.example' }))
      .toEqual({ status: 403, json: { ok: false, error: 'server' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Spustit, očekávat FAIL**

```bash
npx vitest run tests/api/profile.test.ts
```
Očekávaný výstup: `Failed to resolve import "../../src/pages/api/profile"`.

- [ ] **Step 3: Implementovat `src/pages/api/profile.ts`**
  - `export const prerender = false;`, `export const POST: APIRoute = async ({ request, clientAddress }) => …`; odpovědi `Response.json(...)`.
  - Neexportovaný `sameOrigin` se stejným pravidlem jako v Task 6 (Origin, jinak Referer, jinak odmítnout); `isTrue(v) = v === 'true' || v === '1'` (po `parseBody` jsou hodnoty řetězce).
  - Pořadí:
    1. `parseBody`; `!sameOrigin` → 403 `server`.
    2. `!(await checkRateLimit(`profile:${clientAddress}`))` → 429 `rate_limited`.
    3. `aid` neodpovídá `UUID_RE` → 400 `server`.
    4. `broker` zadán a není v `['xtb','trading212','fio','degiro']` → 400 `server`.
    5. `phone` neprázdný: `normalizeCzPhone` → `null` → 400 `invalid_phone`; `!isTrue(consent_call)` → 400 `consent_required`.
    6. Nic k uložení (bez `broker` i `phone`) → 200 `{ ok: true }` bez volání Brevo.
    7. `upsertProfile({ aid, broker, phone: normalized, consentCall: phone ? true : undefined, consentPartners: phone ? isTrue(consent_partners) : undefined, consentTextVersion: consent_text_version || '' })` – bez telefonu se `consent_partners` zahodí.
    8. Výsledek: ok → 200; `phone_taken` → 409; `brevo` → 502 `server`.

- [ ] **Step 4: Spustit, očekávat PASS**

```bash
npx vitest run tests/api/profile.test.ts
```
Očekávání: `22 passed`.

- [ ] **Step 5: Commit**

```bash
npx vitest run && git add src/pages/api/profile.ts tests/api/profile.test.ts && git commit -m "feat: /api/profile for broker, phone and separate consents"
```

---

### Task 8: LeadForm (progresivní vylepšení)

**Files:**
- Create: `src/lib/copy.ts`, `src/components/LeadForm.tsx`
- Modify: `src/styles/global.scss` (styly `.lead-form`, `.lead-form__hp`)
- Test: `tests/unit/LeadForm.test.tsx`

**Interfaces:**
- Consumes: Task 5 (`track`, `getAid`, `getUtm`, `firePixelLead`, `getConsent`, `onConsentChange`), Task 6 (`isValidEmail`, kontrakt `/api/subscribe`), `Placement` (`src/lib/types.ts`).
- Produces:
  - `src/lib/copy.ts`: `FORM_COPY: { button: string; micro: string; errorInvalid: string; errorServer: string }`, `CONSENT_TEXT_VERSION = '2026-10-11'` (Task 9 soubor rozšíří, tyto exporty zachová).
  - `src/components/LeadForm.tsx` (default export) props `{ placement: Placement; pair?: string; calc?: { deposit: number; horizon: number }; id?: string }`; SSR výstup je funkční `<form method="post" action="/api/subscribe">`; po úspěchu `location.assign(redirect)`. Formulář #1 (hero) dostane `id="form"` – to dělá Task 9 při vložení.

- [ ] **Step 1: Vytvořit `src/lib/copy.ts`** (jen data, bez testu – texty ověřuje test komponenty)

```ts
export const CONSENT_TEXT_VERSION = '2026-10-11';
export const FORM_COPY = {
  button: 'Pošlete mi návod',
  micro: 'Pošleme vám návod a občas tipy k investování do ETF. Odhlásíte se jedním klikem. Provozovatel a zpracování údajů:',
  errorInvalid: 'Zkontrolujte prosím e-mail.',
  errorServer: 'Něco se nepovedlo, zkuste to prosím znovu.',
} as const;
```
Odkaz za `micro` („zásady ochrany osobních údajů" → `/zasady-ochrany-osobnich-udaju`) renderuje komponenta. Při změně znění souhlasu (§16, právník) se zvedá `CONSENT_TEXT_VERSION`.

- [ ] **Step 2: Failing testy** – `tests/unit/LeadForm.test.tsx` (Review Focus 2)

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

const AID = '11111111-1111-4111-8111-111111111111';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
vi.mock('../../src/lib/track', () => ({
  track: vi.fn(), firePixelLead: vi.fn(),
  getAid: () => '11111111-1111-4111-8111-111111111111',
  getUtm: () => ({ utm_source: 'meta', utm_content: 'b' }),
}));
vi.mock('../../src/lib/consent', () => ({
  getConsent: vi.fn(() => ({ analytics: true, meta: true, ga4: false, version: '2026-10-11', decidedAt: '2026-10-11T10:00:00.000Z' })),
  onConsentChange: vi.fn(() => () => {}),
}));
import { track, firePixelLead } from '../../src/lib/track';
import LeadForm from '../../src/components/LeadForm';

let io: { cb: IntersectionObserverCallback } | null;
let fetchMock: ReturnType<typeof vi.fn>;
const email = () => screen.getByLabelText('Váš e-mail') as HTMLInputElement;
const button = () => screen.getByRole('button', { name: 'Pošlete mi návod' }) as HTMLButtonElement;
const form = () => email().closest('form')!;
const submitWith = (v: string) => { fireEvent.change(email(), { target: { value: v } }); fireEvent.submit(form()); };

beforeEach(() => {
  vi.clearAllMocks();
  history.replaceState({}, '', '/');
  io = null;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(cb: IntersectionObserverCallback) { io = { cb }; }
    observe() {} disconnect() {} unobserve() {} takeRecords() { return []; }
  });
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
});
afterEach(cleanup);

describe('LeadForm SSR (works without JS)', () => {
  it('renders a native POST form with hidden fields and a visually hidden honeypot', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToString(<LeadForm placement="calc" pair="world" calc={{ deposit: 5000, horizon: 30 }} id="form" />);
    const f = host.querySelector('form')!;
    expect([f.getAttribute('method'), f.getAttribute('action'), f.id]).toEqual(['post', '/api/subscribe', 'form']);
    const val = (n: string) => (f.querySelector(`[name="${n}"]`) as HTMLInputElement | null)?.getAttribute('value');
    const em = f.querySelector('input[name="email"]')!;
    expect([em.getAttribute('type'), em.hasAttribute('required')]).toEqual(['email', true]);
    expect({
      placement: val('placement'), pair: val('pair'), calc_deposit: val('calc_deposit'), calc_horizon: val('calc_horizon'),
      consent_text_version: val('consent_text_version'), consent_marketing: val('consent_marketing'),
      aid: val('aid'), event_id: val('event_id'),
    }).toEqual({
      placement: 'calc', pair: 'world', calc_deposit: '5000', calc_horizon: '30',
      consent_text_version: '2026-10-11', consent_marketing: '0', aid: '', event_id: '',
    });
    for (const n of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) expect(val(n)).toBe('');
    const hp = f.querySelector('input[name="website"]')!;
    expect([hp.getAttribute('tabindex'), hp.getAttribute('autocomplete')]).toEqual(['-1', 'off']);
    expect(hp.closest('[style*="display"]')).toBeNull();
    expect(f.querySelector('a[href="/zasady-ochrany-osobnich-udaju"]')).not.toBeNull();
    expect(f.querySelector('button[type="submit"]')!.textContent).toBe('Pošlete mi návod');
  });
});

describe('LeadForm with JS', () => {
  it('hydrates aid, utm and consent_marketing', () => {
    render(<LeadForm placement="hero" />);
    const f = form();
    expect((f.elements.namedItem('aid') as HTMLInputElement).value).toBe(AID);
    expect((f.elements.namedItem('utm_source') as HTMLInputElement).value).toBe('meta');
    expect((f.elements.namedItem('utm_content') as HTMLInputElement).value).toBe('b');
    expect((f.elements.namedItem('consent_marketing') as HTMLInputElement).value).toBe('1');
  });

  it('double submit → exactly one request, button disabled while sending', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<LeadForm placement="hero" />);
    fireEvent.change(email(), { target: { value: 'jan.novak@seznam.cz' } });
    fireEvent.submit(form());
    fireEvent.submit(form());
    fireEvent.click(button());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(button().disabled).toBe(true));
  });

  it('sends JSON with all fields and a fresh event_id; on success tracks and fires Pixel with same id', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, redirect: `/dekujeme?aid=${AID}` }));
    render(<LeadForm placement="calc" pair="sp500" calc={{ deposit: 3000, horizon: 20 }} />);
    submitWith('jan.novak@seznam.cz');
    await vi.waitFor(() => expect(firePixelLead).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/subscribe');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      email: 'jan.novak@seznam.cz', aid: AID, placement: 'calc', pair: 'sp500', calc_deposit: '3000', calc_horizon: '20',
      utm_source: 'meta', utm_content: 'b', consent_marketing: '1', consent_text_version: '2026-10-11', website: '',
    });
    expect(body.event_id).toMatch(UUID);
    expect(firePixelLead).toHaveBeenCalledWith(body.event_id);
    expect(track).toHaveBeenCalledWith('form_submitted', { placement: 'calc' });
  });

  it('server error → message, e-mail kept, button enabled again, form_error tracked', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false, error: 'server' }, { status: 502 }));
    render(<LeadForm placement="hero" />);
    submitWith('jan.novak@seznam.cz');
    expect((await screen.findByRole('alert')).textContent).toBe('Něco se nepovedlo, zkuste to prosím znovu.');
    expect(email().value).toBe('jan.novak@seznam.cz');
    expect(button().disabled).toBe(false);
    expect(track).toHaveBeenCalledWith('form_error', { placement: 'hero', error_type: 'server' });
    expect(firePixelLead).not.toHaveBeenCalled();
  });

  it('network failure → same server message, e-mail kept', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<LeadForm placement="hero" />);
    submitWith('jan.novak@seznam.cz');
    expect((await screen.findByRole('alert')).textContent).toBe('Něco se nepovedlo, zkuste to prosím znovu.');
    expect(email().value).toBe('jan.novak@seznam.cz');
  });

  it('invalid e-mail → no request, message bound to the field', () => {
    render(<LeadForm placement="hero" />);
    submitWith('jan@seznam');
    expect(fetchMock).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Zkontrolujte prosím e-mail.');
    expect(email().getAttribute('aria-invalid')).toBe('true');
    expect(email().getAttribute('aria-describedby')).toBe(alert.id);
    expect(track).toHaveBeenCalledWith('form_error', { placement: 'hero', error_type: 'invalid_email' });
  });

  it('shows ?error= from a no-JS redirect only in the form with id="form"', () => {
    history.replaceState({}, '', '/?error=invalid_email');
    render(<><LeadForm placement="hero" id="form" /><LeadForm placement="calc" /></>);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert').textContent).toBe('Zkontrolujte prosím e-mail.');
  });

  it('form_viewed once when 50 % visible; form_started on first focus only', () => {
    render(<LeadForm placement="preview" />);
    act(() => io!.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    act(() => io!.cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    fireEvent.focus(email()); fireEvent.focus(email());
    expect(vi.mocked(track).mock.calls.filter(([e]) => e === 'form_viewed')).toEqual([['form_viewed', { placement: 'preview' }]]);
    expect(vi.mocked(track).mock.calls.filter(([e]) => e === 'form_started')).toEqual([['form_started', { placement: 'preview' }]]);
  });
});
```

- [ ] **Step 3: Spustit, očekávat FAIL**

```bash
npx vitest run tests/unit/LeadForm.test.tsx
```
Očekávaný výstup: `Failed to resolve import "../../src/components/LeadForm"`.

- [ ] **Step 4: Implementovat `src/components/LeadForm.tsx`** (default export, props dle Interfaces)
  - Markup (SSR i klient): `<form id={id} method="post" action="/api/subscribe" className="lead-form" noValidate={hydrated} onSubmit=…>`; `<label htmlFor={`${uid}-email`}>Váš e-mail</label>` + `<input id type="email" name="email" required autoComplete="email" inputMode="email" value onChange aria-invalid aria-describedby>`; `<button type="submit" disabled={sending} aria-busy={sending}>{FORM_COPY.button}</button>`; chyba `<p role="alert" id={`${uid}-err`}>` jen když je; `<p className="lead-form__micro">{FORM_COPY.micro} <a href="/zasady-ochrany-osobnich-udaju">zásady ochrany osobních údajů</a>.</p>`. `uid` z `useId()`.
  - Skrytá pole (`type="hidden"`, vždy vyrenderovaná): `aid` (state, SSR `''`), `event_id` (`''`), `placement`, `pair` (`pair ?? ''`), `calc_deposit`/`calc_horizon` (`calc?.deposit ?? ''`), `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` (state, SSR `''`), `consent_text_version` (`CONSENT_TEXT_VERSION`), `consent_marketing` (state, SSR `'0'`).
  - Honeypot: `<div className="lead-form__hp" aria-hidden="true"><label>Web <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>`; v `global.scss` `.lead-form__hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }` (ne `display:none` – některé boty ho přeskakují).
  - `useEffect` po mountu: `hydrated = true`; `aid = getAid()`; utm z `getUtm()`; `consent_marketing = getConsent()?.meta ? '1' : '0'` a `onConsentChange(c => set(c.meta ? '1' : '0'))` (cleanup = unsubscribe); když `id === 'form'` a `?error=` je `invalid_email` → `errorInvalid`, jiná neprázdná hodnota → `errorServer`; `IntersectionObserver` (`threshold: 0.5`) na `<form>` → při prvním `isIntersecting` `track('form_viewed', { placement })` a `disconnect()`.
  - `onFocus` e-mailu: první fokus → `track('form_started', { placement })` (ref flag).
  - `onSubmit(e)`:
    1. `e.preventDefault()`; když `sendingRef.current` → return (ref, ne state – druhé synchronní odeslání musí odpadnout dřív, než React překreslí `disabled`).
    2. `!isValidEmail(email)` → chyba `errorInvalid`, `track('form_error', { placement, error_type: 'invalid_email' })`, konec.
    3. `sendingRef.current = true`, `setSending(true)`, `const eventId = crypto.randomUUID()`; tělo = `Object.fromEntries(new FormData(form))` s `event_id: eventId` a `email: email.trim()`.
    4. `fetch('/api/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })`, odpověď `json()`.
    5. `ok === true` → `track('form_submitted', { placement })`, `firePixelLead(eventId)`, `location.assign(json.redirect)`; tlačítko zůstává `disabled` až do navigace.
    6. Jinak / výjimka → `error = json?.error ?? 'server'`; hláška `invalid_email` → `errorInvalid`, ostatní → `errorServer`; `track('form_error', { placement, error_type: error })`; `sendingRef.current = false`, `setSending(false)`; hodnota e-mailu se nemaže.
  - Styly v `global.scss`: `.lead-form` pole a tlačítko min. 48 px vysoké, tlačítko `background: var(--signal)`, text na něm kontrast ≥ 4,5 : 1, `.lead-form__micro` `color: var(--muted)`, malé písmo ≥ 13 px.

- [ ] **Step 5: Spustit, očekávat PASS**

```bash
npx vitest run tests/unit/LeadForm.test.tsx
```
Očekávání: `9 passed`. (jsdom může vypsat „Not implemented: navigation" z `location.assign` – není to chyba testu.)

- [ ] **Step 6: Celá sada, typy, commit**

```bash
npx vitest run && npx astro check && git add src/lib/copy.ts src/components/LeadForm.tsx src/styles/global.scss tests/unit/LeadForm.test.tsx && git commit -m "feat: progressively enhanced LeadForm with single-request submit and funnel tracking"
```
Očekávání: všechny testy zelené, `astro check` `0 errors`.


## Část C – úkoly 9–12 (homepage, kalkulačka UI, patička a zásady, děkovací stránky)

**Společné pro část C**

- Komponentní testy: Vitest + @testing-library/react, soubory `tests/unit/components/*.test.tsx`, každý začíná pragmou `// @vitest-environment jsdom`. `track` se vždy mockuje: `vi.mock('../../../src/lib/track', () => ({ track: vi.fn(), getAid: () => 'test-aid', getUtm: () => ({}) }))`.
- jsdom nemá `IntersectionObserver`. Testy ho podstrkují stubem `vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} })`; test, který potřebuje vyvolat průnik, si callback uloží a zavolá ručně.
- Částky z `formatCzk` obsahují nezlomitelné mezery. Asserce na text proto vždy normalizují: `const norm = (s: string) => s.replace(/[  ]/g, ' ')`.
- E2E: Playwright, projekt `mobile` (390×844), spouštění `npm run test:e2e -- <file>`. API se v E2E vždy mockuje přes `page.route`; ostré Brevo se nevolá.
- **Směr designu (frontend-design → konkrétní rozhodnutí pro tuto zakázku):** Vizuální jazyk je daný spec §3 („tržní strana novin“) a Global Constraints, proto se nemění paleta ani písma. Používají se jen tokeny z Task 1 (`--paper`, `--ink`, `--signal`, `--muted`, `--rule`, `$font-text`, `$font-mono`, `$s1..$s6`). Výraznost je soustředěná na jedno místo: **motiv dvojice tickerů `⇄`**. V kartě odpovědi odděluje řádek originálů (v `--muted`) od dvojčat (v `--ink`). Všechno ostatní zůstává tiché:
  - žádné kartičky se stínem, žádné zaoblení větší než 2 px, žádné nadpisové „eyebrow“ štítky a žádný verzálkový text,
  - číslování jen u skutečné posloupnosti (kroky v náhledu návodu),
  - žádné animace při načtení, jen reakce na akci (otevření `<details>`, výsledek kalkulačky) a nic z toho při `prefers-reduced-motion: reduce`,
  - zarovnání vlevo, tabulková čísla zarovnaná vpravo,
  - texty tlačítek popisují akci a nekončí šipkou.

---

### Task 9: Hero, AnswerCard, StickyCta, copy.ts

**Files:**
- Modify: `src/lib/copy.ts` (přidat `heroVariantFromUtm`, `HERO_COPY`; exporty z Task 8 zůstávají beze změny)
- Modify: `src/layouts/Base.astro` (přidat `<slot name="head" />` jako poslední prvek `<head>`; props se nemění)
- Create: `src/components/Hero.astro`, `src/components/AnswerCard.astro`, `src/components/StickyCta.tsx`
- Modify: `src/pages/index.astro` (zatím jen Hero + StickyCta; plné složení stránky je v Task 11)
- Test: `tests/unit/copy.test.ts`, `tests/unit/components/StickyCta.test.tsx`, `tests/e2e/hero.spec.ts`

**Interfaces:**
- Consumes: `HeroVariant`, `GroupId` (types); `twinsSortedByTer`, `originalsOf`, `getData` (Task 2); `formatTer` (Task 4); `track`, `getUtm` (Task 5); `LeadForm`, `FORM_COPY` (Task 8); `Base.astro` (Task 1).
- Produces: `heroVariantFromUtm(utmContent: string | null): HeroVariant`, `HERO_COPY: Record<HeroVariant, { h1: string; sub: string }>`, `Hero.astro` `{ variant: HeroVariant }`, `AnswerCard.astro` (bez props), `StickyCta.tsx` (bez props).

**Rozpočet první obrazovky (390×844, závazný pro CSS v tomto úkolu):**

```
 y=0   ┌─────────────────────────────┐
       │ Indexák              (40 px)│  hlavička: jen značka, žádné menu
       │ H1 26px/1.12, max 4 ř.(≤117)│  $font-text 700, letter-spacing -0.015em, text-wrap: balance
       │ sub 15px/1.4, max 3 ř. (≤63)│  barva --muted
       │┌───────────────────────────┐│
       ││Originál (NYSE Arca): VOO… ││  13px --muted, 1 řádek
       ││──────────── ⇄ ────────────││  motiv, 16 px
       ││SPYL  akumulační   0,03 % ▸││  3 řádky po 40 px (cíl pro ťuknutí na <summary>)
       ││CSPX  akumulační   0,07 % ▸││
       ││VUAA  akumulační   0,07 % ▸││
       ││Zdroj: vydavatelé fondů, k…││  12px --muted
       │└───────────────────────────┘│  karta ≈ 190 px, horní linka 2px --ink, spodní 1px --rule
       │ [ e-mail               48px]│
       │ [ Pošlete mi návod     48px]│  pozadí --signal, text --paper
 ≈600  │ souhlas 13px (3 ř.)         │
       └─────────────────────────────┘
```

Odsazení od okrajů je 16 px (`$s3`) a mezery mezi bloky 12–16 px. Cílem je mít tlačítko i v iOS Safari s lištami (viditelná výška ≈ 660 px) celé nad ohybem. Když test v Step 9 neprojde, postupuje se podle spec §4: nejdřív se zmenší H1 na 24 px, pak se zkrátí podnadpis. Karta se nezkracuje.

- [ ] **Step 1: Napiš failing test pro `heroVariantFromUtm` a `HERO_COPY`**

`tests/unit/copy.test.ts`:
```ts
import { heroVariantFromUtm, HERO_COPY, FORM_COPY, CONSENT_TEXT_VERSION } from '../../src/lib/copy';
it('heroVariantFromUtm', () => {
  expect(heroVariantFromUtm(null)).toBe('a');
  expect(heroVariantFromUtm('')).toBe('a');
  expect(heroVariantFromUtm('a')).toBe('a');
  expect(heroVariantFromUtm('b')).toBe('b');
  expect(heroVariantFromUtm('b_isin_9x16')).toBe('b');
  expect(heroVariantFromUtm('xb')).toBe('a');
});
it('HERO_COPY matches spec §9 exactly', () => {
  expect(HERO_COPY.a).toEqual({
    h1: 'U evropského brokera VOO jako drobný investor nekoupíte. Jeho evropské dvojče ano.',
    sub: 'Níže vidíte, které fondy sledují stejný index a kolik stojí. Návod, jak je koupit u vašeho brokera, vám pošleme zdarma.',
  });
  expect(HERO_COPY.b).toEqual({
    h1: 'S&P 500 u vašeho brokera: který fond vybrat a jak ho najít.',
    sub: 'Tři evropské fondy na S&P 500 a jejich poplatky vidíte hned. Postup pro XTB, Trading 212, Fio a Degiro vám pošleme e-mailem.',
  });
});
it('keeps Task 8 exports', () => {
  expect(FORM_COPY.button).toBe('Pošlete mi návod');
  expect(CONSENT_TEXT_VERSION).toBe('2026-10-11');
});
```

- [ ] **Step 2: Spusť test a ověř, že selže**

`npx vitest run tests/unit/copy.test.ts` → očekávaný výstup: `FAIL tests/unit/copy.test.ts > heroVariantFromUtm` s `TypeError: heroVariantFromUtm is not a function`.

- [ ] **Step 3: Implementuj v `src/lib/copy.ts`**

Přidej `export function heroVariantFromUtm(utmContent: string | null): HeroVariant`, která vrátí `'b'` právě tehdy, když `utmContent?.startsWith('b')`. Přidej `export const HERO_COPY` s texty přesně podle Step 1. Ostatních exportů z Task 8 se nedotýkej.

- [ ] **Step 4: Spusť test a ověř, že projde**

`npx vitest run tests/unit/copy.test.ts` → `✓ 3 passed`.

- [ ] **Step 5: Napiš failing E2E test hero (varianty, ohyb, CLS)**

`tests/e2e/hero.spec.ts`. Pomocná funkce `measure(page, url)`:
1. Před navigací zavolá `page.addInitScript`, který založí `window.__cls = 0` a `new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value })).observe({ type: 'layout-shift', buffered: true })`.
2. Provede `page.goto(url)` a `page.waitForLoadState('networkidle')`.
3. Vrátí `{ box: await page.locator('#form button[type=submit]').boundingBox(), cls: await page.evaluate(() => window.__cls) }`.

Testy:
```ts
for (const [label, url] of [['bez UTM', '/'], ['a', '/?utm_content=a'], ['b', '/?utm_content=b']] as const) {
  test(`hero form button above fold – ${label}`, async ({ page }) => {
    const { box, cls } = await measure(page, url);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    expect(box!.y + box!.height).toBeLessThanOrEqual(660); // iOS Safari s lištami
    expect(cls).toBeLessThan(0.01);
    await expect(page.locator('[data-sticky-cta]')).toBeHidden();
  });
}
test('variant b shows h1 B, hides h1 A', async ({ page }) => {
  await page.goto('/?utm_content=b');
  await expect(page.locator('html')).toHaveAttribute('data-variant', 'b');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('S&P 500 u vašeho brokera: který fond vybrat a jak ho najít.');
  await expect(page.locator('h1:visible')).toHaveCount(1);
});
test('default shows h1 A', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('U evropského brokera VOO jako drobný investor nekoupíte. Jeho evropské dvojče ano.');
});
test('answer card: originals, twins sorted by TER, source, ISIN on tap', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('[data-answer-card]');
  await expect(card).toContainText('Originál (NYSE Arca): VOO 0,03 % · SPY 0,09 % · IVV 0,03 %');
  await expect(card.locator('[data-twin]')).toHaveText([/^SPYL/, /^CSPX/, /^VUAA/]);
  await expect(card).toContainText('Zdroj: vydavatelé fondů, k 11. 10. 2026');
  await expect(card.getByText('IE000XZSV718')).toBeHidden();
  await card.locator('[data-twin="SPYL"] summary').click();
  await expect(card.getByText('IE000XZSV718')).toBeVisible();
  await expect(card.locator('[data-twin="SPYL"] a', { hasText: 'KID' })).toHaveAttribute('href', /^https:\/\//);
});
test('hero form has placement hero directly under card', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#form input[name="placement"]')).toHaveValue('hero');
  const cardBox = await page.locator('[data-answer-card]').boundingBox();
  const formBox = await page.locator('#form').boundingBox();
  expect(formBox!.y).toBeGreaterThan(cardBox!.y + cardBox!.height - 1);
  expect(formBox!.y - (cardBox!.y + cardBox!.height)).toBeLessThanOrEqual(24);
});
```

Pořadí `SPYL, CSPX, VUAA` vychází z `twinsSortedByTer`: při shodném TER rozhoduje abecední pořadí id. Spec §4 uvádí VUAA před CSPX. Rozhoduje závazné pravidlo z kostry.

Řeší se CLS v rámci jednoho načtení: varianta se přepne před prvním vykreslením. Mezi variantami se pozice formuláře nesrovnává, protože H1 B je o řádek kratší než H1 A. Obě varianty ale musí splnit rozpočet.

- [ ] **Step 6: Spusť E2E a ověř, že selže**

`npm run test:e2e -- tests/e2e/hero.spec.ts` → očekávaný výstup: `7 failed`, první chyba `locator('#form button[type=submit]') … boundingBox() returned null` (`TypeError: Cannot read properties of null (reading 'y')`).

- [ ] **Step 7: Implementuj `AnswerCard.astro`**

Data: `originalsOf('sp500')`, `twinsSortedByTer('sp500')`, `getData().asOf`.
- Kořen je `<section data-answer-card aria-label="Evropská dvojčata ETF na S&P 500">`.
- **Řádek originálů:** text `Originál (NYSE Arca): ` a za ním tickery s `formatTer(ter.value)` oddělené ` · `. Výsledek musí být přesně `Originál (NYSE Arca): VOO 0,03 % · SPY 0,09 % · IVV 0,03 %`. Burza se bere z `exchange.value` prvního originálu.
- **Oddělovač:** `<div class="pair-rule" aria-hidden="true">⇄</div>`, tedy linka `--rule` se znakem uprostřed v `$font-mono`.
- **Řádek dvojčete:** `<details data-twin={id}>` se `<summary>`, které obsahuje ticker (`$font-mono` 600), text `akumulační`/`distribuční` podle `distribution.value` a TER vpravo s `tabular-nums`. Po rozbalení se zobrazí `ISIN {isin.value}`, odkaz `Údaje vydavatele` (`ter.sourceUrl`) a odkaz `KID` (`kidUrl`, jen pokud existuje). Odkazy mají `target="_blank" rel="noopener"` a `data-source-link={id}`.
- **Řádek zdroje:** `Zdroj: <a href="#zdroje">vydavatelé fondů</a>, k {d}`. Datum `d` je `asOf` ve formátu `D. M. YYYY` s mezerami, tedy `11. 10. 2026`. Sestavuje se z částí `YYYY-MM-DD` bez `Date`, aby nevznikl posun časového pásma.
- **Tracking:** `<script>` (bundlovaný) deleguje klik na `[data-source-link]` → `track('source_link_clicked', { fund: id })`.

- [ ] **Step 8: Implementuj `Hero.astro` a hlavu stránky**

- **`Base.astro`:** do `<head>` přidej `<slot name="head" />`.
- **`index.astro`:** do slotu `head` vlož `<script is:inline>`, který synchronně nastaví `document.documentElement.dataset.variant`. Hodnota je `'b'`, když `new URLSearchParams(location.search).get('utm_content')` začíná na `b`, jinak `'a'`. Jde o stejné pravidlo jako `heroVariantFromUtm`, jen inline, protože skript nesmí čekat na bundle. Přidej komentář `// keep in sync with heroVariantFromUtm in src/lib/copy.ts`.
- **`Hero.astro` `{ variant }`:** vykreslí oba páry textů. `<div data-hero="a">` obsahuje `<h1>` a `<p>` z `HERO_COPY.a`, `<div data-hero="b">` totéž pro B. CSS: `[data-hero="b"] { display: none }`, `html[data-variant="b"] [data-hero="a"] { display: none }`, `html[data-variant="b"] [data-hero="b"] { display: block }`. Prop `variant` určuje jen výchozí `data-variant` v SSR (`index.astro` předává `'a'`, takže bez JS se ukáže A).
- **Kořen:** `<section data-section="hero">`.
- **Složení:** pod texty `<AnswerCard />` a hned pod ní `<LeadForm client:load placement="hero" pair="sp500" id="form" />`.
- **Tracking:** bundlovaný `<script>` po načtení zavolá `track('page_view', { ...getUtm(), hero_variant: document.documentElement.dataset.variant ?? 'a' })`. Je to jediné místo, které posílá `page_view` na `/`.
- **Typografie podle rozpočtu výše:** H1 `1.625rem/1.12`, podnadpis `0.9375rem/1.4`, `max-width: 34ch` pro podnadpis.

- [ ] **Step 9: Spusť E2E pro hero (bez sticky asercí) a ověř, že projde**

`npm run test:e2e -- tests/e2e/hero.spec.ts -g "h1|answer card|placement hero"` → `4 passed`.

- [ ] **Step 10: Napiš failing komponentní test `StickyCta`**

`tests/unit/components/StickyCta.test.tsx`. Připrav DOM se třemi formuláři `<form action="/api/subscribe">` s `input[name=email]`, prvnímu dej `id="form"`. Stub `IntersectionObserver` si uloží callback.
```ts
it('starts hidden until first observation, then shows when no form intersects', () => {
  render(<StickyCta />);
  expect(screen.queryByRole('button', { name: 'Pošlete mi návod zdarma' })).toBeNull();
  act(() => ioCallback(forms.map(f => ({ target: f, isIntersecting: false }))));
  expect(screen.getByRole('button', { name: 'Pošlete mi návod zdarma' })).toBeVisible();
});
it('hides when any form intersects', () => {
  render(<StickyCta />);
  act(() => ioCallback([{ target: forms[2], isIntersecting: true }]));
  expect(screen.queryByRole('button', { name: 'Pošlete mi návod zdarma' })).toBeNull();
});
it('click scrolls to nearest form below viewport, focuses email, tracks', async () => {
  // getBoundingClientRect stubs: forms[0].top=-900, forms[1].top=1200, forms[2].top=2600; innerHeight=844
  render(<StickyCta />);
  act(() => ioCallback(forms.map(f => ({ target: f, isIntersecting: false }))));
  await userEvent.click(screen.getByRole('button', { name: 'Pošlete mi návod zdarma' }));
  expect(forms[1].scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  expect(document.activeElement).toBe(forms[1].querySelector('input[name=email]'));
  expect(track).toHaveBeenCalledWith('sticky_cta_clicked', { target: 'form-1' });
});
it('falls back to last form above when none is below', …); // všechny top < 0 → forms[2]
```

- [ ] **Step 11: Spusť test a ověř, že selže**

`npx vitest run tests/unit/components/StickyCta.test.tsx` → `FAIL … Failed to resolve import "../../../src/components/StickyCta"`.

- [ ] **Step 12: Implementuj `StickyCta.tsx`**

**Výchozí stav a viditelnost:**
- Výchozí stav je `ready=false`, takže se nic nevykreslí. SSR proto nemá lištu a nevznikne záblesk přes tlačítko hero.
- V `useEffect` se pozorují všechny `form[action="/api/subscribe"]`. Průnik se drží v `Set`. Po prvním callbacku se nastaví `ready=true` a `visible = set.size === 0`.

**Klik:**
- Cíl je první formulář s `getBoundingClientRect().top >= innerHeight`, jinak poslední formulář s `top < 0`.
- Na cíl se zavolá `scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })`, kde `reduced` je `matchMedia('(prefers-reduced-motion: reduce)').matches`. Pak `input[name=email].focus({ preventScroll: true })`.
- Odešle se `track('sticky_cta_clicked', { target: 'form-' + index })`.

**Markup:** `<div data-sticky-cta>` s `<button type="button">Pošlete mi návod zdarma</button>`.

**CSS:** `position: fixed; inset: auto 0 0 0`, padding `$s2 $s3` plus `env(safe-area-inset-bottom)`, pozadí `--paper`, horní linka 1px `--rule`, tlačítko v `--signal` na celou šířku a výšku 48 px. Lišta je jen pod `48rem`, na desktopu `display: none`.

**Stránka:** v `index.astro` se vloží `<StickyCta client:idle />`.

- [ ] **Step 13: Spusť komponentní test a celé hero E2E, ověř, že projdou**

1. `npx vitest run tests/unit/components/StickyCta.test.tsx` → `✓ 4 passed`.
2. `npm run test:e2e -- tests/e2e/hero.spec.ts` → `7 passed`.

Když selže asserce `≤ 660`, postupuj podle rozpočtu: H1 na `1.5rem` a znovu spusť. Text karty se nemění.

- [ ] **Step 14: Commit**

```bash
git add src/lib/copy.ts src/layouts/Base.astro src/components/Hero.astro src/components/AnswerCard.astro src/components/StickyCta.tsx src/pages/index.astro tests/unit/copy.test.ts tests/unit/components/StickyCta.test.tsx tests/e2e/hero.spec.ts
git commit -m "feat: hero with A/B copy, S&P 500 answer card, sticky CTA"
```

---

### Task 10: Další fondy a kalkulačka UI: FundPicker, FundCard, FeeCalculator

**Files:**
- Create: `src/components/FundPicker.tsx`, `src/components/FundCard.tsx`, `src/components/FeeCalculator.tsx`
- Modify: `src/pages/index.astro` (sekce `#fondy` a `#kalkulacka` pod hero, dočasně; finální pořadí sestaví Task 11)
- Test: `tests/unit/components/FundCard.test.tsx`, `tests/unit/components/FundPicker.test.tsx`, `tests/unit/components/FeeCalculator.test.tsx`

**Interfaces:**
- Consumes: `getGroup`, `originalsOf`, `twinsSortedByTer` (Task 2); `LIMITS`, `clampInputs`, `computeFees`, `COMPARISON_TER`, `formatCzk`, `formatTer` (Task 4); `track` (Task 5); `LeadForm` (Task 8).
- Produces: `FundPicker.tsx` (bez props), `FundCard.tsx` `{ groupId: GroupId; onCta: (groupId: GroupId) => void }`, `FeeCalculator.tsx` `{ initialGroup?: 'sp500' | 'world' }`.

**Design:**
- **Čipy:** skutečné `<input type="radio">` v `<fieldset>` s viditelnou legendou. Klávesnice tak funguje nativně (šipky).
- **Karta fondu:** tabulka, ne mřížka dlaždic. Řádek originálu je v `--muted`, následuje oddělovač `⇄` stejný jako v AnswerCard a pak řádky dvojčat.
- **Kalkulačka:** vstupy nahoře, výsledek jako tabulka se třemi sloupci (Fond · TER · Na poplatcích), čísla vpravo s `tabular-nums`. Srovnávací řádek je oddělený linkou `--rule` a psaný v `--muted`, aby nevypadal jako jedna z možností ke koupi.

- [ ] **Step 1: Napiš failing test `FundCard`**

`tests/unit/components/FundCard.test.tsx`:
```ts
it('world: original with TER and exchange, twins with index, CTA', async () => {
  const onCta = vi.fn();
  render(<FundCard groupId="world" onCta={onCta} />);
  expect(norm(screen.getByTestId('original-row').textContent!)).toContain('0,06 %');
  expect(screen.getByTestId('original-row')).toHaveTextContent('NYSE Arca');
  const rows = screen.getAllByTestId('twin-row');
  expect(rows.map(r => r.dataset.fund)).toEqual(twinsSortedByTer('world').map(f => f.id));
  rows.forEach((r, i) => expect(r).toHaveTextContent(twinsSortedByTer('world')[i].index.value));
  expect(screen.queryByText('Přesné dvojče neexistuje')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Poslat návod pro tento fond' }));
  expect(onCta).toHaveBeenCalledWith('world');
});
it('us-total: no exact twin', () => {
  render(<FundCard groupId="us-total" onCta={vi.fn()} />);
  expect(screen.getByText('Přesné dvojče neexistuje')).toBeInTheDocument();
});
it('us-dividend: exact SCHD sentence, alternative marked as other index', () => {
  render(<FundCard groupId="us-dividend" onCta={vi.fn()} />);
  expect(screen.getByText('UCITS fond na index Dow Jones U.S. Dividend 100 neexistuje')).toBeInTheDocument();
  expect(screen.queryByText('Přesné dvojče neexistuje')).toBeNull();
  screen.queryAllByTestId('twin-row').forEach(r => expect(r).toHaveTextContent('jiný index'));
});
```

- [ ] **Step 2: Spusť test a ověř, že selže**

`npx vitest run tests/unit/components/FundCard.test.tsx` → `FAIL … Failed to resolve import "../../../src/components/FundCard"`.

- [ ] **Step 3: Implementuj `FundCard.tsx`**

**Data:** `getGroup(groupId)`, `originalsOf(groupId)`, `twinsSortedByTer(groupId)`.

**Řádek originálu** (`data-testid="original-row"`): `{id} · {formatTer(ter)} · {exchange.value}`. Odkaz `Údaje vydavatele` vede na `ter.sourceUrl`.

**Poznámka nad dvojčaty, když `!group.exactTwin`:**
- pro `us-dividend` přesně `UCITS fond na index Dow Jones U.S. Dividend 100 neexistuje`,
- jinak přesně `Přesné dvojče neexistuje`,
- pod tím `group.note`, pokud existuje.

**Nadpis seznamu:**
- `exactTwin`: `Evropská dvojčata (seřazeno podle TER)`,
- jinak `Nejbližší alternativa`.

**Řádek dvojčete** (`data-testid="twin-row"`, `data-fund={id}`):
- ticker, `formatTer`, `index.value`,
- u `!exactTwin` navíc text `jiný index`,
- `<details>` s ISIN a odkazy `Údaje vydavatele`/`KID`. Klik na ně volá `track('source_link_clicked', { fund: id })`.

**Prázdný seznam dvojčat** (Task 2 neověřenou alternativu nezařadí): vykreslí se jen poznámka, žádný řádek.

**Patička karty:**
- `<button type="button">Poslat návod pro tento fond</button>` → `onCta(groupId)`,
- řádek `Zdroj: vydavatelé fondů, k {D. M. YYYY}` z `getData().asOf`, se stejným převodem jako v AnswerCard.

- [ ] **Step 4: Spusť test a ověř, že projde**

`npx vitest run tests/unit/components/FundCard.test.tsx` → `✓ 3 passed`.

- [ ] **Step 5: Napiš failing test `FundPicker`**

`tests/unit/components/FundPicker.test.tsx`. Do DOM vlož formulář `<form id="form"><input name="email"><input type="hidden" name="pair" value="sp500"><input type="hidden" name="placement" value="hero"></form>` a nastav `scrollIntoView = vi.fn()`.
```ts
it('renders three chips with group labels, VT selected by default', () => {
  render(<FundPicker />);
  const radios = screen.getAllByRole('radio');
  expect(radios.map(r => (r as HTMLInputElement).value)).toEqual(['world', 'us-total', 'us-dividend']);
  expect(screen.getByRole('radio', { name: new RegExp(`^VT\\b.*${getGroup('world').label}`) })).toBeChecked();
  expect(screen.getByTestId('original-row')).toHaveTextContent('VT');
});
it('selecting SCHD switches card and tracks pair_selected', async () => {
  render(<FundPicker />);
  await userEvent.click(screen.getByRole('radio', { name: /^SCHD/ }));
  expect(screen.getByText('UCITS fond na index Dow Jones U.S. Dividend 100 neexistuje')).toBeInTheDocument();
  expect(track).toHaveBeenCalledWith('pair_selected', { pair: 'us-dividend' });
});
it('card CTA prefills #form, focuses email, tracks', async () => {
  render(<FundPicker />);
  await userEvent.click(screen.getByRole('button', { name: 'Poslat návod pro tento fond' }));
  expect((document.querySelector('#form input[name=pair]') as HTMLInputElement).value).toBe('world');
  expect((document.querySelector('#form input[name=placement]') as HTMLInputElement).value).toBe('card');
  expect(document.activeElement).toBe(document.querySelector('#form input[name=email]'));
  expect(track).toHaveBeenCalledWith('card_cta_clicked', { pair: 'world' });
});
```

- [ ] **Step 6: Spusť test a ověř, že selže**

`npx vitest run tests/unit/components/FundPicker.test.tsx` → `FAIL … Failed to resolve import "../../../src/components/FundPicker"`.

- [ ] **Step 7: Implementuj `FundPicker.tsx`**

**Čipy:** pořadí skupin `['world', 'us-total', 'us-dividend']`. `<fieldset>` s `<legend>Vyberte americký fond</legend>`. Každý čip je `<label>` s `<input type="radio" name="fund-group" value={id}>` a textem `{originalsOf(id)[0].id}` plus `<span>{getGroup(id).label}</span>`. Vybraný čip má rámeček `--ink` 2 px, ostatní `--rule` 1 px. Výchozí výběr je `world`.

**Změna výběru:** `track('pair_selected', { pair: id })` a vykreslí se `<FundCard groupId={id} onCta={handleCta} />`.

**`handleCta(groupId)`:**
1. V `#form` nastaví hodnotu `input[name=pair]` na `groupId` a `input[name=placement]` na `'card'`.
2. Zavolá `#form.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })` a `input[name=email].focus({ preventScroll: true })`.
3. Odešle `track('card_cta_clicked', { pair: groupId })`.

Předpokládá se, že LeadForm (Task 8) čte hodnoty při odeslání z DOM přes `new FormData(form)` a skrytá pole `pair`/`placement` jsou neřízená (`defaultValue`). Ověř to příkazem `grep -n "new FormData" src/components/LeadForm.tsx`, který musí vrátit alespoň 1 řádek. Když nevrátí žádný, úkol se zastaví a vlastník Task 8 se upozorní.

- [ ] **Step 8: Spusť test a ověř, že projde**

`npx vitest run tests/unit/components/FundPicker.test.tsx` → `✓ 3 passed`.

- [ ] **Step 9: Napiš failing test `FeeCalculator` (výchozí výstup a Review Focus 3)**

`tests/unit/components/FeeCalculator.test.tsx`. Stub `IntersectionObserver`, `vi.useFakeTimers({ shouldAdvanceTime: true })` a `const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` (v testech `user.*` místo `userEvent.*`). Pomocná funkce `out = () => norm(screen.getByTestId('calc-result').textContent!)`.

Ověřené hodnoty (vzorec spec §5.2, 3 000 Kč, 20 let, R = 7 %):

| | přesně | po `formatCzk` |
|---|---|---|
| SPYL | 5 176 | 5 200 Kč |
| VUAA | 12 046 | 12 000 Kč |
| rozdíl SPYL vs VUAA | 6 870 | 6 900 Kč |
| fond s 1,5 % | 236 013 | 236 000 Kč |

```ts
it('default sp500 output', () => {
  render(<FeeCalculator />);
  expect(out()).toContain('Celkem vložíte 720 000 Kč');
  expect(out()).toMatch(/SPYL.*0,03 %.*5 200 Kč/);
  expect(out()).toMatch(/VUAA.*0,07 %.*12 000 Kč/);
  expect(out()).toContain('Rozdíl mezi SPYL a VUAA: 6 900 Kč');
  expect(out()).toMatch(/Fond s poplatkem 1,5 % p\.a\. \(příklad\).*236 000 Kč/);
  expect(out()).toContain('Ilustrativní výpočet');
  expect(screen.getByText(/Nezahrnuje poplatky brokera, kurzové konverze, spready, daně ani tracking difference\./)).toBeInTheDocument();
  expect(document.querySelector('form input[name=placement]')).toHaveValue('calc');
});
it.each([
  ['', clampInputs('', 20).monthly * 240],
  ['3 000', 720000],
  ['0', 500 * 240],
  ['999999', 50000 * 240],
  ['abc', clampInputs('abc', 20).monthly * 240],
])('monthly %j never yields NaN or negative', async (raw, deposited) => {
  render(<FeeCalculator />);
  const input = screen.getByLabelText('Měsíční vklad (Kč)');
  await userEvent.clear(input);
  if (raw) await userEvent.type(input, raw);
  expect(out()).not.toMatch(/NaN|Infinity|-\s?\d/);
  expect(out()).toContain(`Celkem vložíte ${norm(formatCzk(deposited))}`);
});
it('years out of range are clamped', async () => {
  render(<FeeCalculator />);
  const years = screen.getByLabelText('Horizont (roky)');
  await userEvent.clear(years); await userEvent.type(years, '99');
  expect(out()).toContain(`Celkem vložíte ${norm(formatCzk(3000 * 40 * 12))}`);
});
it('world group switches rows to world twins', async () => {
  render(<FeeCalculator />);
  await userEvent.click(screen.getByRole('radio', { name: /celý svět/i }));
  const ids = screen.getAllByTestId('calc-row').map(r => r.dataset.fund);
  expect(ids).toEqual(twinsSortedByTer('world').map(f => f.id));
});
it('calc_used is debounced to one call', async () => {
  render(<FeeCalculator />);
  const input = screen.getByLabelText('Měsíční vklad (Kč)');
  await userEvent.clear(input); await userEvent.type(input, '5000');
  vi.advanceTimersByTime(800);
  expect(track.mock.calls.filter(c => c[0] === 'calc_used')).toEqual([['calc_used', { group: 'sp500', monthly: 5000, years: 20 }]]);
});
it('calc_result_viewed fires once on intersection', () => { /* ruční zavolání IO callbacku dvakrát → 1 volání track('calc_result_viewed', { group: 'sp500' }) */ });
```

- [ ] **Step 10: Spusť test a ověř, že selže**

`npx vitest run tests/unit/components/FeeCalculator.test.tsx` → `FAIL … Failed to resolve import "../../../src/components/FeeCalculator"`.

- [ ] **Step 11: Implementuj `FeeCalculator.tsx`**

**Stav:**
- `group` (výchozí `initialGroup ?? 'sp500'`; nabízí jen skupiny s `getGroup(id).calcEnabled`, tedy `sp500` a `world`),
- `monthlyRaw: string` (výchozí `String(LIMITS.monthly.default)`),
- `yearsRaw: string` (výchozí `'20'`).

**Výpočet:**
1. `const { monthly, years } = clampInputs(monthlyRaw.replace(/\s/g, ''), yearsRaw.replace(/\s/g, ''))`.
2. `computeFees({ monthly, years, funds: twinsSortedByTer(group).map(f => ({ id: f.id, ter: f.ter.value })) })`.

**Vstupy:**
- `<label>Měsíční vklad (Kč)</label>` + `<input inputMode="numeric">` s nápovědou `500–50 000 Kč`.
- `<label>Horizont (roky)</label>` + `<input inputMode="numeric">` s nápovědou `5–40 let`.
- Při `blur` se pole přepíše na oříznutou hodnotu.
- Skupina: radio `S&P 500` / `Celý svět`.

**Výsledek** (`data-testid="calc-result"`, `aria-live="polite"`), shora dolů:
1. nadpis `Ilustrativní výpočet`,
2. `Celkem vložíte {formatCzk(deposited)}`,
3. tabulka s hlavičkou Fond / TER / Na poplatcích; řádky `data-testid="calc-row" data-fund={id}` s `formatCzk(feesPaid)`,
4. `Rozdíl mezi {rows[0].id} a {rows.at(-1).id}: {formatCzk(rows.at(-1).feesPaid - rows[0].feesPaid)}`,
5. oddělený srovnávací řádek s pevným textem `Fond s poplatkem 1,5 % p.a. (příklad)` a částkou `formatCzk(comparison.feesPaid)`; `comparison.ter` musí být rovno `COMPARISON_TER`,
6. poznámka: `Model je ilustrativní, ne příslib: počítá se zhodnocením 7 % ročně před náklady a vklady na konci měsíce. Nezahrnuje poplatky brokera, kurzové konverze, spready, daně ani tracking difference.`

**Formulář pod výsledkem:** `<LeadForm placement="calc" pair={group} calc={{ deposit: monthly, horizon: years }} />`.

**Tracking:**
- `calc_used`: `useEffect` na `[group, monthly, years]` s debounce 800 ms, ne při prvním vykreslení, s daty `{ group, monthly, years }`.
- `calc_result_viewed`: `IntersectionObserver` (threshold 0.5) na výsledek, poprvé `track('calc_result_viewed', { group })` a pak `disconnect()`.

- [ ] **Step 12: Spusť test a ověř, že projde**

`npx vitest run tests/unit/components/FeeCalculator.test.tsx` → `✓ 10 passed` (1 + 5 z `it.each` + 4).

- [ ] **Step 13: Zapoj komponenty do `index.astro` a spusť celou sadu**

**Zapojení:** pod hero vlož:
- `<section id="fondy" data-section="fondy"><h2>Další fondy z NYSE</h2><FundPicker client:visible /></section>`,
- `<section id="kalkulacka" data-section="kalkulacka"><h2>Kolik stojí poplatky</h2><FeeCalculator client:visible /></section>`.

**Ověření:**
1. `npx vitest run tests/unit/components` → všechny testy `passed`.
2. `npm run lint` → `0 errors`.

- [ ] **Step 14: Commit**

```bash
git add src/components/FundPicker.tsx src/components/FundCard.tsx src/components/FeeCalculator.tsx src/pages/index.astro tests/unit/components/FundCard.test.tsx tests/unit/components/FundPicker.test.tsx tests/unit/components/FeeCalculator.test.tsx
git commit -m "feat: fund picker with twin cards and fee calculator"
```

---

### Task 11: Zbytek homepage, patička, zásady zpracování

**Files:**
- Create: `src/components/WhyNot.astro`, `src/components/GuidePreview.astro`, `src/components/Faq.astro`, `src/components/Footer.astro`, `src/pages/zasady-ochrany-osobnich-udaju.astro`
- Modify: `src/pages/index.astro` (finální pořadí sekcí)
- Test: `tests/e2e/homepage.spec.ts`, `tests/e2e/privacy.spec.ts`

**Interfaces:**
- Consumes: `OPERATOR` (Task 1); `getData`, `getBrokers` (Tasks 2, 3); `openConsentSettings`, `track` (Task 5); `LeadForm`, `CONSENT_TEXT_VERSION` (Task 8); komponenty z Tasks 9, 10.
- Produces: `WhyNot.astro`, `GuidePreview.astro`, `Faq.astro`, `Footer.astro`, `/zasady-ochrany-osobnich-udaju`, složení `index.astro`.

- [ ] **Step 1: Napiš failing E2E test pořadí sekcí a formulářů**

`tests/e2e/homepage.spec.ts`:
```ts
test('sections in spec §4 order', async ({ page }) => {
  await page.goto('/');
  const order = await page.locator('[data-section]').evaluateAll(els => els.map(e => e.getAttribute('data-section')));
  expect(order).toEqual(['hero', 'fondy', 'kalkulacka', 'proc-ne', 'navod', 'faq', 'paticka']);
});
test('lead forms and placements', async ({ page }) => {
  await page.goto('/');
  const placements = await page.locator('form[action="/api/subscribe"] input[name="placement"]').evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
  expect(placements).toEqual(['hero', 'calc', 'preview']);
  await expect(page.locator('#form')).toHaveCount(1);
});
test('why-not section text and sources', async ({ page }) => {
  await page.goto('/');
  const s = page.locator('[data-section="proc-ne"]');
  await expect(s.getByRole('heading', { level: 2 })).toHaveText('Proč VOO u evropského brokera nekoupíte');
  await expect(s).toContainText('Pokud americké ETF už držíte, můžete je dál držet i prodat.');
  await expect(s.getByRole('link', { name: 'justETF' })).toHaveAttribute('href', 'https://www.justetf.com/en/news/etf/us-domiciled-etfs.html');
  await expect(s.getByRole('link', { name: 'Nařízení (EU) č. 1286/2014 (PRIIPs)' })).toHaveAttribute('href', 'https://eur-lex.europa.eu/eli/reg/2014/1286/oj');
});
test('faq: 5 questions, operator question', async ({ page }) => {
  await page.goto('/');
  const faq = page.locator('[data-section="faq"] details');
  await expect(faq).toHaveCount(5);
  const q = faq.filter({ hasText: 'Kdo za tím stojí a co se stane s mými údaji?' });
  await q.locator('summary').click();
  await expect(q).toContainText('Clientelo Czech s.r.o.');
  await expect(q).toContainText('22193456');
});
test('footer: operator, disclaimers, cookie settings', async ({ page }) => {
  await page.goto('/');
  const f = page.locator('[data-section="paticka"]');
  for (const t of ['Clientelo Czech s.r.o.', 'IČO 22193456', 'Platnéřská 90/13', 'fundraising@clientelo.cz',
    'nejsou investičním doporučením', 'nemusí se vám vrátit celá vložená částka', 'nejsou příslibem budoucího výnosu',
    'Ochranné známky patří jejich vlastníkům; stránka s vydavateli fondů nespolupracuje.']) await expect(f).toContainText(t);
  await expect(f.getByRole('link', { name: 'Zásady zpracování osobních údajů' })).toHaveAttribute('href', '/zasady-ochrany-osobnich-udaju');
  await expect(f.getByRole('link', { name: 'Cookies' })).toHaveAttribute('href', '/cookies');
  await expect(page.locator('#zdroje')).toContainText('k 11. 10. 2026');
  await f.getByRole('button', { name: 'Nastavení cookies' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); // ConsentBanner z Task 5
});
```

`tests/e2e/privacy.spec.ts`:
```ts
test('privacy page content', async ({ page }) => {
  await page.goto('/zasady-ochrany-osobnich-udaju');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zásady zpracování osobních údajů');
  for (const h of ['Správce', 'Účely a právní základ', 'Seznam partnerů', 'Zpracovatelé', 'Doba uložení', 'Vaše práva'])
    await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
  await expect(page.locator('main')).toContainText('Clientelo Czech s.r.o., IČO 22193456');
  for (const p of ['Brevo', 'PostHog', 'Vercel', 'Upstash', 'Meta Platforms Ireland']) await expect(page.locator('main')).toContainText(p);
  await expect(page.locator('main')).toContainText('Dokud zde seznam není uveden, vaše údaje žádnému partnerovi nepředáváme.');
  await expect(page.getByRole('link', { name: 'www.uoou.gov.cz' })).toHaveAttribute('href', 'https://uoou.gov.cz');
  await expect(page.locator('main')).not.toContainText(/TODO|TBD|\[doplnit\]|lorem/i);
});
```

- [ ] **Step 2: Spusť E2E a ověř, že selže**

`npm run test:e2e -- tests/e2e/homepage.spec.ts tests/e2e/privacy.spec.ts` → `6 failed`, první: `Expected: ["hero","fondy",…] Received: ["hero","fondy","kalkulacka"]`; privacy: `page.goto: 404`.

- [ ] **Step 3: Implementuj `WhyNot.astro`**

Struktura je `<section data-section="proc-ne">` s `<h2>Proč VOO u evropského brokera nekoupíte</h2>`.

Tři věty (jeden odstavec):
> „Od roku 2018 platí v EU nařízení PRIIPs: investiční produkt nabízený drobným investorům musí mít sdělení klíčových informací (KID). Američtí vydavatelé pro své ETF obchodované v USA KID nevydávají. Evropský broker vám je proto jako drobnému investorovi neprodá a nabídne evropské (UCITS) fondy na stejný index.“

Výjimky (druhý odstavec):
> „Pokud americké ETF už držíte, můžete je dál držet i prodat. Nové nákupy jsou možné jen pro klienty, které broker vede jako profesionální.“

Řádek zdrojů: `Zdroje: ` a dva odkazy `justETF` (`https://www.justetf.com/en/news/etf/us-domiciled-etfs.html`) a `Nařízení (EU) č. 1286/2014 (PRIIPs)` (`https://eur-lex.europa.eu/eli/reg/2014/1286/oj`). Odkazy mají `target="_blank" rel="noopener"` a `data-source-link`. Klik vede přes bundlovaný `<script>` na `track('source_link_clicked', { fund: 'priips' })`. Jiné URL se nepřidávají.

Sazba: textový sloupec `max-width: 62ch`, bez rámečku.

- [ ] **Step 4: Implementuj `GuidePreview.astro`**

Struktura je `<section data-section="navod">` s `<h2>Co je v návodu</h2>` a podnadpisem `PDF, 3–4 strany. Pošleme ho na váš e-mail.`

**Náhled:** dvě stylizované stránky v HTML (ne obrázky), `aspect-ratio: 210 / 297`, šířka 44 % každá, vedle sebe, mírně přes sebe (druhá posunutá o `$s3` dolů). Pozadí `--paper`, rámeček 1px `--ink`, `aria-hidden="true"`. Text uvnitř je skutečný, v 7–8 px:
- **strana 1:** titulek `Jak koupit S&P 500 a další americké indexy u XTB, Trading 212, Fio a Degiro` a tabulka tří řádků `SPYL / CSPX / VUAA` s TER a ISIN z `twinsSortedByTer('sp500')`,
- **strana 2:** nadpis `{getBrokers()[0].name}: postup krok za krokem` a číslovaný seznam prvních 3 položek `steps.value`. Je to skutečná posloupnost, takže čísla jsou na místě. Pokud `steps.value` je prázdné, strana 2 ukáže jen nadpis.

**Výčet obsahu** pro všechny čtenáře (`<ul>`), přesně:
1. `Pro XTB, Trading 212, Fio a Degiro: která dvojčata nabízí, ISIN a ticker k vyhledání, poplatek za nákup a postup krok za krokem.`
2. `Tabulka všech párů originál → dvojče s TER a ISIN.`
3. `Akumulace vs. distribuce a co to znamená pro daně v ČR (časový test).`
4. `Údaje o brokerech ověřujeme na jejich stránkách; datum ověření je uvedené v návodu.`

Názvy brokerů jsou jen textem, bez log.

**Formulář:** `<LeadForm client:visible placement="preview" pair="sp500" />`.

- [ ] **Step 5: Implementuj `Faq.astro`**

Struktura je `<section data-section="faq">` s `<h2>Časté otázky</h2>` a pěti `<details>` (`<summary>` = otázka):
1. **Je návod opravdu zdarma?** Odpověď: „Ano. Návod dostanete za e-mailovou adresu, nic neplatíte.“
2. **Nebudete mi posílat spam?** Odpověď: „Pošleme vám návod a občas tipy k investování do ETF. Každý e-mail má odkaz na odhlášení, odhlásíte se jedním klikem.“
3. **Co je KID?** Odpověď: „Sdělení klíčových informací: krátký dokument (nejvýše 3 strany), který popisuje fond, jeho rizika a náklady. V EU ho musí mít každý investiční produkt nabízený drobným investorům. Odkaz na KID najdete u každého evropského fondu na této stránce.“
4. **Není evropské dvojče daňově horší?** Odpověď (spec §5.3): „Srážková daň z amerických dividend je srovnatelná: irský fond platí 15 %, vy u amerického ETF s formulářem W-8BEN také 15 %. Rozdíl je v české dani. Výplaty dividend z amerického ETF musíte každý rok přiznat a zdanit. U akumulačního irského fondu se dividendy reinvestují uvnitř fondu a zisk z prodeje po 3 letech držení (časový test) je od daně osvobozen. Jde o obecnou informaci, ne o daňové poradenství.“ Za odpovědí následuje odkaz `Zákon o daních z příjmů, § 4 odst. 1 písm. w)` na `https://www.zakonyprolidi.cz/cs/1992-586#p4-1-w`.
5. **Kdo za tím stojí a co se stane s mými údaji?** Odpověď: „Stránku Indexák provozuje {OPERATOR.name}, IČO {OPERATOR.ico}, {OPERATOR.address}. Váš e-mail použijeme k zaslání návodu a občasných tipů k investování do ETF. Partnerům vaše údaje předáme jen tehdy, když nám k tomu po odeslání formuláře dáte samostatný souhlas. Seznam partnerů a všechny podrobnosti najdete v <a href="/zasady-ochrany-osobnich-udaju">zásadách zpracování osobních údajů</a>.“

**Tracking:** bundlovaný `<script>` naslouchá `toggle` na každém `<details>`. Když `open`, odešle `track('faq_opened', { question: index + 1 })`.

- [ ] **Step 6: Implementuj `Footer.astro`**

Struktura je `<footer data-section="paticka">`, sazba 13px v `--muted` a odkazy v `--ink` s podtržením.

1. **Provozovatel:** `Provozovatel: {OPERATOR.name}, IČO {OPERATOR.ico}, {OPERATOR.address}`, `E-mail: <a href="mailto:…">{OPERATOR.email}</a>`, `Telefon: {OPERATOR.phone}`.
2. **Zdroje** (`<p id="zdroje">`): `Údaje o fondech: stránky a factsheety vydavatelů (Vanguard, State Street Global Advisors, iShares, Invesco, Charles Schwab), stav k {D. M. YYYY z getData().asOf}. Údaje o brokerech v návodu: stránky brokerů k datu uvedenému v návodu.`
3. **Předávání kontaktů:** `Kontaktní údaje předáváme partnerům jen na základě vašeho samostatného souhlasu.`
4. **Disclaimery**, každý jako samostatný odstavec, přesně:
   - `Informace na této stránce mají pouze informativní charakter a nejsou investičním doporučením ani nabídkou ke koupi či prodeji investičního nástroje.`
   - `Investování je spojeno s rizikem. Hodnota investice může klesat i stoupat a nemusí se vám vrátit celá vložená částka. Minulé výnosy nejsou zárukou budoucích.`
   - `Výsledky kalkulačky jsou ilustrativní a nejsou příslibem budoucího výnosu.`
   - `Ochranné známky patří jejich vlastníkům; stránka s vydavateli fondů nespolupracuje.`
5. **Odkazy:** `Zásady zpracování osobních údajů` (`/zasady-ochrany-osobnich-udaju`), `Cookies` (`/cookies`), `<button type="button" data-consent-open>Nastavení cookies</button>`. Tlačítko vypadá jako odkaz; vlastní skript nepotřebuje – `ConsentBanner` (Task 5) poslouchá kliknutí na `[data-consent-open]` na úrovni dokumentu.

- [ ] **Step 7: Implementuj stránku `/zasady-ochrany-osobnich-udaju`**

Stránka používá `<Base title="Zásady zpracování osobních údajů | Indexák" description="Kdo zpracovává vaše osobní údaje na stránce Indexák, proč a jak dlouho.">`. Obsah je v `<main>` s textovým sloupcem `max-width: 68ch` a `<h1>Zásady zpracování osobních údajů</h1>`. Pod nadpisem: `Platné od 11. 10. 2026. Verze textu souhlasu {CONSENT_TEXT_VERSION}.`

Sekce `<h2>`:

1. **Správce:** `{OPERATOR.name}, IČO {OPERATOR.ico}, se sídlem {OPERATOR.address}, e-mail {OPERATOR.email}, telefon {OPERATOR.phone}. Stránku Indexák provozuje správce pod touto značkou.`

2. **Účely a právní základ** (tabulka Účel / Údaje / Právní základ):
   - zaslání návodu a obsahových e-mailů s tipy k investování do ETF · e-mail, zvolený fond, údaje z kalkulačky, zdroj návštěvy (UTM) · souhlas udělený odesláním formuláře, odvolatelný odkazem v každém e-mailu,
   - telefonický kontakt kvůli pomoci s nákupem u brokera · telefon, zvolený broker · samostatný souhlas (a),
   - předání partnerům · e-mail, telefon, zvolený broker · samostatný souhlas (b),
   - měření návštěvnosti bez cookies · anonymní agregované události · oprávněný zájem,
   - měření a propojení cesty, měření reklam Meta, Google Analytics · identifikátor návštěvy, události na stránce · souhlas v nastavení cookies,
   - ochrana formuláře před zneužitím · IP adresa (krátkodobě) · oprávněný zájem,
   - doložení souhlasu · verze textu a čas souhlasu · plnění právní povinnosti.

3. **Seznam partnerů:** `Seznam partnerů doplní provozovatel před spuštěním reklamní kampaně. Dokud zde seznam není uveden, vaše údaje žádnému partnerovi nepředáváme.`

4. **Zpracovatelé a další příjemci:**
   - `Brevo (Sendinblue SAS, Francie) – rozesílání e-mailů a správa kontaktů`,
   - `PostHog Inc., datové centrum v EU (eu.i.posthog.com) – měření návštěvnosti`,
   - `Vercel Inc., USA – hosting stránky; předání do USA na základě standardních smluvních doložek`,
   - `Upstash Inc., databáze v EU – ochrana formuláře proti zneužití (počítadlo požadavků podle IP adresy)`,
   - `Meta Platforms Ireland Ltd. – měření reklam, jen se souhlasem v nastavení cookies; při shromáždění a předání údajů jsme s Meta společnými správci`.

5. **Doba uložení:**
   - e-mail a údaje k obsahovým e-mailům do odvolání souhlasu, nejdéle 3 roky od posledního otevření e-mailu,
   - telefon do odvolání souhlasu, nejdéle 12 měsíců,
   - záznam o souhlasu po dobu zpracování a 3 roky poté,
   - IP adresa pro ochranu formuláře 10 minut,
   - analytická data 12 měsíců.

6. **Vaše práva:**
   - přístup, oprava, výmaz, omezení zpracování, přenositelnost, námitka,
   - odvolání souhlasu kdykoli (odkazem v e-mailu nebo na `{OPERATOR.email}`), aniž by to ovlivnilo zpracování před odvoláním,
   - stížnost u dozorového úřadu: `Úřad pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7,` s odkazem `www.uoou.gov.cz` → `https://uoou.gov.cz`.

Žádné jiné jméno firmy než `OPERATOR` se v souboru nepíše natvrdo (kontrola v Step 9).

- [ ] **Step 8: Slož `index.astro` v pořadí spec §4**

Pořadí:
1. `<Hero variant="a" />` (kořen má `data-section="hero"` z Task 9),
2. `#fondy`,
3. `#kalkulacka`,
4. `<WhyNot />`,
5. `<GuidePreview />`,
6. `<Faq />`,
7. `<Footer />`,
8. `<StickyCta client:idle />`.

Šablona: `<Base title="Evropská dvojčata amerických ETF | Indexák" description="VOO, SPY a IVV u evropského brokera nekoupíte. Ukážeme vám jejich evropská dvojčata, poplatky a pošleme návod ke koupi u XTB, Trading 212, Fio a Degiro.">`. Mezi sekcemi je svislý rytmus `$s6` a dělicí linka 1px `--rule`. Sekce mají stejné levé zarovnání jako hero.

- [ ] **Step 8b: Měření hloubky scrollu v `index.astro`**

Bundlovaný `<script>` v `index.astro`: při překročení 25, 50, 75 a 100 % výšky stránky zavolá jednou za načtení `track('scroll_depth', { percent: 25 | 50 | 75 | 100 })` (throttle přes `requestAnimationFrame`, pasivní listener). E2E v `tests/e2e/home.spec.ts`: `test('scroll_depth fires once per threshold')` – zachytí požadavky na PostHog přes `page.route('**/eu.i.posthog.com/**')`, odscrolluje na konec a dvakrát zpět; očekává právě 4 události `scroll_depth` s hodnotami `[25, 50, 75, 100]`.

- [ ] **Step 9: Spusť E2E a kontrolu natvrdo zapsaného provozovatele**

1. `npm run test:e2e -- tests/e2e/homepage.spec.ts tests/e2e/privacy.spec.ts` → `6 passed`.
2. `grep -rn "Clientelo\|22193456" src --include=*.astro --include=*.tsx --include=*.ts | grep -v "src/lib/operator.ts"` → prázdný výstup.

- [ ] **Step 10: Commit**

```bash
git add src/components/WhyNot.astro src/components/GuidePreview.astro src/components/Faq.astro src/components/Footer.astro src/pages/zasady-ochrany-osobnich-udaju.astro src/pages/index.astro tests/e2e/homepage.spec.ts tests/e2e/privacy.spec.ts
git commit -m "feat: why-not, guide preview, FAQ, footer, privacy policy, full homepage order"
```

---

### Task 12: Děkovací stránky: /dekujeme, /potvrzeno, BrokerPicker, PhoneOffer

**Files:**
- Modify: `src/lib/copy.ts` (přidat `PHONE_COPY`)
- Create: `src/components/BrokerPicker.tsx`, `src/components/PhoneOffer.tsx`, `src/pages/dekujeme.astro`, `src/pages/potvrzeno.astro`
- Test: `tests/unit/copy.test.ts` (rozšířit), `tests/unit/components/BrokerPicker.test.tsx`, `tests/unit/components/PhoneOffer.test.tsx`, `tests/e2e/thankyou.spec.ts`

**Interfaces:**
- Consumes: `getBrokers`, `twinsAtBroker` (Task 3); `track`, `getAid` (Task 5); `normalizeCzPhone` (Task 6); `POST /api/profile` a jeho chybové kódy (Task 7); `CONSENT_TEXT_VERSION` (Task 8); `OPERATOR` (Task 1).
- Produces: `PHONE_COPY` v `src/lib/copy.ts`, `BrokerPicker.tsx` (bez props), `PhoneOffer.tsx` `{ page: 'dekujeme' | 'potvrzeno' }`, stránky `/dekujeme`, `/potvrzeno`.

**Design:** Děkovací stránky mají jeden sloupec a nahoře jen jednu akci, „potvrďte e-mail“. Výběr brokera je hodnota navíc (čipy jako ve FundPicker), telefon je až pod ním a vizuálně tišší (rámeček `--rule`, ne `--ink`). Tlačítka poštovních služeb jsou textová tlačítka bez log.

- [ ] **Step 1: Napiš failing test `PHONE_COPY`**

Do `tests/unit/copy.test.ts` přidej:
```ts
import { OPERATOR } from '../../src/lib/operator';
it('PHONE_COPY texts', () => {
  expect(PHONE_COPY.heading).toBe('Chcete pomoct s prvním nákupem?');
  expect(PHONE_COPY.lead).toBe('Zavoláme vám a projdeme postup u vašeho brokera, bez doporučování konkrétních fondů.');
  expect(PHONE_COPY.who).toBe(`Volat vám bude ${OPERATOR.name} z čísla ${OPERATOR.phone}.`);
  expect(PHONE_COPY.label).toBe('Telefon');
  expect(PHONE_COPY.placeholder).toBe('777 123 456');
  expect(PHONE_COPY.consentCall).toBe(`Souhlasím, aby mě ${OPERATOR.name} telefonicky kontaktoval kvůli pomoci s nákupem u mého brokera.`);
  expect(PHONE_COPY.consentPartners).toBe('Souhlasím s předáním svého e-mailu a telefonu partnerům uvedeným v zásadách zpracování osobních údajů (nepovinné).');
  expect(PHONE_COPY.button).toBe('Zavolejte mi');
  expect(PHONE_COPY.success).toBe('Děkujeme, číslo máme. Ozveme se vám.');
  expect(PHONE_COPY.alreadyGiven).toBe('Pokud jste telefon už zadali, nemusíte nic dělat.');
  expect(PHONE_COPY.errors).toEqual({
    invalid_phone: 'Zadejte české číslo, např. 777 123 456 nebo +420 777 123 456.',
    consent_required: 'Bez souhlasu s telefonickým kontaktem vám zavolat nemůžeme.',
    phone_taken: `Toto číslo už u nás má jiný kontakt. Napište nám na ${OPERATOR.email}.`,
    server: 'Něco se nepovedlo, zkuste to znovu.',
  });
});
```

- [ ] **Step 2: Spusť test a ověř, že selže**

`npx vitest run tests/unit/copy.test.ts` → `FAIL … PHONE_COPY texts` s `TypeError: Cannot read properties of undefined (reading 'heading')`.

- [ ] **Step 3: Implementuj `PHONE_COPY` v `src/lib/copy.ts`**

`import { OPERATOR } from './operator'`. Export `PHONE_COPY` s klíči a texty přesně podle Step 1 (`heading, lead, who, label, placeholder, consentCall, consentPartners, button, success, alreadyGiven, errors`). Chybový kód `rate_limited` z API se v komponentě mapuje na `errors.server`.

- [ ] **Step 4: Spusť test a ověř, že projde**

`npx vitest run tests/unit/copy.test.ts` → `✓ 4 passed`.

- [ ] **Step 5: Napiš failing test `PhoneOffer` (Review Focus 5)**

`tests/unit/components/PhoneOffer.test.tsx`. `fetch` je mock (`vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))`). Pomocná funkce `fill(phone, a, b)` napíše do `Telefon`, zaškrtne souhlasy podle `a`/`b` a klikne na `Zavolejte mi`.
```ts
it.each([
  ['777 123 456', '+420777123456'],
  ['+420777123456', '+420777123456'],
  ['00420 777 123 456', '+420777123456'],
])('CZ format %j is normalized', async (raw, normalized) => {
  render(<PhoneOffer page="dekujeme" />);
  await fill(raw, true, false);
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe('/api/profile');
  expect(JSON.parse(init.body)).toEqual({ aid: 'test-aid', phone: normalized, consent_call: true, consent_partners: false, consent_text_version: '2026-10-11' });
  expect(await screen.findByText('Děkujeme, číslo máme. Ozveme se vám.')).toBeInTheDocument();
  expect(track).toHaveBeenCalledWith('phone_submitted', { page: 'dekujeme', consent_partners: false });
});
it.each(['+421 905 123 456', '12345'])('rejects %j without request', async raw => {
  render(<PhoneOffer page="dekujeme" />);
  await fill(raw, true, false);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText('Zadejte české číslo, např. 777 123 456 nebo +420 777 123 456.')).toBeInTheDocument();
  expect(screen.getByLabelText('Telefon')).toHaveAttribute('aria-invalid', 'true');
});
it('does not send without consent (a)', async () => {
  render(<PhoneOffer page="dekujeme" />);
  await fill('777 123 456', false, true);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText('Bez souhlasu s telefonickým kontaktem vám zavolat nemůžeme.')).toBeInTheDocument();
});
it('sends consent_partners true when (b) checked', async () => {
  render(<PhoneOffer page="potvrzeno" />);
  await fill('777 123 456', true, true);
  expect(JSON.parse(fetch.mock.calls[0][1].body).consent_partners).toBe(true);
  expect(track).toHaveBeenCalledWith('phone_submitted', { page: 'potvrzeno', consent_partners: true });
});
it('both consents start unchecked; potvrzeno shows alreadyGiven', () => {
  render(<PhoneOffer page="potvrzeno" />);
  screen.getAllByRole('checkbox').forEach(c => expect(c).not.toBeChecked());
  expect(screen.getByText('Pokud jste telefon už zadali, nemusíte nic dělat.')).toBeInTheDocument();
});
it.each([
  ['phone_taken', 'Toto číslo už u nás má jiný kontakt. Napište nám na fundraising@clientelo.cz.'],
  ['rate_limited', 'Něco se nepovedlo, zkuste to znovu.'],
  ['server', 'Něco se nepovedlo, zkuste to znovu.'],
])('API error %s shows message and keeps value', async (error, msg) => {
  fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error }), { status: 400 }));
  render(<PhoneOffer page="dekujeme" />);
  await fill('777 123 456', true, false);
  expect(await screen.findByText(msg)).toBeInTheDocument();
  expect(screen.getByLabelText('Telefon')).toHaveValue('777 123 456');
  expect(track).not.toHaveBeenCalledWith('phone_submitted', expect.anything());
});
it('button disabled while sending → single request on double click', async () => {
  fetch.mockImplementationOnce(() => new Promise(r => setTimeout(() => r(new Response('{"ok":true}')), 50)));
  render(<PhoneOffer page="dekujeme" />);
  await userEvent.type(screen.getByLabelText('Telefon'), '777123456');
  await userEvent.click(screen.getByLabelText(PHONE_COPY.consentCall));
  await userEvent.dblClick(screen.getByRole('button', { name: 'Zavolejte mi' }));
  expect(fetch).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 6: Spusť test a ověř, že selže**

`npx vitest run tests/unit/components/PhoneOffer.test.tsx` → `FAIL … Failed to resolve import "../../../src/components/PhoneOffer"`.

- [ ] **Step 7: Implementuj `PhoneOffer.tsx`**

**Markup:**
- `<section aria-labelledby>` s `<h2>{heading}</h2>`, `<p>{lead}</p>`, `<p>{who}</p>`, u `page === 'potvrzeno'` navíc `<p>{alreadyGiven}</p>`.
- `<form noValidate>` s `<label>Telefon</label>` + `<input type="tel" autoComplete="tel" inputMode="tel" placeholder>`.
- Dva nezaškrtnuté `<input type="checkbox">` s `<label>` (`consentCall`, `consentPartners`). V `consentPartners` jsou slova „zásadách zpracování osobních údajů“ odkazem na `/zasady-ochrany-osobnich-udaju`, otevíraným v novém okně.
- Tlačítko `{button}`.

**Odeslání v tomto pořadí:**
1. bez (a) → chyba `consent_required` u souhlasu,
2. `normalizeCzPhone(value)` je `null` → chyba `invalid_phone`, `aria-invalid="true"` a `aria-describedby` na hlášku,
3. jinak `sending=true` (tlačítko `disabled`) a `fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aid: getAid(), phone, consent_call: true, consent_partners: b, consent_text_version: CONSENT_TEXT_VERSION }) })`.

**Vyhodnocení odpovědi:**
- `ok` → nahradí formulář textem `{success}` (`role="status"`) a odešle `track('phone_submitted', { page, consent_partners: b })`,
- chyba → `errors[error] ?? errors.server`, hodnota pole zůstane,
- výjimka `fetch` → `errors.server`.

- [ ] **Step 8: Spusť test a ověř, že projde**

`npx vitest run tests/unit/components/PhoneOffer.test.tsx` → `✓ 12 passed`.

- [ ] **Step 9: Napiš failing test `BrokerPicker`**

`tests/unit/components/BrokerPicker.test.tsx`. Částečný mock `pairs`:
```ts
vi.mock('../../../src/lib/pairs', async orig => {
  const m = await orig<typeof import('../../../src/lib/pairs')>();
  return { ...m, twinsAtBroker: vi.fn((b: string) => b === 'xtb'
    ? [{ fund: m.getFund('SPYL'), ticker: 'SPYL.DE' }, { fund: m.getFund('CSPX'), ticker: 'CSPX.UK' }] : []) };
});
it('renders 5 chips in order', () => {
  render(<BrokerPicker />);
  expect(screen.getByRole('heading', { name: 'U kterého brokera máte účet?' })).toBeInTheDocument();
  expect(screen.getAllByRole('radio').map(r => r.closest('label')!.textContent)).toEqual(['XTB', 'Trading 212', 'Fio', 'Degiro', 'Zatím žádný']);
});
it('XTB shows twins with ticker and ISIN, posts profile, tracks', async () => {
  render(<BrokerPicker />);
  await userEvent.click(screen.getByRole('radio', { name: 'XTB' }));
  expect(twinsAtBroker).toHaveBeenCalledWith('xtb', 'sp500');
  const rows = screen.getAllByTestId('broker-twin');
  expect(rows[0]).toHaveTextContent('SPYL.DE'); expect(rows[0]).toHaveTextContent('IE000XZSV718');
  expect(rows[1]).toHaveTextContent('CSPX.UK'); expect(rows[1]).toHaveTextContent('IE00B5BMR087');
  expect(fetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({ method: 'POST' }));
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ aid: 'test-aid', broker: 'xtb', consent_text_version: '2026-10-11' });
  expect(track).toHaveBeenCalledWith('broker_selected', { broker: 'xtb' });
});
it('broker without verified data shows exact message', async () => {
  render(<BrokerPicker />);
  await userEvent.click(screen.getByRole('radio', { name: 'Fio' }));
  expect(screen.getByText('U tohoto brokera jsme dostupnost zatím neověřili.')).toBeInTheDocument();
  expect(screen.queryAllByTestId('broker-twin')).toHaveLength(0);
});
it('"Zatím žádný" tracks none and does not post', async () => {
  render(<BrokerPicker />);
  await userEvent.click(screen.getByRole('radio', { name: 'Zatím žádný' }));
  expect(fetch).not.toHaveBeenCalled();
  expect(track).toHaveBeenCalledWith('broker_selected', { broker: 'none' });
  expect(screen.getByText('V návodu najdete poplatek za nákup u každého ze čtyř brokerů, takže si můžete porovnat, kde účet založit.')).toBeInTheDocument();
});
it('failed profile POST does not hide the answer', async () => {
  fetch.mockRejectedValueOnce(new Error('network'));
  render(<BrokerPicker />);
  await userEvent.click(screen.getByRole('radio', { name: 'XTB' }));
  expect(screen.getAllByTestId('broker-twin')).toHaveLength(2);
});
```

Pořadí `XTB, Trading 212, Fio, Degiro` je pořadí v `brokers.json` (Task 3). Názvy se berou z `broker.name`.

- [ ] **Step 10: Spusť test a ověř, že selže**

`npx vitest run tests/unit/components/BrokerPicker.test.tsx` → `FAIL … Failed to resolve import "../../../src/components/BrokerPicker"`.

- [ ] **Step 11: Implementuj `BrokerPicker.tsx`**

**Markup:** `<h2>U kterého brokera máte účet?</h2>` a `<fieldset>` s radio čipy `getBrokers().map(b => b.name)` plus `Zatím žádný` (hodnota `'none'`).

**Po výběru brokera `b`:**
- `rows = twinsAtBroker(b, 'sp500')`,
- s daty: nadpis `S&P 500 u {name}` a pro každý řádek (`data-testid="broker-twin"`) ticker u brokera (`$font-mono`), `ISIN {fund.isin.value}` a `TER {formatTer(fund.ter.value)}`; pod tím `Údaje ověřené k {D. M. YYYY z broker.asOf}`,
- bez dat: přesně `U tohoto brokera jsme dostupnost zatím neověřili.`,
- odešle `track('broker_selected', { broker: b })`,
- odešle `fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aid: getAid(), broker: b, consent_text_version: CONSENT_TEXT_VERSION }) })`; chyba se ignoruje (`.catch(() => {})`), protože odpověď na obrazovce na ní nezávisí.

**Po výběru `none`:** jen `track('broker_selected', { broker: 'none' })` (API typ `BrokerId` hodnotu `none` nezná) a text `V návodu najdete poplatek za nákup u každého ze čtyř brokerů, takže si můžete porovnat, kde účet založit.`

- [ ] **Step 12: Spusť test a ověř, že projde**

`npx vitest run tests/unit/components/BrokerPicker.test.tsx` → `✓ 5 passed`.

- [ ] **Step 13: Napiš failing E2E test děkovacích stránek**

`tests/e2e/thankyou.spec.ts`. V `beforeEach` se zachytí profilové požadavky: `page.route('**/api/profile', r => { bodies.push(r.request().postDataJSON()); r.fulfill({ json: { ok: true } }) })`.
```ts
test('/dekujeme flow: broker → phone with (a) without (b)', async ({ page }) => {
  await page.goto('/dekujeme?aid=e2e-aid');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ještě jeden klik: potvrďte e-mail');
  await expect(page.getByRole('link', { name: 'Otevřít Gmail' })).toHaveAttribute('href', 'https://mail.google.com/');
  await expect(page.getByRole('link', { name: 'Otevřít Seznam Email' })).toHaveAttribute('href', 'https://email.seznam.cz/');
  await page.getByRole('radio', { name: 'XTB' }).check();
  await expect.poll(() => bodies[0]).toEqual({ aid: 'e2e-aid', broker: 'xtb', consent_text_version: '2026-10-11' });
  await page.getByLabel('Telefon').fill('777 123 456');
  await page.getByLabel(/telefonicky kontaktoval/).check();
  await page.getByRole('button', { name: 'Zavolejte mi' }).click();
  await expect(page.getByText('Děkujeme, číslo máme. Ozveme se vám.')).toBeVisible();
  expect(bodies[1]).toEqual({ aid: 'e2e-aid', phone: '+420777123456', consent_call: true, consent_partners: false, consent_text_version: '2026-10-11' });
});
test('/potvrzeno: PDF link, phone offer note, noindex', async ({ page }) => {
  await page.goto('/potvrzeno?aid=e2e-aid');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: 'Stáhnout návod (PDF)' })).toHaveAttribute('href', '/navod-etf.pdf');
  await expect(page.getByText('Pokud jste telefon už zadali, nemusíte nic dělat.')).toBeVisible();
});
```

- [ ] **Step 14: Spusť E2E a ověř, že selže**

`npm run test:e2e -- tests/e2e/thankyou.spec.ts` → `2 failed`, první: `expect(locator).toHaveAttribute … locator('meta[name="robots"]') … element(s) not found` (stránka vrací 404).

- [ ] **Step 15: Implementuj `/dekujeme`**

`src/pages/dekujeme.astro`, `<Base title="Potvrďte e-mail | Indexák" description="Potvrďte e-mail a návod vám pošleme." noindex>`.

1. `<h1>Ještě jeden klik: potvrďte e-mail</h1>`.
2. `<p>Poslali jsme vám e-mail s předmětem „Potvrďte a návod je váš“. Po kliknutí na tlačítko v něm vám návod pošleme.</p>`
3. `<p>Nevidíte ho? Podívejte se i do složek Promoakce, Hromadné nebo Spam.</p>`
4. Dvě odkazová tlačítka vedle sebe (`target="_blank" rel="noopener"`): `Otevřít Gmail` → `https://mail.google.com/`, `Otevřít Seznam Email` → `https://email.seznam.cz/`. Obě jsou stejně výrazná (rámeček 1px `--ink`, výška 48 px).
5. Linka `--rule`.
6. `<BrokerPicker client:load />`.
7. Linka `--rule`.
8. `<PhoneOffer client:visible page="dekujeme" />`.

Bundlovaný `<script>`: `track('thankyou_viewed')` při načtení.

- [ ] **Step 16: Implementuj `/potvrzeno`**

`src/pages/potvrzeno.astro`, `<Base title="Návod ke stažení | Indexák" description="Váš návod ke koupi evropských dvojčat ETF." noindex>`.

1. `<h1>E-mail je potvrzený. Tady je váš návod.</h1>`
2. Hlavní tlačítko `<a href="/navod-etf.pdf" download data-pdf>Stáhnout návod (PDF)</a>`: `--signal`, šířka 100 %, výška 48 px.
3. `<p>Stejný návod vám posíláme i e-mailem.</p>`
4. Linka `--rule`.
5. `<PhoneOffer client:visible page="potvrzeno" />`.

Bundlovaný `<script>`: při načtení `track('doi_confirmed')`, klik na `[data-pdf]` → `track('pdf_downloaded')`.

- [ ] **Step 17: Spusť E2E a ověř, že projde**

`npm run test:e2e -- tests/e2e/thankyou.spec.ts` → `2 passed`.

Pokud `/navod-etf.pdf` ještě neexistuje (Task 13), test kontroluje jen `href` a projde.

- [ ] **Step 18: Spusť celou sadu části C**

1. `npx vitest run` → všechny testy `passed`.
2. `npm run test:e2e -- tests/e2e/hero.spec.ts tests/e2e/homepage.spec.ts tests/e2e/privacy.spec.ts tests/e2e/thankyou.spec.ts` → `15 passed`.
3. `npm run lint` → `0 errors`.

- [ ] **Step 19: Commit**

```bash
git add src/lib/copy.ts src/components/BrokerPicker.tsx src/components/PhoneOffer.tsx src/pages/dekujeme.astro src/pages/potvrzeno.astro tests/unit/copy.test.ts tests/unit/components/BrokerPicker.test.tsx tests/unit/components/PhoneOffer.test.tsx tests/e2e/thankyou.spec.ts
git commit -m "feat: thank-you and confirmation pages with broker picker and phone offer"
```

---

## Část D – PDF, reklamy, nasazení, README (Task 13–16)

> Závazné jsou Global Constraints, Shared Contracts a „Interfaces per task" z `00-skeleton.md`. Nic se nepřejmenovává. Pomocné funkce, které tato část zavádí, jsou interní (nepoužívá je žádný jiný úkol) a jsou výslovně označené.

**Pořadí v části D:** 13 → 14 (Task 14 používá TTF fonty z Task 13) → 15 → 16 (README přebírá produkční URL, odkaz na PostHog a výsledky Lighthouse z Task 15; pokud Task 15 čeká na člověka, README uvede stav „ČEKÁ: …" a doplní se po dokončení).

---

### Task 13: PDF návod

**Files:**
- Create: `src/pdf/GuideDocument.tsx`
- Create: `scripts/build-pdf.tsx`
- Create: `public/fonts/pdf/text-regular.ttf`, `public/fonts/pdf/text-bold.ttf`, `public/fonts/pdf/mono-regular.ttf`
- Modify: `package.json` (`"prebuild"`, devDependencies `@react-pdf/renderer`, `tsx`, `pdf-parse`)
- Modify: `.gitignore` (`public/navod-etf.pdf` – generuje se při každém buildu)
- Test: `tests/unit/pdf-build.test.ts`, `tests/unit/pdf-availability.test.tsx`, pomocník `tests/unit/helpers/pdf-text.ts`

**Interfaces:**
- Consumes: Task 1 `OPERATOR` (`src/lib/operator.ts`), `src/styles/tokens.scss` (`$paper`, `$ink`, `$signal`, `$muted`, `$rule`); Task 2 `getData()`, `getGroup()`, `getFund()`, `twinsSortedByTer()`, `originalsOf()`, `validateData()`; Task 3 `getBrokers()`, `twinsAtBroker()`, `validateBrokers()`; Task 4 `formatTer()`.
- Produces: `src/pdf/GuideDocument.tsx` (`export function GuideDocument(): JSX.Element`, bez props – vše čte z `pairs.ts`), `scripts/build-pdf.tsx` → `public/navod-etf.pdf`, npm skript `prebuild`.

**Ověřeno (zdroje):**
- `renderToFile(<Doc />, path)` a `renderToStream` v Node: https://react-pdf.org/node
- `Font.register({ family, fonts: [{ src, fontWeight }] })`, `src` = absolutní cesta v Node, „only TTF and WOFF fonts files are supported", variabilní fonty nejsou podporované, `Font.registerHyphenationCallback(word => [word])` vypne dělení: https://react-pdf.org/fonts
- React 19 podporuje `@react-pdf/renderer` od v4.1.0, testováno na Node 18/20/21: https://react-pdf.org/compatibility
- `pdf-parse` v2: `new PDFParse({ data: buffer })`, `await parser.getText()` → `result.text`, `await parser.destroy()`: https://github.com/mehmet-kozan/pdf-parse

**Obsah PDF (spec §2, §5.3, §7.5) – pevná struktura, kterou testy hledají:**

| Blok | Obsah | Značka v textu (pro testy) |
|---|---|---|
| Titul | „Jak koupit S&P 500 a další americké indexy u XTB, Trading 212, Fio a Degiro"; motiv `VOO ⇄ SPYL` (tickery v mono písmu); 2 věty PRIIPs („Americké ETF jako VOO evropský broker drobnému investorovi neprodá, protože k nim neexistuje dokument KID. Na stejné indexy ale existují evropské fondy – tento návod ukazuje, jak je u vašeho brokera najít."); řádek „Ověřeno k {datum}" (`getData().asOf`, formát `11. 10. 2026`) | `Ověřeno k` |
| Broker (×4, pořadí dle `getBrokers()`) | nadpis `Návod pro {broker.name}`; „Poplatek za nákup: {buyFee.value}" + „zdroj: {doména buyFee.sourceUrl}, k {datum}"; pro každou skupinu z `getData().groups`: popisek skupiny, u `exactTwin=false` doplněk „nejbližší alternativa, jiný index" + `group.note`; řádky z `twinsAtBroker(broker.id, group.id)`: ticker u brokera (mono) · `fund.name.value` · ISIN (mono) · TER (`formatTer`) · „akumulační"/„distribuční"; když skupina nemá u brokera žádný dostupný fond: „U {broker.name} jsme k {datum} fond z této skupiny nenašli."; „Postup krok za krokem": číslovaný seznam `steps.value` + „zdroj: {doména steps.sourceUrl}, k {datum}"; dole „Údaje ověřeny na stránkách brokera k {broker.asOf}" | `Návod pro ` |
| Tabulka všech párů | nadpis `Všechny páry: originál z NYSE → evropské dvojče`; pro každou skupinu: originály (`originalsOf`: ticker, TER, burza) → dvojčata (`twinsSortedByTer`: ticker, ISIN, TER, akum./dist.); pod tabulkou „Zdroj: vydavatelé fondů (factsheety), k {datum}" | `Všechny páry` |
| Daně | nadpis `Akumulace, distribuce a daně v ČR`; 3 odstavce dle spec §5.3 (text níže); „Obecná informace, ne daňové poradenství." + zdroje | `Akumulace, distribuce` |
| Patička (`fixed`, každá strana) | `{OPERATOR.name}, IČO {OPERATOR.ico}, {OPERATOR.address} · {OPERATOR.email} · {OPERATOR.web}`; disclaimer; ochranné známky; „strana X/Y" | `IČO` |

Text sekce Daně (doslova, česky):
1. „Srážková daň z amerických dividend je u obou cest srovnatelná: irský fond platí v USA 15 %, český investor u amerického ETF s formulářem W-8BEN také 15 %."
2. „Rozdíl je v české dani. Dividendy z amerického ETF se v Česku daní každý rok a musíte je uvést v daňovém přiznání. U akumulačního irského fondu se dividendy reinvestují uvnitř fondu a zisk z prodeje po více než 3 letech držení (časový test) je od daně z příjmů osvobozen."
3. „Pro českého drobného investora je proto akumulační evropské dvojče daňově spíš výhodnější."
- Zdroje: `https://www.irs.gov/forms-pubs/about-form-w-8-ben`, `https://www.zakonyprolidi.cz/cs/1992-586` (§ 4 odst. 1 písm. w) – implementátor odkaz před commitem otevře a ověří, že ustanovení odpovídá; pokud ne, větu o časovém testu nechá a odkaz nahradí ověřeným (Global Constraints: nic se nedomýšlí).

Disclaimer (doslova): „Informace mají obecnou povahu a nejsou investičním doporučením ani daňovým poradenstvím. Investování nese riziko ztráty, minulé výnosy nezaručují budoucí. Ochranné známky patří jejich vlastníkům; stránka s vydavateli fondů ani brokery nespolupracuje."

- [ ] **Step 1: Přidej závislosti a fonty**

```bash
npm i -D @react-pdf/renderer@^4.1.0 tsx pdf-parse@^2
```
Zjisti rodiny písem z `$font-text` a `$font-mono` v `src/styles/tokens.scss` (Task 1). Stáhni **statické** (ne variabilní) TTF těchže rodin s licencí OFL z oficiálního repozitáře rodiny (např. `github.com/google/fonts/tree/main/ofl/<rodina>/static`) a ulož pod neutrálními názvy:
```
public/fonts/pdf/text-regular.ttf
public/fonts/pdf/text-bold.ttf
public/fonts/pdf/mono-regular.ttf
```
Ověř, že obsahují české znaky:
```bash
fc-query public/fonts/pdf/text-regular.ttf | grep -c 'charset' && \
python3 -c "from fontTools.ttLib import TTFont as F; c=F('public/fonts/pdf/text-regular.ttf').getBestCmap(); print(all(ord(x) in c for x in 'ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ'))"
```
Očekávaný výstup: nenulový počet a `True` (pokud `fontTools` chybí: `pip install fonttools`). Totéž pro `text-bold.ttf` a `mono-regular.ttf`.

Do `.gitignore` přidej řádek `public/navod-etf.pdf`.

- [ ] **Step 2: Napiš failing test výstupu buildu** – `tests/unit/pdf-build.test.ts`

```ts
// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PDFParse } from 'pdf-parse';
import { getBrokers, getFund } from '../../src/lib/pairs';
import { sectionFor } from './helpers/pdf-text';

const PDF = 'public/navod-etf.pdf';
let text = '';

describe('build-pdf', () => {
  beforeAll(async () => {
    execFileSync('npx', ['tsx', 'scripts/build-pdf.tsx'], { stdio: 'inherit' });
    const parser = new PDFParse({ data: readFileSync(PDF) });
    text = (await parser.getText()).text;
    await parser.destroy();
  }, 120_000);

  it('writes a PDF smaller than 1 MB', () => {
    expect(existsSync(PDF)).toBe(true);
    expect(readFileSync(PDF).subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(statSync(PDF).size).toBeLessThan(1024 * 1024);
  });

  it('contains SPYL with its ISIN from data', () => {
    expect(text).toContain('SPYL');
    expect(text).toContain('IE000XZSV718');
    expect(getFund('SPYL').isin.value).toBe('IE000XZSV718');
  });

  it('has a section for every broker', () => {
    for (const b of getBrokers()) expect(text).toContain(`Návod pro ${b.name}`);
  });

  it('keeps Czech diacritics', () => {
    expect(text).toContain('Ověřeno k');
    expect(text).toContain('Všechny páry');
    expect(text).toContain('Akumulace, distribuce a daně v ČR');
  });

  it('has the operator footer', () => {
    expect(text).toMatch(/IČO\s*\d{8}/);
  });

  it('omits funds a broker does not offer (real data)', () => {
    for (const b of getBrokers()) {
      const section = sectionFor(text, b.name);
      for (const l of b.listings.filter((x) => x.available.value === false)) {
        expect(section, `${b.name} / ${l.fundId}`).not.toContain(getFund(l.fundId).isin.value);
      }
    }
  });
});
```

`tests/unit/helpers/pdf-text.ts` (sdílí oba PDF testy; testovací soubor se neimportuje z jiného testu, jinak by se spustily jeho testy):
```ts
/** Text sekce „Návod pro {broker}" až po další sekci brokera nebo tabulku všech párů. */
export function sectionFor(all: string, brokerName: string): string {
  const start = all.indexOf(`Návod pro ${brokerName}`);
  if (start < 0) throw new Error(`section ${brokerName} missing`);
  const rest = all.slice(start + 1);
  const ends = [rest.indexOf('Návod pro '), rest.indexOf('Všechny páry')].filter((i) => i >= 0);
  return all.slice(start, start + 1 + Math.min(...ends));
}
```

- [ ] **Step 3: Napiš failing test dostupnosti s upravenými daty** – `tests/unit/pdf-availability.test.tsx`

Test nezávisí na tom, zda reálná data obsahují `available=false`: v kopii `brokers.json` přepne u XTB první dostupný fond na nedostupný.

```tsx
// @vitest-environment node
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderToFile } from '@react-pdf/renderer';
import { PDFParse } from 'pdf-parse';
import { sectionFor } from './helpers/pdf-text';

const flipped = vi.hoisted(() => ({ fundId: '' }));

vi.mock('../../src/data/brokers.json', async (importOriginal) => {
  const mod = (await importOriginal()) as { default: unknown };
  const clone = structuredClone(mod.default);
  const walk = (n: any): boolean => {
    if (n && typeof n === 'object') {
      if (n.id === 'xtb' && Array.isArray(n.listings)) {
        const l = n.listings.find((x: any) => x.available.value === true);
        l.available = { ...l.available, value: false };
        flipped.fundId = l.fundId;
        return true;
      }
      return Object.values(n).some(walk);
    }
    return false;
  };
  if (!walk(clone)) throw new Error('xtb not found in brokers.json');
  return { default: clone };
});

describe('GuideDocument availability', () => {
  it('does not list a fund in a broker section where available=false', async () => {
    const { GuideDocument } = await import('../../src/pdf/GuideDocument');
    const { getBroker, getFund } = await import('../../src/lib/pairs');
    const out = join(mkdtempSync(join(tmpdir(), 'ix-pdf-')), 'g.pdf');
    await renderToFile(<GuideDocument />, out);
    const p = new PDFParse({ data: readFileSync(out) });
    const text = (await p.getText()).text;
    await p.destroy();

    const isin = getFund(flipped.fundId).isin.value;
    expect(sectionFor(text, getBroker('xtb').name)).not.toContain(isin);
    expect(text.slice(text.indexOf('Všechny páry'))).toContain(isin); // tabulka párů ho dál obsahuje
  }, 60_000);
});
```
Pozn.: `vi.mock` cílí na stejnou cestu, kterou importuje `src/lib/pairs.ts` (Task 3); pokud ji `pairs.ts` importuje jinak (alias), uprav cestu v mocku. Pokud `vitest.config.ts` (Task 1) nemá `include` pro `*.test.tsx`, doplň `tests/unit/**/*.test.{ts,tsx}`.

- [ ] **Step 4: Spusť testy – musí selhat**

```bash
npx vitest run tests/unit/pdf-build.test.ts tests/unit/pdf-availability.test.tsx
```
Očekávaný výstup:
```
FAIL tests/unit/pdf-build.test.ts > build-pdf
Error: Command failed: npx tsx scripts/build-pdf.tsx
... Cannot find module '/…/scripts/build-pdf.tsx'
FAIL tests/unit/pdf-availability.test.tsx
Error: Failed to load url ../../src/pdf/GuideDocument (resolved id: …) Does the file exist?
Test Files  2 failed (2)
```

- [ ] **Step 5: Implementuj `src/pdf/GuideDocument.tsx`**

Kostra (dopiš podle tabulky „Obsah PDF" výše):
```tsx
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { compileString } from 'sass';
import { Document, Page, Text, View, Link, StyleSheet, Font } from '@react-pdf/renderer';
import { getData, getBrokers, twinsAtBroker, twinsSortedByTer, originalsOf } from '../lib/pairs';
import { formatTer } from '../lib/format';
import { OPERATOR } from '../lib/operator';

const FONT_DIR = fileURLToPath(new URL('../../public/fonts/pdf/', import.meta.url));
Font.register({ family: 'IxText', fonts: [
  { src: join(FONT_DIR, 'text-regular.ttf') },
  { src: join(FONT_DIR, 'text-bold.ttf'), fontWeight: 700 },
]});
Font.register({ family: 'IxMono', src: join(FONT_DIR, 'mono-regular.ttf') });
Font.registerHyphenationCallback((word) => [word]); // čeština: bez dělení slov

// Barvy z jediného zdroje – tokens.scss (Task 1)
const STYLES_DIR = fileURLToPath(new URL('../styles/', import.meta.url));
const tokenCss = compileString(
  '@use "tokens" as t; :root{--paper:#{t.$paper};--ink:#{t.$ink};--signal:#{t.$signal};--muted:#{t.$muted};--rule:#{t.$rule}}',
  { loadPaths: [STYLES_DIR] },
).css;
const tok = (n: string) => {
  const m = tokenCss.match(new RegExp(`--${n}:\\s*([^;]+);`));
  if (!m) throw new Error(`token ${n} missing`);
  return m[1].trim();
};
const C = { paper: tok('paper'), ink: tok('ink'), signal: tok('signal'), muted: tok('muted'), rule: tok('rule') };

const formatDateCz = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}. ${m}. ${y}`; };
const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');

const s = StyleSheet.create({
  page: { backgroundColor: C.paper, color: C.ink, fontFamily: 'IxText', fontSize: 10, padding: 36, paddingBottom: 72 },
  h1: { fontSize: 20, fontWeight: 700, marginBottom: 8 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 3 },
  mono: { fontFamily: 'IxMono' },
  signal: { color: C.signal },
  muted: { color: C.muted, fontSize: 8 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.rule, paddingVertical: 3 },
  footer: { position: 'absolute', left: 36, right: 36, bottom: 20, fontSize: 7, color: C.muted },
});

export function GuideDocument() {
  const data = getData();
  const brokers = getBrokers();
  // Titul → bloky brokerů (View wrap={false} kolem jedné skupiny, aby se řádky netrhaly)
  // → „Všechny páry: originál z NYSE → evropské dvojče" → „Akumulace, distribuce a daně v ČR"
  // Patička: <View fixed style={s.footer}> … <Text render={({ pageNumber, totalPages }) => `strana ${pageNumber}/${totalPages}`} />
  return (
    <Document title="Jak koupit S&P 500 u českých brokerů" author={OPERATOR.name} language="cs">
      <Page size="A4" style={s.page}>{/* … */}</Page>
    </Document>
  );
}
```
Pravidla implementace:
- Fondy u brokera **výhradně** přes `twinsAtBroker(b.id, g.id)` (filtruje `available.value === true` a řadí jako `twinsSortedByTer`); nikdy neprocházet `b.listings` přímo.
- Pořadí skupin = `getData().groups`; řazení podle TER = `twinsSortedByTer`; TER vždy `formatTer()`; žádné „nejlepší"/„nejlevnější".
- Tickery a ISIN stylem `s.mono`; signální barva jen pro šipku `⇄`/`→` a nadpisové linky. Žádná loga.
- Odkazy na zdroje jako `<Link src={sourceUrl}>{host(sourceUrl)}</Link>`.
- Cíl 3–4 strany A4; pokud vyjde víc, zmenši mezery, ne obsah.

- [ ] **Step 6: Implementuj `scripts/build-pdf.tsx`**

```tsx
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToFile } from '@react-pdf/renderer';
import { GuideDocument } from '../src/pdf/GuideDocument';
import { getData, getBrokers, validateData, validateBrokers } from '../src/lib/pairs';

const OUT = fileURLToPath(new URL('../public/navod-etf.pdf', import.meta.url));

const errors = [...validateData(getData()), ...validateBrokers(getBrokers(), getData())];
if (errors.length) {
  console.error('build-pdf: data validation failed:\n' + errors.join('\n'));
  process.exit(1); // neověřená data do PDF nepustíme
}
mkdirSync(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });
await renderToFile(<GuideDocument />, OUT);
console.log(`build-pdf: wrote ${OUT}`);
```
V `package.json` → `"scripts"`: `"prebuild": "tsx scripts/build-pdf.tsx"` (npm ho spustí automaticky před `npm run build`, tedy i na Vercelu). Pokud projekt používá pnpm, pre-skripty jsou vypnuté – pak `"build": "tsx scripts/build-pdf.tsx && astro build"` a v README to uveď.

- [ ] **Step 7: Spusť testy – musí projít**

```bash
npx vitest run tests/unit/pdf-build.test.ts tests/unit/pdf-availability.test.tsx
```
Očekávaný výstup:
```
build-pdf: wrote /…/public/navod-etf.pdf
✓ tests/unit/pdf-build.test.ts (6 tests)
✓ tests/unit/pdf-availability.test.tsx (1 test)
Test Files  2 passed (2)
```
Pak `npm run build` (ověř, že `prebuild` proběhl a `public/navod-etf.pdf` je v buildu) a otevři PDF očima: diakritika, tickery v mono písmu, 3–4 strany, patička na každé straně, žádné přetékání tabulky.

- [ ] **Step 8: Commit**

```bash
git add src/pdf/GuideDocument.tsx scripts/build-pdf.tsx public/fonts/pdf tests/unit/pdf-build.test.ts tests/unit/pdf-availability.test.tsx tests/unit/helpers/pdf-text.ts package.json package-lock.json .gitignore vitest.config.ts
git commit -m "feat: generate PDF guide from fund and broker data at build time"
```

---

### Task 14: Reklamní kreativy A/B

**Files:**
- Create: `ads/templates/a.html`, `ads/templates/b.html`, `ads/templates/ads.css`
- Create: `scripts/render-ads.ts`
- Create: `ads/copy.md`
- Create (výstup skriptu, commitují se): `ads/a-4x5.png`, `ads/a-9x16.png`, `ads/b-4x5.png`, `ads/b-9x16.png`, `public/og.png` (1200×630, z šablony A ve formátu `og`; Base.astro na něj odkazuje jako výchozí `ogImage`)
- Modify: `package.json` (`"ads": "tsx scripts/render-ads.ts"`, devDependency `image-size`), `.gitignore` (`ads/templates/_*.filled.html`)
- Test: `tests/unit/ads.test.ts`

**Interfaces:**
- Consumes: Task 2 `getData()`, `getFund()`, `twinsSortedByTer()`, `originalsOf()`; Task 3 `getBrokers()`; Task 4 `formatTer()`; Task 9 `heroVariantFromUtm()` (kontrola, že UTM v `ads/copy.md` přepnou správný hero); Task 13 fonty `public/fonts/pdf/*.ttf`; `src/styles/tokens.scss`.
- Produces: `ads/templates/{a,b}.html`, `scripts/render-ads.ts` (npm `ads`), `ads/a-4x5.png`, `ads/a-9x16.png`, `ads/b-4x5.png`, `ads/b-9x16.png`. Interní (jen pro test tohoto úkolu): `export function fillTemplate(html: string): string` v `scripts/render-ads.ts`.

**Ověřeno (zdroje):**
- `imageSizeFromFile` z `image-size/fromFile` (async), `imageSize(buffer)`: https://github.com/image-size/image-size (projekt se přesunul na Codeberg, API stejné)
- `page.screenshot({ path })`: https://playwright.dev/docs/api/class-page#page-screenshot

**Placeholdery v šablonách (nic z čísel se nepíše ručně):**

| Placeholder | Hodnota |
|---|---|
| `{{tokens}}` | `<style>:root{--paper:…;--ink:…;--signal:…;--muted:…;--rule:…}</style>` zkompilované ze `tokens.scss` přes `sass` |
| `{{<FUNDID>.ter}}` | `formatTer(getFund(id).ter.value)`, např. `{{SPYL.ter}}` → `0,03 %` |
| `{{<FUNDID>.isin}}` | `getFund(id).isin.value` |
| `{{sp500.twins}}` | tickery `twinsSortedByTer('sp500')` spojené ` · ` |
| `{{sp500.originals}}` | tickery `originalsOf('sp500')` spojené ` · ` |
| `{{brokers}}` | `getBrokers().map(b => b.name).join(' · ')` |
| `{{asOf}}` | `getData().asOf` ve formátu `11. 10. 2026` |

`fillTemplate` vyhodí chybu u neznámého placeholderu nebo neznámého fondu a pokud ve výsledku zůstane `{{`.

- [ ] **Step 1: Napiš failing test** – `tests/unit/ads.test.ts`

```ts
// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { imageSizeFromFile } from 'image-size/fromFile';
import { getFund } from '../../src/lib/pairs';
import { heroVariantFromUtm } from '../../src/lib/copy';

const SIZES = { '4x5': [1080, 1350], '9x16': [1080, 1920] } as const;

describe('ads', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'ads'], { stdio: 'inherit' });
  }, 180_000);

  for (const v of ['a', 'b'] as const)
    for (const [ratio, [w, h]] of Object.entries(SIZES))
      it(`ads/${v}-${ratio}.png is ${w}x${h}`, async () => {
        const d = await imageSizeFromFile(`ads/${v}-${ratio}.png`);
        expect([d.width, d.height]).toEqual([w, h]);
      });

  it('template B takes SPYL ISIN and TER from data, not hardcoded', async () => {
    const raw = readFileSync('ads/templates/b.html', 'utf8');
    const spyl = getFund('SPYL');
    expect(raw).not.toContain(spyl.isin.value);
    expect(raw).toContain('{{SPYL.isin}}');
    expect(raw).not.toMatch(/\d,\d{2}\s?%/); // žádné TER natvrdo
    const { fillTemplate } = await import('../../scripts/render-ads');
    const filled = fillTemplate(raw);
    expect(filled).toContain(spyl.isin.value);
    expect(filled).not.toContain('{{');
  });

  it('template A has no hardcoded TER or ISIN', () => {
    const raw = readFileSync('ads/templates/a.html', 'utf8');
    expect(raw).not.toMatch(/\d,\d{2}\s?%/);
    expect(raw).not.toMatch(/\b[A-Z]{2}[A-Z0-9]{9}\d\b/);
  });

  it('copy.md has exact texts from spec §9 and UTM matching hero variant', () => {
    const md = readFileSync('ads/copy.md', 'utf8');
    for (const s of [
      'Hledali jste u brokera VOO a nenašli ho? Není to chyba. Evropská pravidla brání brokerům prodávat americké ETF drobným investorům. Na stejný index S&P 500 ale existují evropské fondy. Podívejte se, které to jsou a co stojí.',
      'VOO u evropského brokera nekoupíte. Tady je náhrada.',
      'Více informací',
      'Máte účet u XTB, Trading 212, Fio nebo Degira a chcete investovat do S&P 500? Nemusíte hledat ve stovkách fondů. Pošleme vám přesný ISIN a postup pro vašeho brokera.',
      'S&P 500 u vašeho brokera: přesný ISIN a postup',
      'Získat návod',
    ]) expect(md).toContain(s);
    for (const m of md.matchAll(/utm_content=([a-z0-9-]+)/g))
      expect(heroVariantFromUtm(m[1])).toBe(m[1][0]);
  });
});
```

- [ ] **Step 2: Spusť – musí selhat**

```bash
npx vitest run tests/unit/ads.test.ts
```
Očekávaný výstup:
```
npm error Missing script: "ads"
FAIL tests/unit/ads.test.ts > ads
Error: Command failed: npm run ads
Test Files  1 failed (1)
```

- [ ] **Step 3: Šablony a sdílené CSS**

`ads/templates/ads.css` (společné pro A i B):
```css
@font-face { font-family: IxText; src: url('../../public/fonts/pdf/text-regular.ttf'); font-weight: 400; }
@font-face { font-family: IxText; src: url('../../public/fonts/pdf/text-bold.ttf'); font-weight: 700; }
@font-face { font-family: IxMono; src: url('../../public/fonts/pdf/mono-regular.ttf'); }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1080px; overflow: hidden; background: var(--paper); color: var(--ink); font-family: IxText, serif; }
html.size-4x5, html.size-4x5 body { height: 1350px; }
html.size-9x16, html.size-9x16 body { height: 1920px; }
.frame { height: 100%; padding: 96px 88px; display: flex; flex-direction: column; justify-content: center; gap: 56px; }
html.size-9x16 .frame { padding-top: 280px; padding-bottom: 420px; } /* volné pásy pro UI Stories/Reels – ověř náhledem v Ads Manageru */
.ticker, .isin { font-family: IxMono, monospace; font-variant-numeric: tabular-nums; }
.chip { display: inline-block; border: 4px solid var(--ink); padding: 12px 28px; font-size: 96px; }
.arrow { color: var(--signal); font-size: 96px; }
.rule { border-top: 4px solid var(--ink); }
.source { color: var(--muted); font-size: 28px; }
.brand { font-weight: 700; font-size: 40px; letter-spacing: 0.02em; }
```
Přesné velikosti doladí implementátor vizuálně; žádné přechody, stíny, ikony, loga.

`ads/templates/a.html` (Verze A – „Problém"):
```html
<!doctype html>
<html lang="cs"><head><meta charset="utf-8">
{{tokens}}
<link rel="stylesheet" href="ads.css">
<script>document.documentElement.className = 'size-' + (new URLSearchParams(location.search).get('size') || '4x5');</script>
</head><body><main class="frame">
  <p class="brand">Indexák</p>
  <div><span class="chip ticker">VOO</span><p class="note">u evropského brokera nedostupné</p></div>
  <p class="arrow">→</p>
  <p class="twins ticker">{{sp500.twins}}</p>
  <p class="claim">Stejný index S&amp;P 500. Evropský fond, který koupíte.</p>
  <p class="ters">TER: SPYL {{SPYL.ter}} · VUAA {{VUAA.ter}} · CSPX {{CSPX.ter}}</p>
  <p class="source">Zdroj: vydavatelé fondů, k {{asOf}}. Nejde o investiční doporučení.</p>
</main></body></html>
```

`ads/templates/b.html` (Verze B – „Praktický návod"):
```html
<!doctype html>
<html lang="cs"><head><meta charset="utf-8">
{{tokens}}
<link rel="stylesheet" href="ads.css">
<script>document.documentElement.className = 'size-' + (new URLSearchParams(location.search).get('size') || '4x5');</script>
</head><body><main class="frame">
  <p class="brand">Indexák</p>
  <div class="search" role="img" aria-label="Vyhledávání v aplikaci brokera">
    <span class="search-label">Hledat</span>
    <span class="isin">{{SPYL.isin}}</span>
  </div>
  <p class="hit"><span class="ticker">SPYL</span> · S&amp;P 500 · TER {{SPYL.ter}}</p>
  <div class="rule"></div>
  <p class="brokers">{{brokers}}</p>
  <p class="claim">Přesný ISIN a postup pro vašeho brokera.</p>
  <p class="source">Zdroj: State Street (SSGA), k {{asOf}}. Nejde o investiční doporučení.</p>
</main></body></html>
```
(„State Street (SSGA)" je vydavatel SPYL dle spec §6; pokud se v datech změní, vezmi doménu z `getFund('SPYL').ter.sourceUrl` přes nový placeholder `{{SPYL.source}}` = hostname.)

- [ ] **Step 4: Implementuj `scripts/render-ads.ts`**

```ts
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileString } from 'sass';
import { chromium } from '@playwright/test';
import { getData, getFund, twinsSortedByTer, originalsOf, getBrokers } from '../src/lib/pairs';
import { formatTer } from '../src/lib/format';

const ROOT = new URL('../', import.meta.url);
const TPL = new URL('ads/templates/', ROOT);
const SIZES = { '4x5': { width: 1080, height: 1350 }, '9x16': { width: 1080, height: 1920 } } as const;

function tokensStyle(): string {
  const css = compileString(
    '@use "tokens" as t; :root{--paper:#{t.$paper};--ink:#{t.$ink};--signal:#{t.$signal};--muted:#{t.$muted};--rule:#{t.$rule}}',
    { loadPaths: [fileURLToPath(new URL('src/styles/', ROOT))] },
  ).css;
  return `<style>${css}</style>`;
}
const dateCz = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d}. ${m}. ${y}`; };

/** Interní: nahradí placeholdery daty z etf-pairs.json / brokers.json. */
export function fillTemplate(html: string): string {
  const out = html.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    if (key === 'tokens') return tokensStyle();
    if (key === 'asOf') return dateCz(getData().asOf);
    if (key === 'brokers') return getBrokers().map((b) => b.name).join(' · ');
    if (key === 'sp500.twins') return twinsSortedByTer('sp500').map((f) => f.id).join(' · ');
    if (key === 'sp500.originals') return originalsOf('sp500').map((f) => f.id).join(' · ');
    const m = key.match(/^([A-Z0-9]+)\.(ter|isin|source)$/);
    if (m) {
      const f = getFund(m[1]); // vyhodí u neznámého fondu (Task 2)
      if (m[2] === 'ter') return formatTer(f.ter.value);
      if (m[2] === 'isin') return f.isin.value;
      return new URL(f.ter.sourceUrl).hostname.replace(/^www\./, '');
    }
    throw new Error(`Unknown placeholder {{${key}}}`);
  });
  if (out.includes('{{')) throw new Error('Unresolved placeholder');
  return out;
}

async function main() {
  const browser = await chromium.launch();
  try {
    for (const v of ['a', 'b'] as const) {
      const filledPath = fileURLToPath(new URL(`_${v}.filled.html`, TPL));
      writeFileSync(filledPath, fillTemplate(readFileSync(new URL(`${v}.html`, TPL), 'utf8')));
      for (const [ratio, viewport] of Object.entries(SIZES)) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
        await page.goto(`${pathToFileURL(filledPath).href}?size=${ratio}`);
        await page.evaluate(() => document.fonts.ready);
        const out = fileURLToPath(new URL(`ads/${v}-${ratio}.png`, ROOT));
        await page.screenshot({ path: out });
        await page.close();
        console.log(`render-ads: ${out}`);
      }
      rmSync(filledPath);
    }
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
```
`package.json`: `"ads": "tsx scripts/render-ads.ts"`; `npm i -D image-size`. Pokud chybí Chromium: `npx playwright install chromium`.

- [ ] **Step 5: `ads/copy.md` – texty přesně dle spec §9**

```markdown
# Reklamy Meta (Instagram + Facebook)

Kategorie kampaně: Financial products and services. Obě verze vedou na stejnou URL; `utm_content` přepíná nadpis a podnadpis hero (varianta podle prvního písmene).

## Verze A – „Problém"
- Kreativy: `a-4x5.png` (1080×1350), `a-9x16.png` (1080×1920)
- Primární text: Hledali jste u brokera VOO a nenašli ho? Není to chyba. Evropská pravidla brání brokerům prodávat americké ETF drobným investorům. Na stejný index S&P 500 ale existují evropské fondy. Podívejte se, které to jsou a co stojí.
- Titulek: VOO u evropského brokera nekoupíte. Tady je náhrada.
- Tlačítko: Více informací
- URL 4:5: `{SITE_URL}/?utm_source=meta&utm_medium=paid_social&utm_campaign=indexak_launch&utm_content=a-4x5`
- URL 9:16: `{SITE_URL}/?utm_source=meta&utm_medium=paid_social&utm_campaign=indexak_launch&utm_content=a-9x16`

## Verze B – „Praktický návod"
- Kreativy: `b-4x5.png`, `b-9x16.png`
- Primární text: Máte účet u XTB, Trading 212, Fio nebo Degira a chcete investovat do S&P 500? Nemusíte hledat ve stovkách fondů. Pošleme vám přesný ISIN a postup pro vašeho brokera.
- Titulek: S&P 500 u vašeho brokera: přesný ISIN a postup
- Tlačítko: Získat návod
- URL 4:5: `{SITE_URL}/?utm_source=meta&utm_medium=paid_social&utm_campaign=indexak_launch&utm_content=b-4x5`
- URL 9:16: `{SITE_URL}/?utm_source=meta&utm_medium=paid_social&utm_campaign=indexak_launch&utm_content=b-9x16`

Čísla a ISIN na kreativách se berou ze `src/data/etf-pairs.json` (`npm run ads`). Po každé aktualizaci dat kreativy znovu vyrenderujte. Žádné sliby výnosů; provozovatel je uveden v profilu stránky na Meta.
```

- [ ] **Step 6: Spusť – musí projít**

```bash
npx vitest run tests/unit/ads.test.ts
```
Očekávaný výstup:
```
render-ads: /…/ads/a-4x5.png
render-ads: /…/ads/a-9x16.png
render-ads: /…/ads/b-4x5.png
render-ads: /…/ads/b-9x16.png
✓ tests/unit/ads.test.ts (8 tests)
Test Files  1 passed (1)
```
Prohlédni všechny 4 PNG: text se nevejde přes okraj, v 9:16 je horní a dolní pás bez textu, diakritika v pořádku, tickery v mono písmu.

- [ ] **Step 7: Commit**

```bash
git add ads/templates/a.html ads/templates/b.html ads/templates/ads.css ads/copy.md ads/*.png scripts/render-ads.ts tests/unit/ads.test.ts package.json package-lock.json .gitignore
git commit -m "feat: add A/B ad creatives rendered from fund data"
```

---

### Task 15: Bezpečnost, nasazení, výkon, E2E na produkci

**Files:**
- Create: `vercel.json`
- Create: `docs/brevo-setup.md` (nastavení Brevo, ruční test DOI, sekce „Produkční prostředí")
- Create: `tests/unit/csp.test.ts`
- Create: `tests/e2e/production.spec.ts`
- Create: `docs/lighthouse-mobile.json` (výstup Lighthouse)
- Modify (jen pokud chybí): `playwright.config.ts` – při nastaveném `BASE_URL` nespouštět `webServer`

**Interfaces:**
- Consumes: celý build (Task 1–14), env proměnné z `.env.example`, `EventName` (Shared Contracts), `/api/subscribe` odpovědi z Task 6.
- Produces: `vercel.json` (CSP a hlavičky), nasazení na Vercel, `docs/lighthouse-mobile.json`, E2E proti `BASE_URL`, `docs/brevo-setup.md` (odkazuje na něj README v Task 16).

**Rozhodnutí: jak řešit hashe inline skriptů**

Ověřeno:
- Astro má `experimental.csp` od `astro@5.9.0`, v Astro 6 stabilní jako `security.csp`. Politiku vkládá jako `<meta http-equiv="content-security-policy">`, hashuje jen své zpracované skripty a styly, nepodporuje `dev`, `<ClientRouter />` ani Shiki: https://v5.docs.astro.build/en/reference/experimental-flags/csp/ , https://docs.astro.build/en/reference/experimental-flags/csp/
- Jako HTTP hlavičku ji umí zapsat až `@astrojs/vercel` s `experimentalStaticHeaders` (od 8.2.0; v novějších verzích `staticHeaders`): https://v5.docs.astro.build/en/guides/integrations-guide/vercel/ , https://docs.astro.build/en/guides/integrations-guide/vercel/
- `frame-ancestors` v `<meta>` CSP prohlížeče ignorují, takže čistě meta varianta nesplní požadavek `frame-ancestors 'none'`.

**Rozhodnutí:** CSP je ručně ve `vercel.json` (jak říká spec §10), bez experimentálního příznaku. Hashe inline skriptů (ostrůvky `astro-island`, `is:inline` skripty, malé skripty, které Astro vloží přímo) se **nepíšou odhadem**: test `tests/unit/csp.test.ts` po buildu spočítá SHA-256 každého inline `<script>` ve výstupním HTML a selže, pokud hash ve `vercel.json` chybí nebo přebývá; v chybové hlášce vypíše přesné hodnoty k doplnění. Po upgradu Astra nebo změně inline skriptu tak CI selže dřív, než se rozbije produkce. Kdyby Vercel hlavičky z `vercel.json` u výstupu Astro adaptéru nepoužil (ověří Step 10 přes `curl`), přejde se na `experimental.csp` + `experimentalStaticHeaders` a `vercel.json` zůstane jen pro ostatní hlavičky.

**Doplňky proti zadání (zdůvodnění):**
- `style-src 'self' 'unsafe-inline'`: Astro vkládá `<style>` (např. `astro-island{display:contents}`) a React používá atributy `style=…`, které hashe bez `'unsafe-hashes'` nepokryjí. Bez `style-src` by platil `default-src 'self'` a styly by se rozbily.
- GA4: Google pro Analytics bez Ads funkcí uvádí `img-src https://www.googletagmanager.com https://*.google-analytics.com` a `connect-src https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com` (EU provoz chodí na `region1.google-analytics.com`): https://developers.google.com/tag-platform/security/guides/csp . Proto je místo `https://www.google-analytics.com` použit `https://*.google-analytics.com` a přidán `https://*.analytics.google.com`.
- PostHog doporučuje `https://*.posthog.com`, konkrétní hosty „not recommended": https://posthog.com/docs/advanced/content-security-policy . Zůstávají EU hosty ze zadání. Pokud E2E (Step 9) zachytí porušení CSP z PostHogu, nahradí se `https://*.posthog.com`.
- Navíc: `font-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` (formulář bez JS posílá jen na `/api/subscribe`), `frame-src 'none'`, `upgrade-insecure-requests`.

- [ ] **Step 1: Napiš failing test CSP** – `tests/unit/csp.test.ts`

```ts
// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const OUT_DIRS = ['.vercel/output/static', 'dist/client', 'dist'];
const listHtml = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listHtml(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : []);

type Header = { key: string; value: string };
const headersFor = (source: string): Header[] => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  return cfg.headers.find((h: { source: string }) => h.source === source)?.headers ?? [];
};
const csp = () => headersFor('/(.*)').find((h) => h.key === 'Content-Security-Policy')?.value ?? '';
const directive = (name: string) =>
  csp().split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) ?? '';

describe('vercel.json security headers', () => {
  let html: string[] = [];
  beforeAll(() => {
    if (!process.env.SKIP_BUILD) execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
    const dir = OUT_DIRS.find((d) => existsSync(d));
    if (!dir) throw new Error('build output not found');
    html = listHtml(dir);
  }, 300_000);

  it('has required static headers', () => {
    const h = Object.fromEntries(headersFor('/(.*)').map((x) => [x.key, x.value]));
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Permissions-Policy']).toContain('camera=()');
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive('script-src')).toContain('https://eu-assets.i.posthog.com');
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
    expect(directive('connect-src')).toContain('https://eu.i.posthog.com');
  });

  it('hashes every inline script, and nothing else', () => {
    const needed = new Set<string>();
    for (const file of html) {
      const src = readFileSync(file, 'utf8');
      expect(src, `${file} has inline event handler`).not.toMatch(/<[^>]+\son[a-z]+=/i);
      for (const m of src.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (/type=["']?application\/(ld\+)?json/i.test(m[1])) continue;
        needed.add(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
      }
    }
    const present = new Set(directive('script-src').match(/'sha256-[^']+'/g) ?? []);
    const missing = [...needed].filter((x) => !present.has(x));
    const extra = [...present].filter((x) => !needed.has(x));
    expect(missing, `add to script-src: ${missing.join(' ')}`).toEqual([]);
    expect(extra, `remove from script-src: ${extra.join(' ')}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Spusť – musí selhat**

```bash
npx vitest run tests/unit/csp.test.ts
```
Očekávaný výstup:
```
FAIL tests/unit/csp.test.ts > vercel.json security headers > has required static headers
Error: ENOENT: no such file or directory, open 'vercel.json'
Test Files  1 failed (1)
```

- [ ] **Step 3: Vytvoř `vercel.json`**

Syntaxe `headers` (`source`, `headers: [{ key, value }]`) a `$schema`: https://vercel.com/docs/project-configuration/vercel-json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' __HASHES__ https://eu-assets.i.posthog.com https://connect.facebook.net https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.facebook.com https://*.google-analytics.com https://www.googletagmanager.com; font-src 'self'; connect-src 'self' https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" }
      ]
    }
  ]
}
```

- [ ] **Step 4: Doplň hashe z testu**

```bash
npx vitest run tests/unit/csp.test.ts
```
Očekávaný výstup (test selže a vypíše hodnoty):
```
FAIL … > hashes every inline script, and nothing else
AssertionError: add to script-src: 'sha256-…' 'sha256-…' …
```
Nahraď `__HASHES__` přesně vypsanými hodnotami (oddělené mezerou). Pokud test hlásí inline event handler (`onclick=` apod.), přepiš ho v příslušné komponentě na `addEventListener` (jde o chybu jiného úkolu – oprav minimálně a zmiň v commitu).

- [ ] **Step 5: Spusť – musí projít**

```bash
SKIP_BUILD=1 npx vitest run tests/unit/csp.test.ts
```
Očekávaný výstup: `✓ tests/unit/csp.test.ts (2 tests)` · `Test Files  1 passed (1)`.

Lokální kontrola v prohlížeči: `npm run build && npx astro preview` hlavičky z `vercel.json` neaplikuje, takže CSP se v praxi ověří až na Vercelu (Step 9–10).

- [ ] **Step 6: E2E pro produkci** – `tests/e2e/production.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test.describe('production smoke', () => {
  test('security headers are served', async ({ request }) => {
    const r = await request.get('/');
    expect(r.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(r.headers()['x-content-type-options']).toBe('nosniff');
    expect(r.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('no CSP violations with all consents accepted', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__csp = [];
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await page.goto('/?utm_content=a-4x5');
    await page.getByRole('button', { name: 'Přijmout' }).click();
    await page.waitForLoadState('networkidle');
    await page.reload(); // načtení analytiky se souhlasem
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
  });

  test('guide PDF is served', async ({ request }) => {
    const r = await request.get('/navod-etf.pdf');
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toContain('application/pdf');
  });

  test('thank-you pages are noindex', async ({ page }) => {
    for (const p of ['/dekujeme', '/potvrzeno']) {
      await page.goto(p);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    }
  });

  test('API rejects invalid e-mail without touching Brevo', async ({ request, baseURL }) => {
    const r = await request.post('/api/subscribe', {
      headers: { origin: baseURL! }, data: { email: 'neni-email', aid: 'e2e', consent_marketing: '0' },
    });
    expect(await r.json()).toMatchObject({ ok: false, error: 'invalid_email' });
  });

  test('API honeypot returns silent success', async ({ request, baseURL }) => {
    const r = await request.post('/api/subscribe', {
      headers: { origin: baseURL! },
      data: { email: 'honeypot@example.com', aid: 'e2e', website: 'bot', consent_marketing: '0' },
    });
    expect(await r.json()).toMatchObject({ ok: true });
  });
});

// Review Focus 1: formulář bez JavaScriptu (nativní POST x-www-form-urlencoded → 303)
test.describe('production without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('hero form is a working native form above the fold', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const form = page.locator('form#form');
    await expect(form).toHaveAttribute('method', /post/i);
    await expect(form).toHaveAttribute('action', '/api/subscribe');
    const box = await form.getByRole('button', { name: 'Pošlete mi návod' }).boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });

  test('form-encoded POST: honeypot → 303 /dekujeme?aid=…, invalid → 303 /?error=…#form', async ({ request, baseURL }) => {
    const post = (form: Record<string, string>) =>
      request.post('/api/subscribe', { headers: { origin: baseURL! }, form, maxRedirects: 0 });
    const ok = await post({ email: 'honeypot@example.com', website: 'bot', consent_marketing: '0' });
    expect(ok.status()).toBe(303);
    expect(ok.headers()['location']).toMatch(/\/dekujeme\?aid=[\w-]+/); // aid vygeneroval server
    const bad = await post({ email: 'neni-email', consent_marketing: '0' });
    expect(bad.status()).toBe(303);
    expect(bad.headers()['location']).toMatch(/\/\?error=[\w_]+#form$/);
  });
});
```
(Skutečné odeslání bez JS s ostrým e-mailem se ověřuje jen ručně v checklistu `docs/brevo-setup.md` bod 8 – E2E nevolá ostré Brevo.)
Název tlačítka „Přijmout" odpovídá spec §8.2 (Task 5). Ověř, že ostatní E2E specy, které odesílají formulář, mají `page.route('**/api/subscribe', …)` / `page.route('**/api/profile', …)` mock (spec §12: E2E nevolá ostré Brevo):
```bash
grep -L "route('\*\*/api/" $(grep -l "api/subscribe\|Pošlete mi návod" tests/e2e/*.spec.ts)
```
Očekávaný výstup: prázdný (každý spec, který odesílá, má mock); `production.spec.ts` posílá jen požadavky, které Brevo nevolají. Pokud `playwright.config.ts` při `BASE_URL` stále spouští `webServer`, uprav: `webServer: process.env.BASE_URL ? undefined : { … }`, `use.baseURL: process.env.BASE_URL ?? 'http://localhost:4321'`.

- [ ] **Step 7: Vytvoř `docs/brevo-setup.md` a commitni a pushni**

Obsah `docs/brevo-setup.md` (česky) – sekce v tomto pořadí:
1. **Účet a odesílatel** – registrace, Senders, Domains & Dedicated IPs: ověřená doména (SPF, DKIM, DMARC); bezplatný tarif má limit 300 e-mailů denně (spec §16).
2. **API klíč** – SMTP & API → API keys → nový klíč → `BREVO_API_KEY`. Pokud je v účtu zapnuté omezení API na povolené IP adresy, vypnout (Vercel Functions nemají pevnou IP).
3. **Seznam** – Contacts → Lists → „Indexák – návod" → ID → `BREVO_LIST_ID`.
4. **Atributy kontaktu** – Settings → Contacts → Contact attributes → Normal Attributes → přidat (názvy: písmena, číslice a podtržítka, max. 50 znaků). Zdroj: https://help.brevo.com/hc/en-us/articles/10617359589906-Create-and-manage-contact-attributes . Tabulka:

| Atribut | Typ | Plní |
|---|---|---|
| `AID` | Text | subscribe, profile |
| `PAIR` | Text | subscribe |
| `CALC_DEPOSIT` | Number | subscribe |
| `CALC_HORIZON` | Number | subscribe |
| `PLACEMENT` | Text | subscribe |
| `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `UTM_CONTENT` | Text | subscribe |
| `CONSENT_TEXT_VERSION` | Text | subscribe, profile |
| `CONSENT_AT` | Text (ISO 8601) | subscribe, profile |
| `BROKER` | Text | profile |
| `CONSENT_CALL`, `CONSENT_PARTNERS` | Boolean | profile |
| `SMS` | vestavěný | profile (`+420…`) |

   **Platí názvy v kódu.** Před vyplněním: `grep -nE "[A-Z_]{3,}:" src/server/brevo.ts src/pages/api/*.ts` a tabulku srovnej 1:1 (Brevo odmítne atribut, který v účtu neexistuje).
5. **DOI šablona** – Marketing → Templates → Create Template → Email. Předmět „Potvrďte a návod je váš", odesílatel z bodu 1. Obsah: krátký text, text souhlasu ve stejném znění jako pod formulářem (verze `CONSENT_TEXT_VERSION`), **jedno tlačítko s odkazem `{{ params.DOIurl }}`**, patička s provozovatelem (`OPERATOR`). Bez reklamy a bez personalizace atributy. Šablonu aktivovat; ID → `BREVO_DOI_TEMPLATE_ID`. Zdroje: API `POST /v3/contacts/doubleOptinConfirmation` vyžaduje `email`, `includeListIds`, `templateId`, `redirectionUrl`; šablona musí obsahovat `{{ params.DOIurl }}` – https://developers.brevo.com/reference/createdoicontact ; postup šablony – https://help.brevo.com/hc/en-us/articles/360019540880-Create-a-double-opt-in-DOI-confirmation-template-for-Brevo-form
6. **E-mail s návodem** – šablona „Váš návod: S&P 500 u vašeho brokera" s tlačítkem na `{SITE_URL}/navod-etf.pdf`, patička s provozovatelem a odkazem na odhlášení.
7. **Automatizace** – Automations → nová → spouštěč **„Contact added to list"** (seznam z bodu 3) → akce **„Send an email"** (šablona z bodu 6) → aktivovat. Zdroj: https://help.brevo.com/hc/en-us/articles/15445989568402 . Kontrola: `/api/profile` **nesmí** přidávat kontakt do seznamu (jinak by návod dostal i nepotvrzený kontakt) – `grep -n "listIds" src/server/brevo.ts` ukáže `listIds` jen u `createDoiContact`.
8. **Ruční test DOI (Gmail a Seznam)** – checklist (vyplní člověk, datum a výsledek ke každému řádku):
   - [ ] Mobil, `{SITE_URL}/?utm_content=a-4x5`, odeslat e-mail `…@gmail.com` → `/dekujeme?aid=…` do 2 s.
   - [ ] Tlačítko „Otevřít Gmail" otevře Gmail.
   - [ ] Potvrzovací e-mail dorazí do 5 min; složka (Primární / Promo akce / Spam) zapsána; předmět „Potvrďte a návod je váš".
   - [ ] Tlačítko v e-mailu → `/potvrzeno?aid=<stejné aid>`, PDF se stáhne a otevře.
   - [ ] E-mail s návodem z automatizace dorazí; odkaz na PDF funguje.
   - [ ] Brevo: kontakt v seznamu, atributy `AID`, `PLACEMENT`, `UTM_CONTENT`, `CONSENT_TEXT_VERSION` vyplněné.
   - [ ] Totéž pro `…@seznam.cz` (tlačítko „Otevřít Seznam Email", složky Hlavní / Hromadné / Spam).
   - [ ] Druhé odeslání stejného e-mailu → úspěch, žádná chyba (duplicita).
   - [ ] `/dekujeme`: výběr brokera + telefon se souhlasem (a) bez (b) → v Brevu `BROKER`, `SMS`, `CONSENT_CALL=true`, `CONSENT_PARTNERS=false`.
   - [ ] PostHog: události `form_submitted`, `thankyou_viewed`, `doi_confirmed`, `pdf_downloaded`; se souhlasem i `aid`.
   - [ ] Meta Events Manager → Test events (s `META_TEST_EVENT_CODE`): `Lead` z Pixelu i ze serveru, deduplikovaný přes `event_id`.
9. **Produkční prostředí** – vyplní Task 15 Step 13: produkční URL, odkaz na PostHog dashboard, datum a výsledek Lighthouse.

```bash
npx vitest run && git add vercel.json docs/brevo-setup.md tests/unit/csp.test.ts tests/e2e/production.spec.ts playwright.config.ts
git commit -m "chore: add security headers, CSP hash check and production smoke tests"
git push origin main
```

- [ ] **Step 8: [ČLOVĚK] Služby třetích stran – založ a předej hodnoty**

Předej implementátorovi (nebo rovnou vlož do Vercelu ve Step 9) tyto hodnoty:

| Služba | Co udělat | Předá |
|---|---|---|
| **Brevo** | vše podle `docs/brevo-setup.md` body 1–7 | `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_DOI_TEMPLATE_ID` |
| **Upstash** | console.upstash.com → Redis → **+ Create Database**, název `indexak-ratelimit`, primární region Frankfurt (`eu-central-1`), free plán; v detailu databáze sekce REST API zkopírovat URL a token. Zdroj: https://upstash.com/docs/redis/overall/getstarted | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **PostHog** | registrace na **EU cloud** (eu.posthog.com), projekt „Indexák"; Settings → Project → **zapnout cookieless mode** („Cookieless mode must also be enabled in your PostHog project settings, otherwise cookieless events are ignored" – https://posthog.com/docs/libraries/js/config); podepsat DPA; zkopírovat Project API key | `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com` |
| **Meta** | Business Manager → Events Manager → Connect data sources → Web → nový Pixel „Indexák"; v nastavení Pixelu vygenerovat token pro Conversions API; v záložce Test events zkopírovat test code; ověřit doménu (po Step 9) | `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE` (jen pro test, před spuštěním kampaně smazat) |
| **GA4** | analytics.google.com → nová služba → webový datový stream na produkční URL | `PUBLIC_GA4_ID` (`G-…`) |

- [ ] **Step 9: [ČLOVĚK] Vercel – import repa, env proměnné, nasazení**

1. vercel.com → přihlásit se přes GitHub → **Add New… → Project** → **Import** `JirkaZednik/landing-page-etf` (pokud repo není vidět: „Adjust GitHub App Permissions" a povolit repo).
2. Framework Preset: **Astro** (detekce automatická), Build Command `npm run build` (spustí i `prebuild` = PDF), Output: výchozí (adaptér `@astrojs/vercel`). Zdroj: https://docs.astro.build/en/guides/deploy/vercel/
3. **Environment Variables** (Production i Preview): všechny proměnné z `.env.example` z tabulky ve Step 8. Secrets (`BREVO_API_KEY`, `META_CAPI_TOKEN`, `UPSTASH_REDIS_REST_TOKEN`) jako typ **Secret**. `SITE_URL` zatím `https://<projekt>.vercel.app`. Zdroj: https://vercel.com/docs/environment-variables
4. **Deploy.** Po nasazení zkontrolovat produkční URL; pokud se liší od `SITE_URL`, opravit a **Redeploy** („Any change you make to environment variables are not applied to previous deployments, they only apply to new deployments." – tamtéž).
5. Volitelně Settings → Functions → region Frankfurt (`fra1`), pokud ho tarif nabízí (blíž k Upstash a k návštěvníkům).
6. **Tarif:** Hobby stačí pro hodnocení zadání. Ostrá kampaň musí běžet na Pro/Enterprise účtu Clientela: „Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan." a za komerční se považuje mj. „Advertising the sale of a product or service" – https://vercel.com/docs/limits/fair-use-guidelines
7. Předá: **produkční URL** (`BASE_URL`).

Pozn.: Produkční nasazení je na Hobby veřejné; náhledová nasazení jsou chráněná. Pro E2E na náhledu použij hlavičku `x-vercel-protection-bypass` s `VERCEL_AUTOMATION_BYPASS_SECRET`: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation . Na náhledech může CSP blokovat Vercel Toolbar (`vercel.live`) – očekávané, na produkci se nenačítá.

- [ ] **Step 10: Ověř hlavičky na produkci**

```bash
export BASE_URL=https://<projekt>.vercel.app
curl -sI "$BASE_URL/" | grep -iE '^(content-security-policy|referrer-policy|x-content-type-options|permissions-policy|x-frame-options):'
```
Očekávaný výstup: 5 řádků s hodnotami z `vercel.json`. Pokud `content-security-policy` chybí (Vercel u výstupu adaptéru nepoužil `vercel.json` hlavičky): přepni na `experimental.csp` (Astro ≥ 5.9) + `vercel({ experimentalStaticHeaders: true })`, přenes direktivy a domény z `vercel.json` do `experimental.csp.directives` / `scriptDirective.resources`, CSP z `vercel.json` odeber, uprav `tests/unit/csp.test.ts` tak, aby kontroloval `.vercel/output/config.json`, a zopakuj tento krok.

- [ ] **Step 11: E2E proti produkci**

```bash
BASE_URL=$BASE_URL npm run test:e2e
```
Očekávaný výstup: všechny specy zelené, mj. `✓ production smoke › no CSP violations with all consents accepted`. Při porušení CSP: doplň chybějící doménu do příslušné direktivy (u PostHogu `https://*.posthog.com`, viz rozhodnutí výše), commit, push, opakuj.

Pak **[ČLOVĚK]** projde ruční checklist v `docs/brevo-setup.md` bod 8 (Gmail, Seznam, Brevo, PostHog, Meta Test events) na reálném iOS Safari a Android Chrome a výsledky zapíše do souboru.

- [ ] **Step 12: Lighthouse mobile**

Lighthouse CLI (https://github.com/GoogleChrome/lighthouse/blob/main/readme.md): `--form-factor` má volby `mobile`/`desktop`, `--preset` volby `perf`, `experimental`, `desktop`; výchozí konfigurace je mobilní („typical mobile user on a 4G connection and a mid-tier ~$200 phone"). Proto **bez `--preset`** (preset `desktop` by měřil desktop, `perf` by vynechal přístupnost a SEO) a s explicitním `--form-factor=mobile`.

```bash
export CHROME_PATH=$(node -e "console.log(require('@playwright/test').chromium.executablePath())")
for i in 1 2 3; do
  npx --yes lighthouse "$BASE_URL/?utm_content=a-4x5" \
    --form-factor=mobile \
    --only-categories=performance,accessibility,best-practices,seo \
    --output=json --output-path=/tmp/lh-$i.json \
    --chrome-flags="--headless=new --no-sandbox" --quiet
done
# medián podle LCP uložit jako výsledek
best=$(for i in 1 2 3; do echo "$(jq '.audits["largest-contentful-paint"].numericValue' /tmp/lh-$i.json) $i"; done | sort -n | sed -n 2p | cut -d' ' -f2)
cp /tmp/lh-$best.json docs/lighthouse-mobile.json
jq '{lighthouseVersion, lcp_ms: .audits["largest-contentful-paint"].numericValue, cls: .audits["cumulative-layout-shift"].numericValue, perf: .categories.performance.score, a11y: .categories.accessibility.score}' docs/lighthouse-mobile.json
jq -e '.audits["largest-contentful-paint"].numericValue < 1500 and .audits["cumulative-layout-shift"].numericValue < 0.1' docs/lighthouse-mobile.json
```
Očekávaný výstup:
```json
{ "lighthouseVersion": "…", "lcp_ms": 1234.5, "cls": 0.01, "perf": 0.98, "a11y": 1 }
true
```
(`lcp_ms` < 1500, `cls` < 0.1; poslední příkaz vrátí `true` a exit code 0.) Pozor: Lighthouse simuluje pomalé 4G, takže je přísnější než běžné 4G. Pokud `jq -e` vrátí `false`: neupravuj čísla. Projdi audity `render-blocking-resources`, `largest-contentful-paint-element`, `font-display`, `unused-javascript`, oprav (preload fontu hero, menší JS ostrůvků, `client:visible` pod ohybem), nasaď a změř znovu. Výsledek (i nesplněný) se uvede v README.

- [ ] **Step 13: [ČLOVĚK] PostHog funnel a dashboard dle spec §8.4**

V PostHog EU (https://posthog.com/docs/product-analytics/funnels): Product Analytics → **+ New Insight → Funnel**:
1. **„Konverze podle varianty"** – kroky `page_view` → `form_viewed` → `form_started` → `form_submitted`, pořadí Sequential, okno 1 den, **breakdown** `hero_variant` (druhá kopie s breakdown `utm_content`). Uložit.
2. **„Konverze podle umístění"** – Trends: `form_submitted`, breakdown `placement`; a funnel `form_viewed` → `form_submitted` s breakdown `placement` (hero vs. níže).
3. **„Po odeslání"** – funnel `form_submitted` → `thankyou_viewed` → `broker_selected` → `phone_submitted` (měřitelné napříč stránkami jen u návštěvníků se souhlasem; bez souhlasu porovnávat agregované počty). Trends `doi_confirmed`, `pdf_downloaded` (počet potvrzení brát z Brevo, `doi_confirmed` může být nadhodnocené skenery pošty – spec §8.1).
4. Vše přidat na dashboard **„Indexák – konverze"**. Hlavní KPI = `form_submitted` / unikátní návštěvníci (`page_view`, unikátní) podle `hero_variant`.

Předá: URL dashboardu (sdílený odkaz, pokud ho tarif umožní).

Zapiš do `docs/brevo-setup.md` § 9 „Produkční prostředí": produkční URL, URL PostHog dashboardu, datum měření, `lcp_ms`, `cls`, skóre výkonu a přístupnosti z `docs/lighthouse-mobile.json`, výsledek ručního DOI testu.

- [ ] **Step 14: Commit**

```bash
git add docs/lighthouse-mobile.json docs/brevo-setup.md vercel.json
git commit -m "chore: record production deploy, Lighthouse mobile report and DOI test results"
git push origin main
```

---

### Task 16: README

**Files:**
- Create: `README.md`
- Test: `tests/unit/readme.test.ts`

**Interfaces:**
- Consumes: spec §0–§17; `ads/copy.md`, `ads/*.png` (Task 14); `docs/brevo-setup.md` § 9, `docs/lighthouse-mobile.json` (Task 15); `OPERATOR` (Task 1, k odsouhlasení); `COMPARISON_TER`, `MODEL_RETURN`, `LIMITS` (Task 4) – čísla v README musí sedět s kódem.
- Produces: `README.md` (obsah dle spec §15 + produkční URL + PostHog dashboard + odkaz na `docs/brevo-setup.md`).

**Výpočet vzorku pro A/B (do README):**

Dvouvýběrový test podílů, oboustranný, α = 0,05 (z = 1,960), síla 0,8 (z = 0,842):

n na variantu = ( z₁₋α/₂ · √(2·p̄·(1−p̄)) + z₁₋β · √(p₁(1−p₁) + p₂(1−p₂)) )² / (p₂ − p₁)²

- Baseline p₁ = 4 %, relativní zlepšení 20 % → p₂ = 4,8 %, p̄ = 4,4 %:
  (1,960 · √(2 · 0,044 · 0,956) + 0,842 · √(0,04 · 0,96 + 0,048 · 0,952))² / 0,008² = (0,5685 + 0,2441)² / 0,000064 ≈ **10 317 návštěvníků na variantu** (≈ 20 634 celkem).
- Pro srovnání (stejný vzorec): +30 % (4 → 5,2 %) ≈ 4 783 na variantu; +50 % (4 → 6 %) ≈ 1 863 na variantu.
- Při ~1 000 návštěvách na variantu je nejmenší spolehlivě zjistitelný efekt ≈ +71 % relativně (4 → 6,8 %). Proto „první vyhodnocení po ~1 000 návštěvách" (spec §13) slouží ke kontrole, že trychtýř funguje a odhady nejsou úplně mimo, ne k vyhlášení vítěze A/B testu.
- H3 (metrika „použitelné kontakty" = potvrzené nebo s telefonem, jako podíl odeslání; baseline ≈ 60 %, cíl 66 %): ≈ 1 015 odeslání na variantu ≈ 25 400 návštěv na variantu při konverzi 4 %.

- [ ] **Step 1: Napiš failing test** – `tests/unit/readme.test.ts`

```ts
// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPARISON_TER, MODEL_RETURN } from '../../src/lib/calc';

const REQUIRED_HEADINGS = [
  '## Výklad zadání',
  '## Cílová skupina',
  '## Nabídka a moment žádosti o kontakt',
  '## Pořadí sekcí a proč',
  '## Cesta od každého prvku ke kontaktu',
  '## Klíčová rozhodnutí',
  '## Reklamy A/B',
  '## Očekávaná konverze',
  '## A/B hypotézy',
  '## Měření',
  '## Zdroje dat',
  '## Měsíční aktualizace dat',
  '## Checklist před spuštěním reklamy',
  '## Produkční nasazení',
  '## Lokální spuštění a testy',
];

describe('README', () => {
  const md = existsSync('README.md') ? readFileSync('README.md', 'utf8') : '';

  it('has all required headings in order', () => {
    let pos = -1;
    for (const h of REQUIRED_HEADINGS) {
      const i = md.indexOf(`\n${h}\n`);
      expect(i, `missing or out of order: ${h}`).toBeGreaterThan(pos);
      pos = i;
    }
  });

  it('starts with the interpretation of the brief', () => {
    expect(md.split('\n## ')[1]).toMatch(/^Výklad zadání\n+.*PRIIPs/s);
  });

  it('links existing ad PNGs and docs', () => {
    for (const f of ['ads/a-4x5.png', 'ads/a-9x16.png', 'ads/b-4x5.png', 'ads/b-9x16.png', 'docs/brevo-setup.md', 'docs/lighthouse-mobile.json']) {
      expect(md).toContain(`(${f})`);
      expect(existsSync(f), f).toBe(true);
    }
  });

  it('contains sample size result and formula', () => {
    expect(md).toContain('10 317');
    expect(md).toMatch(/α\s*=\s*0,05/);
    expect(md).toContain('(p₂ − p₁)²');
  });

  it('states numbers consistent with calc.ts', () => {
    const cz = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 });
    expect(md).toContain(`${cz(MODEL_RETURN * 100)} % p.a.`); // 0.07*100 = 7.000000000000001 → „7"
    expect(md).toContain(`${cz(COMPARISON_TER)} % p.a.`);     // „1,5"
  });

  it('marks conversion as an estimate and has launch status', () => {
    expect(md).toMatch(/odhad/i);
    expect(md).toContain('1 000 návštěv');
    expect(md).toMatch(/Stav: připraveno, blokuje:/);
  });
});
```

- [ ] **Step 2: Spusť – musí selhat**

```bash
npx vitest run tests/unit/readme.test.ts
```
Očekávaný výstup:
```
FAIL tests/unit/readme.test.ts > README > has all required headings in order
AssertionError: missing or out of order: ## Výklad zadání: expected -1 to be greater than -1
Test Files  1 failed (1)
```

- [ ] **Step 3: Napiš `README.md` – přesná osnova a obsah**

Tón: věcný, česky, vykání tam, kde se mluví k návštěvníkovi; k hodnotiteli v 1. osobě množného čísla („srovnáváme", „čekáme"). Žádné superlativy. Čísla z dat se uvádějí s datem ověření.

```markdown
# Indexák – „Najdi evropské dvojče"

Konverzní landing page pro zadání B (Clientelo): srovnání ETF z NYSE pro českého drobného investora. Výstup: stránka, PDF návod jako lead magnet, 2 reklamy, měření.

## Výklad zadání
```
Odstavec doslova ze spec §0 „Výklad zadání" („Srovnáváme ETF obchodované na NYSE (Arca). Protože je český drobný investor u evropského brokera kvůli nařízení PRIIPs koupit nemůže, ke každému ukazujeme dostupný evropský ekvivalent. Bez toho by srovnání nemělo použitelný výstup. Originály z NYSE jsou na stránce vždy vidět vedle dvojčat (TER, burza, zdroj).") + věta: „Stránka běží pod fiktivní spotřebitelskou značkou Indexák; provozovatelem a správcem údajů je navržen Clientelo Czech s.r.o. (údaje převzaté z clientelo.cz, k odsouhlasení – viz checklist)."

Další sekce (každá `## ` přesně jako v testu):

1. **`## Cílová skupina`** – spec §1: primární skupina (3 věty), bolest, co přesvědčí, co odradí (odrážky).
2. **`## Nabídka a moment žádosti o kontakt`** – zdarma bez kontaktu / za e-mail (PDF: obsah 3 odrážky dle §2) / proč právě návod ke koupi u brokera („jediná hodnota, kterou stránka zdarma nedává") / hlavní moment žádosti na první obrazovce bez interakce navíc + další místa / co se děje po odeslání (zkráceně §7.3: `/dekujeme` s výběrem brokera a nepovinným telefonem → potvrzovací e-mail → `/potvrzeno` se stažením PDF → e-mail s návodem).
3. **`## Pořadí sekcí a proč`** – tabulka sekcí ze spec §4 (#, sekce, otázka návštěvníka) + odstavec „Zdůvodnění pořadí" doslova ze spec §4 + rozpočet první obrazovky 390×844 a jak se ověřuje (E2E test „formulář v hero je nad ohybem").
4. **`## Cesta od každého prvku ke kontaktu`** – tabulka ze spec §4 (prvek, cesta, událost) beze změn.
5. **`## Klíčová rozhodnutí`** – podsekce `###`, každá 2–5 vět se zdrojem:
   - `### PRIIPs: proč VOO u evropského brokera nekoupíte` – KID od 2018, američtí vydavatelé ho nevydávají; výjimky: stávající držitelé mohou držet a prodat, nové nákupy jen profesionální klienti. Zdroje: ESMA, justETF, LYNX (URL z `etf-pairs.json` / spec §6).
   - `### Lead magnet = návod ke koupi u vašeho brokera`
   - `### Formulář na první obrazovce` – odkaz na tabulku cest ke kontaktu.
   - `### Kalkulačka srovnává dvojčata mezi sebou` – model R = 7 % p.a. (ilustrativní), srovnávací řádek „fond s poplatkem 1,5 % p.a. (příklad)"; proč ne originál vs. dvojče (text ze spec §5.2); co nemodelujeme.
   - `### Daně` – 3 věty ze spec §5.3 (shodné s PDF) + „obecná informace, ne daňové poradenství".
   - `### Bez QQQ a bez syntetických fondů` – QQQ se obchoduje na Nasdaqu (doloženo prospektem SEC), syntetické fondy nelze poctivě srovnat jen podle TER.
   - `### Reklama B nestaví na čísle v korunách` – rozdíl mezi dvojčaty S&P 500 je při 3 000 Kč měsíčně a 20 letech jen cca 6 900 Kč (hodnota z `computeFees`, ověřená testem Task 4); slib „ušetříte" by byl slabý a zavádějící, proto B prodává praktičnost (přesný ISIN a postup).
   - `### Bez skládání portfolia a kvízu` – personalizovaný výběr fondů se blíží investičnímu doporučení.
   - `### Telefon až po e-mailu, dva oddělené souhlasy` – e-mail je jediné pole (nejnižší tření); telefon nepovinný na `/dekujeme` a `/potvrzeno`; souhlas (a) hovor provozovatele, (b) předání jmenovitým partnerům, nezaškrtnuté, odeslat lze s (a) bez (b). Telefonát podle písemného skriptu bez osobních investičních doporučení (spec §7.4).
   - `### Měření bez souhlasu a se souhlasem` – bez souhlasu PostHog jen cookieless (anonymní agregace, žádné `aid`), Meta Pixel/CAPI/GA4 nikdy; se souhlasem `aid` propojí celou cestu; Brevo = zdroj pravdy pro počet kontaktů.
6. **`## Reklamy A/B`** – pro každou verzi: náhled `![Verze A 4:5](ads/a-4x5.png)` a odkaz `[9:16](ads/a-9x16.png)` (totéž B), primární text, titulek, tlačítko a hero varianta **doslova ze spec §9** (zkopíruj z `ads/copy.md`), URL s UTM. Věta: „Čísla a ISIN na kreativách generuje `npm run ads` z `src/data/etf-pairs.json`." Kampaň: Financial products and services, omezení Meta pro finanční weby (Core Setup).
7. **`## Očekávaná konverze`** – úvodní věta: „Jde o **odhad** týmu, ne benchmark se zdrojem; ověří se daty." Tabulka ze spec §13 (metrika, odhad, zdůvodnění) beze změn. Pod ní: „První vyhodnocení má smysl po cca 1 000 návštěv na variantu – jako kontrola, že trychtýř funguje a odhad není mimo. Na rozhodnutí A/B testu je potřeba víc (viz další sekce)."
8. **`## A/B hypotézy`** – úvod: seřazeno podle očekávaného dopadu, oboustranný test, α = 0,05, síla 0,8. Vzorec (doslova, viz „Výpočet vzorku" výše) a dosazení pro baseline 4 % a +20 % → **10 317 návštěvníků na variantu** (≈ 20 634 celkem), věta o nejmenším zjistitelném efektu při 1 000 návštěvách (≈ +71 %). Tabulka:

| # | Hypotéza | Varianty | Hlavní metrika | Očekávaný efekt | Vzorek na variantu |
|---|---|---|---|---|---|
| 1 | Nabídka je největší páka konverze | „Návod ke koupi u vašeho brokera" vs. „Tahák všech dvojčat" | konverze; sekundárně míra telefonů | +50 % relativně (4 → 6 %) | ≈ 1 863 návštěv |
| 2 | Formulář na první obrazovce zvyšuje konverzi bez ztráty kvality | formulář pod odpovědí v hero vs. až pod kalkulačkou | konverze; hlídací metrika míra potvrzení DOI | +30 % relativně (4 → 5,2 %) | ≈ 4 783 návštěv |
| 3 | Okamžité PDF zvýší telefony, ale může snížit potvrzení | PDF hned na `/dekujeme` vs. až po potvrzení | podíl použitelných kontaktů (potvrzené nebo s telefonem) z odeslaných | 60 → 66 % odeslání | ≈ 1 015 odeslání ≈ 25 400 návštěv |

   Pod tabulkou: H3 vyžaduje souhlas právníka s jiným nastavením souhlasů; test reklam A vs. B běží paralelně na úrovni kreativ v Meta (metrika: konverze podle `hero_variant` / `utm_content`). Efekty jsou předpoklady pro plánování vzorku, ne slib.
9. **`## Měření`** – nástroje (PostHog EU, Meta Pixel + CAPI, GA4 Consent Mode v2, Brevo) a režimy souhlasu; tabulka událostí ze spec §8.3; metriky ze spec §8.4; odkaz na PostHog dashboard (z `docs/brevo-setup.md` § 9); výkon: tabulka LCP/CLS/skóre z `docs/lighthouse-mobile.json` s datem a odkazem `[docs/lighthouse-mobile.json](docs/lighthouse-mobile.json)` – hodnoty získej `jq` příkazem z Task 15 Step 12, uveď i nesplněné.
10. **`## Zdroje dat`** – `src/data/etf-pairs.json` a `src/data/brokers.json` jako jediný zdroj pro stránku, kalkulačku, PDF a reklamy; struktura `{ value, sourceUrl, asOf }`; tabulka fondů ze spec §6 (fond, TER, ISIN/burza, zdroj) – **vygeneruj z dat**, ne opisem: `npx tsx -e "import {getData} from './src/lib/pairs'; for (const f of Object.values(getData().funds)) console.log('|', f.id, '|', f.ter.value, '|', f.isin.value, '|', f.ter.sourceUrl, '|')"`; pravidlo: primární zdroj vydavatel/broker, agregátor jen ke kontrole, neověřitelné se nezobrazí.
11. **`## Měsíční aktualizace dat`** – checklist (- [ ]):
    - TER, ISIN, distribuce, replikace každého fondu na stránce/factsheetu vydavatele → `value`, `sourceUrl`, `asOf`.
    - U brokerů: dostupnost každého dvojčete, ticker, poplatek za nákup, postup v aplikaci → `brokers.json`, `asOf`.
    - `getData().asOf` = datum ověření.
    - `npm test` (validace dat, kalkulačka 3 000 Kč / 20 let ≈ 6 900 Kč se může změnit – aktualizovat test i README větu o reklamě B).
    - `npm run ads` a vizuální kontrola 4 PNG; nahrát nové kreativy do Meta, pokud se změnila čísla.
    - `npm run build` (nové PDF), nasazení, kontrola `/navod-etf.pdf` na produkci.
    - Zápis do historie commitů `chore(data): monthly update YYYY-MM`.
12. **`## Checklist před spuštěním reklamy`** – řádek `**Stav: připraveno, blokuje: …**` (vyjmenuj nesplněné body, typicky souhlas Clientela jako provozovatele, schválení právníkem, Vercel Pro, ověřená doména v Brevo) + všech 8 bodů ze spec §16 jako `- [ ]` / `- [x]` podle skutečného stavu (body ověřené v Task 15 – Lighthouse, E2E na produkci, DOI test – zaškrtni jen pokud jsou v `docs/brevo-setup.md` § 9 zapsané jako splněné). Přidej poznámku k `OPERATOR` (údaje převzaté z patičky clientelo.cz, k odsouhlasení) a k Vercel Hobby (jen nekomerční použití, zdroj https://vercel.com/docs/limits/fair-use-guidelines).
13. **`## Produkční nasazení`** – produkční URL, PostHog dashboard (oboje z `docs/brevo-setup.md` § 9; pokud chybí: „ČEKÁ: Task 15 Step 9/13"), odkaz `[docs/brevo-setup.md](docs/brevo-setup.md)` (Brevo, ruční test DOI), seznam env proměnných z `.env.example` s jednou větou, odkud se berou, a postup nasazení (import GitHub repa do Vercelu, env, redeploy po změně env).
14. **`## Lokální spuštění a testy`**:
```bash
npm ci
npx playwright install chromium
cp .env.example .env   # bez klíčů běží API v režimu bez rate limitu (warning)
npm run prebuild       # vygeneruje public/navod-etf.pdf (jinak ho dev server nemá)
npm run dev            # http://localhost:4321
npm test               # Vitest: data, kalkulačka, API, PDF, reklamy, CSP, README
npm run test:e2e       # Playwright 390×844; proti produkci: BASE_URL=https://… npm run test:e2e
npm run ads            # vyrenderuje ads/*.png
npm run lint           # astro check
```

Před zápisem ověř čísla z kódu: `MODEL_RETURN`, `COMPARISON_TER`, `LIMITS` (Task 4) a hodnotu „≈ 6 900 Kč" z `formatCzk(computeFees(...))` pro SPYL vs. VUAA při výchozích vstupech.

- [ ] **Step 4: Spusť – musí projít**

```bash
npx vitest run tests/unit/readme.test.ts
```
Očekávaný výstup: `✓ tests/unit/readme.test.ts (6 tests)` · `Test Files  1 passed (1)`.

Poté celé `npm test` zeleně a vizuální kontrola README na GitHubu (obrázky reklam se zobrazí, tabulky nejsou rozbité).

- [ ] **Step 5: Commit**

```bash
git add README.md tests/unit/readme.test.ts
git commit -m "docs: add README with rationale, conversion estimate and A/B plan"
git push origin main
```
