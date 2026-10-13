# ETF Dvojče v3 – přejmenování, neutrální provozovatel, single opt-in · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Zapracovat změny v3 ze specifikace do hotové stránky (main @ b700ccb).

**Architecture:** Beze změny architektury. Mění se texty/značka, data provozovatele (`src/lib/operator.ts`) a lead flow v `/api/subscribe` + děkovacích stránkách.

**Tech Stack:** Astro 5, React, TypeScript, Vitest, Playwright, @react-pdf/renderer (stávající).

**Spec:** `docs/superpowers/specs/2026-10-11-etf-dvojcata-landing-design.md` – sekce „Změny ve verzi 3" je závazná a má přednost.

## Global Constraints

- Všechny Global Constraints z `docs/superpowers/plans/2026-10-11-indexak-landing-page.md` dál platí (čeština, vykání, žádné superlativy, žádné domýšlení dat, consent gating, výkon, přístupnost).
- Značka přesně **„ETF Dvojče"** (velké D, háček). Provozovatel přesně **„ETF Dvojče – ukázkový projekt"** (pomlčka –), kontakt **etf-dvojce@seznam.cz**.
- Řetězce „Clientelo", „Indexák", „Indexak", „IČO 22193456", „Platnéřská", „fundraising@clientelo.cz" se nesmí vyskytovat v `src/`, `public/`, `ads/`, `scripts/`, `tests/` (kromě testu, který jejich nepřítomnost hlídá). V README a `docs/` jen „Clientelo" jako kontext zadání / ostrého spuštění.
- Žádný `git push`; commity na větvi `feat/etf-dvojce`.

## Review Focus

1. Formulář bez JS → 303 na `/dekujeme?aid=…` (beze změny), kontakt v Brevu vytvořen jedním voláním, duplicitní e-mail = úspěch.
2. `/dekujeme` načtená přímo bez `aid` (např. z historie) → tlačítko PDF funguje, nic nepadá.
3. Odkaz na zrušenou `/potvrzeno` (starý bookmark) → přesměrování 301 na `/dekujeme` (vercel.json) nebo 404 stránka; ne chyba.
4. Telefon i výběr brokera dál fungují bez potvrzení e-mailu (kontakt se páruje přes `aid`).
5. Generované výstupy (PDF, OG, 4 reklamní PNG) jsou znovu vygenerované a nesou novou značku i provozovatele.

---

### Task 1: Značka „ETF Dvojče" a neutrální provozovatel

**Files (orientačně, ověř grepem):** `src/lib/operator.ts`, `src/layouts/Base.astro`, `src/pages/*.astro`, `src/components/Faq.astro`, `src/components/Footer.astro`, `src/pages/zasady-ochrany-osobnich-udaju.astro`, `src/pages/cookies.astro`, `src/pdf/GuideDocument.tsx`, `ads/templates/*.html`, `ads/copy.md`, `ads/*.png`, `public/og.png`, `public/navod-etf.pdf`, `tests/**`, `README.md`, `docs/brevo-setup.md`.

**Interfaces:** `OPERATOR` mění tvar na `{ name: string; email: string; web?: string; note: string }` – `ico`, `address`, `phone` odpadají; všichni konzumenti (patička, zásady, FAQ, PDF) se upraví. `note` = „Ukázkový projekt vytvořený jako zadání pro přijímací řízení. Nejde o nabídku investičních služeb." (zobrazit v patičce a v zásadách).

