# Nastavení Brevo (single opt-in, návod e-mailem) a produkční prostředí

Body 1–8 popisují ruční kroky v účtu Brevo. Bod 9 „Produkční prostředí" obsahuje ostatní ruční kroky (Upstash, PostHog, Meta, GA4, Vercel, ověření na produkci, Lighthouse, PostHog dashboard) a kontrolní seznam před spuštěním kampaně. Kroky označené **[ČLOVĚK]** vyžadují přístup k účtům a nedají se udělat z repozitáře.

## 1. Účet a odesílatel

Registrace na brevo.com. Senders, Domains & Dedicated IPs: přidat a ověřit odesílací doménu (SPF, DKIM, DMARC). Bezplatný tarif má limit 300 e-mailů denně (spec §16).

## 2. API klíč

SMTP & API → API keys → nový klíč → hodnota do `BREVO_API_KEY`. Pokud je v účtu zapnuté omezení API na povolené IP adresy, vypnout (Vercel Functions nemají pevnou IP).

## 3. Seznam

Contacts → Lists → nový seznam „ETF Dvojče – návod" → jeho ID do `BREVO_LIST_ID`.

## 4. Atributy kontaktu

Settings → Contacts → Contact attributes → Normal Attributes → přidat (názvy: písmena, číslice a podtržítka, max. 50 znaků). Zdroj: https://help.brevo.com/hc/en-us/articles/10617359589906-Create-and-manage-contact-attributes

Brevo odmítne atribut, který v účtu neexistuje (pak `/api/subscribe` i `/api/profile` vrací chybu 502), proto musí existovat všechny:

| Atribut | Typ | Plní |
|---|---|---|
| `AID` | Text | subscribe, profile |
| `PAIR` | Text | subscribe |
| `CALC_DEPOSIT` | Number | subscribe |
| `CALC_HORIZON` | Number | subscribe |
| `PLACEMENT` | Text | subscribe |
| `UTM_SOURCE`, `UTM_MEDIUM`, `UTM_CAMPAIGN`, `UTM_CONTENT` | Text | subscribe |
| `CONSENT_TEXT_VERSION` | Text | subscribe, profile |
| `CONSENT_AT` | Text (ISO 8601) | subscribe |
| `BROKER` | Text | profile |
| `CONSENT_CALL`, `CONSENT_PARTNERS` | Boolean | profile |
| `CONSENT_CALL_AT` | Text (ISO 8601) | profile |
| `SMS` | vestavěný | profile (`+420…`) |

Platí názvy v kódu (`src/pages/api/subscribe.ts`, `src/server/brevo.ts`). Kontrola před vyplněním – příkaz vypíše 16 názvů, které musí odpovídat tabulce 1:1:

```bash
grep -ohE "attributes\.[A-Z_]+ =|\['[A-Z_]+',|[{,] [A-Z_]{3,}: |^ +[A-Z_]{3,}: " src/server/brevo.ts src/pages/api/*.ts | grep -oE "[A-Z_]{3,}" | sort -u
```

## 5. Šablona e-mailu s návodem

Kontakt vzniká hned po odeslání formuláře (single opt-in): `/api/subscribe` volá jednou `POST /v3/contacts` s `email`, `ext_id` (= `aid`), `listIds: [BREVO_LIST_ID]`, `updateEnabled: true` a atributy z bodu 4. Tvar požadavku: https://developers.brevo.com/reference/createcontact (dokumentuje 201 pro nový kontakt). Že Brevo existující kontakt aktualizuje s odpovědí 204, je pozorované chování, v dokumentaci API neověřené – ověřit ručním testem v bodě 8. Při konfliktu identifikátoru (400 `duplicate_parameter`, např. `ext_id` už má jiný kontakt) server zkusí jednou nové `aid` a nakonec uloží kontakt bez `ext_id` s novým `aid` v atributu `AID` (`createLeadContact` v `src/server/brevo.ts`).

Marketing → Templates → Create Template → Email. Odesílatel z bodu 1, **předmět „Váš návod: jak koupit S&P 500 u vašeho brokera"**, jedno tlačítko „Stáhnout návod (PDF)" s odkazem na `{SITE_URL}/navod-etf.pdf` (absolutní URL produkce, např. `https://<doména>/navod-etf.pdf`). Bez reklamy a bez personalizace atributy. Šablonu aktivovat.

## 6. Text e-mailu

> **Předmět:** Váš návod: jak koupit S&P 500 u vašeho brokera
>
> Dobrý den,
>
> posíláme návod, o který jste si řekli na stránce ETF Dvojče. Najdete v něm páry amerických ETF a jejich evropských dvojčat s TER a ISIN a postup koupě u XTB, Trading 212, Fio a Degiro (co jsme zatím neověřili, návod tak označuje).
>
> **[Stáhnout návod (PDF)]** → `{SITE_URL}/navod-etf.pdf`
>
> Údaje v návodu platí k datu uvedenému v PDF. Návod není investičním doporučením.
>
> ETF Dvojče
>
> ---
> Provozovatel: ETF Dvojče – ukázkový projekt, etf-dvojce@seznam.cz. Ukázkový projekt vytvořený jako zadání pro přijímací řízení. Nejde o nabídku investičních služeb.
> Tento e-mail jste dostali, protože jste si návod vyžádali na `{SITE_URL}`. Odhlásit se můžete zde: `{{ unsubscribe }}`