- [ ] **Step 1:** Failing test `tests/unit/operator.test.ts`: `OPERATOR` má `name: 'ETF Dvojče – ukázkový projekt'`, `email: 'etf-dvojce@seznam.cz'`, nemá `ico`/`address`/`phone`.
- [ ] **Step 2:** Failing test `tests/unit/no-legacy-brand.test.ts`: rekurzivně projde `src/`, `ads/` (textové soubory), `scripts/`, `tests/` (kromě sebe) a selže, pokud najde (case-insensitive) `clientelo`, `indexák`, `indexak`, `22193456`, `platnéřská`. Plus kontrola, že text extrahovaný z `public/navod-etf.pdf` (stávající helper z PDF testů) tyto řetězce neobsahuje a obsahuje „ETF Dvojče".
- [ ] **Step 3:** Implementace: nový `operator.ts`; přejmenovat značku v titulcích, meta/OG, hlavičce, patičce, FAQ („Kdo za tím stojí…" – odpověď: ukázkový projekt, kontakt, údaje se v demu nepředávají žádným partnerům), zásadách (správce = provozovatel; bez IČO/sídla; sekce partnerů: v demu se nepředává nikomu, pro ostrý provoz doplní provozovatel), cookies, 404, PDF šabloně, šablonách reklam a `ads/copy.md`.
- [ ] **Step 4:** Upravit stávající testy (operator, homepage/privacy E2E, PDF testy), které očekávaly Clientelo/Indexák.
- [ ] **Step 5:** Přegenerovat `public/navod-etf.pdf` (`npm run build` – prebuild), `npm run ads` (4 PNG + `public/og.png`); vizuálně zkontrolovat PNG a 1. stranu PDF (Read obrázku).
- [ ] **Step 6:** README a `docs/brevo-setup.md`: značka, provozovatel; Clientelo jen jako kontext zadání; sekce „Stav" rozdělit na „Demo: připraveno" a „Před ostrým spuštěním u klienta" (výměna `operator.ts` a seznamu partnerů, souhlas klienta, právník, účty a tarify, data T212/Fio, Lighthouse na produkci). README test aktualizovat.
- [ ] **Step 7:** `npm test`, `npm run test:build`, `npm run lint`, `npm run build`, `npm run test:e2e` zelené → commit `feat: rebrand to ETF Dvojče with neutral demo operator`.

### Task 2: Single opt-in a okamžitý návod na /dekujeme

**Files:** `src/server/brevo.ts`, `src/pages/api/subscribe.ts`, `src/pages/dekujeme.astro`, `src/pages/potvrzeno.astro` (smazat), `src/components/PhoneOffer.tsx`, `src/lib/copy.ts`, `src/lib/types.ts`, `vercel.json`, `src/styles/global.scss`, testy `tests/api/subscribe.test.ts`, `tests/unit/brevo.test.ts`, `tests/unit/components/PhoneOffer.test.tsx`, `tests/e2e/thankyou.spec.ts`, `tests/e2e/production.spec.ts`, `tests/build/csp.test.ts` (pokud se mění inline skripty), `README.md`, `docs/brevo-setup.md`.

**Interfaces:** `createDoiContact` se nahrazuje `createLeadContact(i: { email: string; aid: string; attributes: Record<string, string | number> }): Promise<{ ok: true } | { ok: false; error: 'brevo' }>` – `POST https://api.brevo.com/v3/contacts` s `email`, `listIds: [BREVO_LIST_ID]`, `updateEnabled: true`, `attributes` (stejné jako dosud), `ext_id` se NEnastavuje (páruje se atributem `AID`, jak to dělá `/api/profile` – ověř, že `upsertProfile` páruje tak, aby e-mailový kontakt a profil skončily u téhož kontaktu, nebo to v reportu popiš). Env `BREVO_DOI_TEMPLATE_ID` zaniká (odstranit z `.env.example`, env.ts, docs). `PhoneOffer` props `{ page: 'dekujeme' }` (nebo bez props). `EventName` ztrácí `'doi_confirmed'`.

- [ ] **Step 1:** Failing API/unit testy: subscribe volá `POST /v3/contacts` s `listIds`, `updateEnabled: true`, atributy; nevolá `doubleOptinConfirmation`; duplicitní/`204` = úspěch; chyba Brevo → `{ ok:false, error:'server' }` a form-encoded 303 na `/?error=…#form` (beze změny).
- [ ] **Step 2:** Implementace `createLeadContact` + úprava `subscribe.ts`; smazat DOI kód a env.
- [ ] **Step 3:** Failing E2E `tests/e2e/thankyou.spec.ts`: `/dekujeme?aid=<uuid>` ukazuje nadpis „Hotovo. Návod je váš." (přesně), tlačítko/odkaz **„Stáhnout návod (PDF)"** na `/navod-etf.pdf` s `download`, větu „Stejný návod jsme vám poslali i e-mailem." a klik vyvolá `pdf_downloaded`; pořadí na stránce: nadpis → tlačítko PDF → výběr brokera → nabídka telefonu; bez `aid` stránka funguje. Žádné texty o potvrzování e-mailu ani tlačítka Gmail/Seznam.
- [ ] **Step 4:** Implementace `/dekujeme`; smazat `/potvrzeno.astro`; `vercel.json` redirect `/potvrzeno` → `/dekujeme` (301, zachovat query); upravit `PhoneOffer` (odstranit větev potvrzeno), `copy.ts`, `types.ts`, CSS; přepočítat CSP hashe, pokud se mění inline skripty (test `tests/build/csp.test.ts` je zdroj pravdy).
- [ ] **Step 5:** Měření: odstranit `doi_confirmed` všude; `pdf_downloaded` na `/dekujeme`. README sekce Měření a funnel podle toho.
- [ ] **Step 6:** README: tok po odeslání (single opt-in a proč: slíbená hodnota hned, DOI není v ČR právně nutný pro zaslání požadovaného návodu, kvalitu leadu ověřuje validace + telefonát; cena: víc neplatných adres), tabulka konverze podle spec v3 bod 4, A/B hypotéza 3 podle spec v3 bod 5 včetně výpočtu vzorku stejným vzorcem a přepočtu na návštěvy při konverzi 4 %. `docs/brevo-setup.md`: bez DOI šablony; automatizace „Contact added to list" → e-mail s odkazem na `{SITE_URL}/navod-etf.pdf`; text e-mailu (předmět „Váš návod: jak koupit S&P 500 u vašeho brokera", podpis ETF Dvojče, patička s provozovatelem a odhlášením). README test aktualizovat.
- [ ] **Step 7:** Celá sada (`npm test`, `test:build`, `lint`, `build`, `test:e2e`) zelená → commit `feat: single opt-in with instant guide download on /dekujeme`.