Patička přebírá hodnoty z `OPERATOR` (`src/lib/operator.ts`); při výměně provozovatele pro ostrý provoz upravit i ji. Odkaz na odhlášení je v Brevu povinný u marketingových e-mailů; placeholder `{{ unsubscribe }}` (zdroj: https://help.brevo.com/hc/en-us/articles/209553645).

## 7. Automatizace

Automations → nová → spouštěč **„Contact added to list"** (seznam z bodu 3) → akce **„Send an email"** (šablona z bodu 5) → aktivovat. Zdroj: https://help.brevo.com/hc/en-us/articles/15445989568402

Kontrola: `/api/profile` **nesmí** přidávat kontakt do seznamu (automatizace by poslala návod i kontaktu bez e-mailu nebo podruhé). `grep -n "listIds" src/server/brevo.ts` ukáže seznam jen u `createLeadContact`.

## 8. Ruční test registrace a e-mailu s návodem (Gmail a Seznam)

**[ČLOVĚK]** na produkční URL, na reálném iOS Safari a Android Chrome. Ke každému řádku zapsat datum a výsledek.

- [ ] Mobil, `{SITE_URL}/?utm_content=a-4x5`, odeslat e-mail `…@gmail.com` → `/dekujeme?aid=…` do 2 s, nadpis „Hotovo. Návod je váš.".
- [ ] Tlačítko „Stáhnout návod (PDF)" na `/dekujeme` stáhne a otevře PDF.
- [ ] E-mail s návodem z automatizace dorazí do 5 min; složka (Primární / Promo akce / Spam) zapsána; předmět „Váš návod: jak koupit S&P 500 u vašeho brokera"; odkaz na PDF i odhlášení fungují.
- [ ] Brevo: kontakt v seznamu, `ext_id` = `aid` z adresy `/dekujeme`, atributy `AID`, `PLACEMENT`, `UTM_CONTENT`, `CONSENT_TEXT_VERSION`, `CONSENT_AT` vyplněné.
- [ ] Totéž pro `…@seznam.cz` (složky Hlavní / Hromadné / Spam).
- [ ] Druhé odeslání stejného e-mailu → úspěch, žádná chyba (duplicita); zapsat stavový kód odpovědi Brevo z Vercel → Logs (očekávaný 204 je zatím neověřený) a zda přišel druhý e-mail s návodem (závisí na nastavení opakovaného vstupu do automatizace).
- [ ] `/dekujeme`: výběr brokera + telefon se souhlasem (a) bez (b) → v Brevu **u téhož kontaktu** (ne v novém kontaktu bez e-mailu) `BROKER`, `SMS`, `CONSENT_CALL=true`, `CONSENT_PARTNERS=false`, `CONSENT_CALL_AT` vyplněné.
- [ ] Druhé odeslání stejného e-mailu z jiného prohlížeče (nové `aid`) → zapsat odpověď Brevo (204, nebo 400 `duplicate_parameter` a v logu `[brevo] ext_id conflict twice, contact saved without ext_id`) a pak výběr brokera na `/dekujeme`: uložil se `BROKER` k původnímu kontaktu, nebo vznikl nový kontakt bez e-mailu? (Chování Brevo při jiném `ext_id` u existujícího e-mailu není v dokumentaci API popsané.)
- [ ] Překlep v e-mailu → odeslat → zpět → opravený e-mail odeslat (stejné `aid`) → opravený e-mail je v seznamu a návod na něj dorazí; `/dekujeme` má v adrese nové `aid`.
- [ ] Odeslání formuláře s vypnutým JavaScriptem (nativní POST) → `/dekujeme?aid=…`, e-mail s návodem dorazí.
- [ ] Starý odkaz `{SITE_URL}/potvrzeno?aid=…` → 301 na `/dekujeme?aid=…`.
- [ ] PostHog: události `form_submitted`, `thankyou_viewed`, `pdf_downloaded`; se souhlasem i `aid`.
- [ ] Meta Events Manager → Test events (s `META_TEST_EVENT_CODE`): `Lead` z Pixelu i ze serveru, deduplikovaný přes `event_id`.

## 9. Produkční prostředí

### 9.1 [ČLOVĚK] Služby třetích stran

| Služba | Co udělat | Předá |
|---|---|---|
| **Brevo** | vše podle bodů 1–7 | `BREVO_API_KEY`, `BREVO_LIST_ID` |
| **Upstash** | console.upstash.com → Redis → **+ Create Database**, název `etf-dvojce-ratelimit`, primární region Frankfurt (`eu-central-1`), free plán; v detailu databáze sekce REST API zkopírovat URL a token. Zdroj: https://upstash.com/docs/redis/overall/getstarted | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **PostHog** | registrace na **EU cloud** (eu.posthog.com), projekt „ETF Dvojče"; Settings → Project → **zapnout cookieless mode** („Cookieless mode must also be enabled in your PostHog project settings, otherwise cookieless events are ignored" – https://posthog.com/docs/libraries/js/config); podepsat DPA; zkopírovat Project API key | `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com` |
| **Meta** | Business Manager → Events Manager → Connect data sources → Web → nový Pixel „ETF Dvojče"; v nastavení Pixelu vygenerovat token pro Conversions API; v záložce Test events zkopírovat test code; ověřit doménu (po nasazení) | `META_PIXEL_ID` **a stejnou hodnotu jako `PUBLIC_META_PIXEL_ID`**, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE` (jen pro test, před spuštěním kampaně smazat) |
| **GA4** | analytics.google.com → nová služba → webový datový stream na produkční URL | `PUBLIC_GA4_ID` (`G-…`) |

### 9.2 Proměnné prostředí (Vercel → Settings → Environment Variables, Production i Preview)

Úplný seznam odpovídá `.env.example`:

| Proměnná | Typ | Čte | Když chybí |
|---|---|---|---|
| `BREVO_API_KEY` | Secret | server (`src/server/brevo.ts`) | každé odeslání formuláře skončí chybou `server` (502) |
| `BREVO_LIST_ID` | text | server | odesílá se seznam `0` – vytvoření kontaktu selže nebo kontakt nebude v seznamu (automatizace z bodu 7 se nespustí, e-mail s návodem nepřijde) |
| `META_PIXEL_ID` | text | server (Conversions API) | serverový `Lead` se tiše neposílá |
| `META_CAPI_TOKEN` | Secret | server | serverový `Lead` se tiše neposílá |
| `META_TEST_EVENT_CODE` | text | server | nic (jen test; **před kampaní smazat**, jinak události končí v Test events) |
| `PUBLIC_META_PIXEL_ID` | text, **build** | klient (Pixel) | Pixel se nenačte, deduplikace Pixel/CAPI nefunguje |
| `PUBLIC_POSTHOG_KEY` | text, **build** | klient | PostHog vypnutý, žádné události |
| `PUBLIC_POSTHOG_HOST` | text, **build** | klient | výchozí `https://eu.i.posthog.com` |
| `PUBLIC_GA4_ID` | text, **build** | klient | GA4 se nenačte |
| `SITE_URL` | text, **build i server** | `astro.config.mjs` (canonical, OG), kontrola `Origin` v API | API odmítne každý požadavek (403 / `?error=server`) |
| `UPSTASH_REDIS_REST_URL` | text | server (`src/server/ratelimit.ts`) | **rate limit se tiše vypne** (jen `console.warn`) |
| `UPSTASH_REDIS_REST_TOKEN` | Secret | server | **rate limit se tiše vypne** |

Proměnné `PUBLIC_*` a `SITE_URL` se vkládají do HTML/JS při buildu: po jejich změně je nutný **Redeploy** („Any change you make to environment variables are not applied to previous deployments, they only apply to new deployments." – https://vercel.com/docs/environment-variables).

`SITE_URL` musí přesně odpovídat originu, na kterém web běží (schéma + doména, bez lomítka na konci). API porovnává hlavičku `Origin` právě s ním (`src/server/origin.ts`), takže formulář na jiné doméně (např. `*.vercel.app` vedle vlastní domény) skončí chybou. Při přechodu na vlastní doménu změnit `SITE_URL` a nasadit znovu.

### 9.3 [ČLOVĚK] Vercel – import repa a nasazení

1. vercel.com → přihlásit se přes GitHub → **Add New… → Project** → **Import** `JirkaZednik/landing-page-etf` (pokud repo není vidět: „Adjust GitHub App Permissions" a povolit repo). Nasazovaná větev musí obsahovat práci z `feat/landing-page` (push/merge rozhodne vlastník repa).
2. Framework Preset: **Astro** (detekce automatická), Build Command `npm run build` (spustí i `prebuild` = PDF), Output: výchozí (adaptér `@astrojs/vercel`). Zdroj: https://docs.astro.build/en/guides/deploy/vercel/
3. Environment Variables podle 9.2; secrets (`BREVO_API_KEY`, `META_CAPI_TOKEN`, `UPSTASH_REDIS_REST_TOKEN`) jako typ **Secret**. `SITE_URL` zatím `https://<projekt>.vercel.app`.
4. **Deploy.** Pokud se produkční URL liší od `SITE_URL`, opravit a **Redeploy**.
5. Volitelně Settings → Functions → region Frankfurt (`fra1`), pokud ho tarif nabízí.
6. **Tarif:** Hobby stačí pro hodnocení zadání. Ostrá kampaň musí běžet na Pro/Enterprise účtu Clientela: „Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan." – https://vercel.com/docs/limits/fair-use-guidelines
7. Náhledová nasazení jsou chráněná; pro E2E na náhledu použít hlavičku `x-vercel-protection-bypass` s `VERCEL_AUTOMATION_BYPASS_SECRET` (https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation). Na náhledech může CSP blokovat Vercel Toolbar (`vercel.live`) – očekávané.

### 9.4 Ověření na produkci

1. Hlavičky:
   ```bash
   export BASE_URL=https://<projekt>.vercel.app
   curl -sI "$BASE_URL/" | grep -iE '^(content-security-policy|referrer-policy|x-content-type-options|permissions-policy|x-frame-options):'
   ```
   Očekáváno: 5 řádků s hodnotami z `vercel.json`. Pokud `content-security-policy` chybí (Vercel u výstupu adaptéru nepoužil hlavičky z `vercel.json`): přejít na `experimental.csp` (Astro ≥ 5.9) + `vercel({ experimentalStaticHeaders: true })`, přenést direktivy a domény z `vercel.json`, CSP z `vercel.json` odebrat, upravit `tests/build/csp.test.ts` tak, aby kontroloval `.vercel/output/config.json`, a zopakovat.
2. E2E proti produkci (bez `BASE_URL` se `tests/e2e/production.spec.ts` přeskočí a Playwright spouští lokální dev server):
   ```bash
   BASE_URL=$BASE_URL npm run test:e2e -- tests/e2e/production.spec.ts
   BASE_URL=$BASE_URL npm run test:e2e
   ```
   Očekáváno: vše zelené, mj. `production smoke › no CSP violations with all consents accepted`. Při porušení CSP doplnit chybějící doménu do příslušné direktivy (u PostHogu `https://*.posthog.com`), znovu nasadit a opakovat. E2E nevolá ostré Brevo (jen neplatný e-mail a honeypot).
3. Ruční test registrace a e-mailu s návodem podle bodu 8.

### 9.5 Lighthouse mobile

```bash
export CHROME_PATH=$(node -e "console.log(require('@playwright/test').chromium.executablePath())")
for i in 1 2 3; do
  npx --yes lighthouse "$BASE_URL/?utm_content=a-4x5" \
    --form-factor=mobile \
    --only-categories=performance,accessibility,best-practices,seo \
    --output=json --output-path=/tmp/lh-$i.json \
    --chrome-flags="--headless=new --no-sandbox" --quiet
done
best=$(for i in 1 2 3; do echo "$(jq '.audits["largest-contentful-paint"].numericValue' /tmp/lh-$i.json) $i"; done | sort -n | sed -n 2p | cut -d' ' -f2)
cp /tmp/lh-$best.json docs/lighthouse-mobile.json
jq '{lighthouseVersion, lcp_ms: .audits["largest-contentful-paint"].numericValue, cls: .audits["cumulative-layout-shift"].numericValue, perf: .categories.performance.score, a11y: .categories.accessibility.score}' docs/lighthouse-mobile.json
jq -e '.audits["largest-contentful-paint"].numericValue < 1500 and .audits["cumulative-layout-shift"].numericValue < 0.1' docs/lighthouse-mobile.json
```

Cíl: `lcp_ms` < 1500, `cls` < 0.1. Čísla se neupravují; nesplněný výsledek se uvede v README.

**Aktuální `docs/lighthouse-mobile.json` je z lokálního produkčního buildu, ne z produkce** (2026-10-12, Lighthouse 13.5.0, `.vercel/output/static` servírované lokálním statickým serverem s hlavičkami z `vercel.json` a kompresí brotli, medián ze 3 běhů podle LCP): LCP 1089 ms, CLS 0.0007, výkon 1.00, přístupnost 1.00, best practices 1.00, SEO 1.00. Pozor: simulované LCP bylo v opakovaných bězích bimodální (≈ 1,05–1,09 s nebo ≈ 1,96 s), takže na produkci je nutné měřit znovu podle příkazů výše.

### 9.6 [ČLOVĚK] PostHog funnel a dashboard (spec §8.4)

V PostHog EU (https://posthog.com/docs/product-analytics/funnels): Product Analytics → **+ New Insight → Funnel**:

1. **„Konverze podle varianty"** – kroky `page_view` → `form_viewed` → `form_started` → `form_submitted`, pořadí Sequential, okno 1 den, **breakdown** `hero_variant` (druhá kopie s breakdown `utm_content`). Uložit.
2. **„Konverze podle umístění"** – Trends: `form_submitted`, breakdown `placement`; a funnel `form_viewed` → `form_submitted` s breakdown `placement` (hero vs. níže).
3. **„Po odeslání"** – funnel `form_submitted` → `thankyou_viewed` → `broker_selected` → `phone_submitted` (měřitelné napříč stránkami jen u návštěvníků se souhlasem; bez souhlasu porovnávat agregované počty). Trends `pdf_downloaded` / `form_submitted` (stažení PDF na `/dekujeme`; stažení z e-mailu PostHog nevidí, počet kontaktů a odrazů brát z Brevo).
4. Vše přidat na dashboard **„ETF Dvojče – konverze"**. Hlavní KPI = `form_submitted` / unikátní návštěvníci (`page_view`, unikátní) podle `hero_variant`.

### 9.7 [ČLOVĚK] Kontrola před spuštěním kampaně

- [ ] V produkci jsou nastavené **`UPSTASH_REDIS_REST_URL` a `UPSTASH_REDIS_REST_TOKEN`**. Bez nich se rate limit tiše vypne (`/api/subscribe` i `/api/profile` přijmou neomezený počet požadavků) – ve Vercel → Logs nesmí být `[ratelimit] Upstash env missing`.
- [ ] `PUBLIC_META_PIXEL_ID` = `META_PIXEL_ID`; v Meta Test events vidět `Lead` z prohlížeče i ze serveru se stejným `event_id`.
- [ ] `META_TEST_EVENT_CODE` smazaný a web znovu nasazený.
- [ ] **`SITE_URL` přesně odpovídá originu, na který vedou odkazy z reklam** (schéma + doména, bez lomítka na konci). API přijímá jen požadavky s `Origin`/`Referer` z tohoto originu (`src/server/origin.ts`); při neshodě selže **100 % odeslání** s obecnou chybou. Zkontrolovat: `www.` vs. doména bez `www` (druhá varianta musí na první přesměrovat, ne ji zobrazovat), alias `*.vercel.app` vedle vlastní domény (reklamy nesmí vést na alias), náhledová nasazení (Preview mají jinou doménu, formulář na nich s produkčním `SITE_URL` neprojde – testovat jen se `SITE_URL` nastaveným pro Preview). Ověření: `BASE_URL=<přesně URL z reklamy bez UTM> npm run test:e2e` a ruční odeslání formuláře z odkazu v reklamě (žádné `?error=server`).
- [ ] **Rate limit (5 odeslání z jedné IP za 10 min) sledovat první dny kampaně.** Čeští mobilní operátoři sdílejí IPv4 adresy mezi mnoha zákazníky (CGNAT), takže limit může zastavit i skutečné návštěvníky; rozpočet spotřebují i neplatné e-maily a honeypot. Sledovat Vercel → Logs (`/api/subscribe` se stavem 429) a v PostHogu `form_error` s `error_type = rate_limited`. Pokud se objevují, limit zvýšit – je to parametr `checkRateLimit` (výchozí `{ limit: 5, window: '10 m' }` v `src/server/ratelimit.ts`, volání v `src/pages/api/subscribe.ts`), změna v kódu + nové nasazení – případně omezovat podle IP + e-mailu.
- [ ] Hlavičky a E2E podle 9.4 zelené na finální doméně.
- [ ] Ruční test registrace a e-mailu s návodem (bod 8) vyplněný.
- [ ] Vercel tarif Pro/Enterprise (komerční provoz).
- [ ] Brevo: ověřená doména odesílatele, limit 300 e-mailů denně odpovídá rozpočtu kampaně (jinak vyšší tarif).
- [ ] Právní kontrola: doby uchování (nastavení Brevo a PostHog, kód je nevynucuje), region Upstash v EU, právní základ „doložení souhlasu", přenos dat Google (GA4) do USA, datum „Platné od" v zásadách ochrany osobních údajů.

### 9.8 Záznam výsledků (vyplní člověk)

- Produkční URL: _doplní se po nasazení_
- PostHog dashboard „ETF Dvojče – konverze": _odkaz se doplní po vytvoření_
- Lighthouse mobile na produkci (datum, `lcp_ms`, `cls`, výkon, přístupnost): _doplní se po měření podle 9.5_
- Výsledek ručního testu registrace a e-mailu s návodem (bod 8): _doplní se po testu_
