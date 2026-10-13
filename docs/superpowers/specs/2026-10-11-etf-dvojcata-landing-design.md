# ETF Dvojče – „Najdi evropské dvojče" · Návrh řešení (spec)

- **Datum:** 2026-10-11, verze 3 z 2026-10-13 (změny v3 viz níže; text pod nimi je verze 2 a platí, pokud ho v3 nemění)
- **Zadání:** Zadání B – konverzní landing page (srovnání ETF obchodovaných na NYSE pro českého drobného investora)
- **Kontext:** zadání od Clientela (clientelo.cz) pro přijímací pohovor; stránka běží pod vlastní fiktivní spotřebitelskou značkou a Clientelo na ní není uvedeno
- **Stav:** v2 implementována (PR #1), v3 schválena zadavatelem 2026-10-13

## Změny ve verzi 3 (mají přednost před textem níže)

1. **Značka:** „Indexák" → **„ETF Dvojče"** všude, kde ji vidí návštěvník (stránka, meta/OG, PDF, e-maily, reklamy, README).
2. **Provozovatel dema:** neutrální **„ETF Dvojče – ukázkový projekt"**, kontakt **etf-dvojce@seznam.cz**. Bez IČO, sídla a telefonu. Clientelo se na stránce, v PDF, v e-mailech ani v reklamách neuvádí; v README jen jako kontext zadání. Pro ostré spuštění se mění jediný soubor `src/lib/operator.ts` (+ seznam partnerů v zásadách). Souhlas Clientela a kontrola právníkem nejsou blokery dema; patří do README sekce „Před ostrým spuštěním u klienta".
3. **Single opt-in místo double opt-in:** po odeslání formuláře se kontakt v Brevu vytvoří rovnou (`POST /v3/contacts`, seznam, `updateEnabled`), automatizace „kontakt přidán do seznamu" hned pošle e-mail s návodem. `/dekujeme` nabízí **ihned tlačítko „Stáhnout návod (PDF)"**, výběr brokera a nepovinný telefon. Stránka `/potvrzeno` a událost `doi_confirmed` zanikají. Souhlas s obchodními sděleními zůstává ve formuláři (text pod tlačítkem).
4. **Očekávaná konverze:** řádek „Odeslání → potvrzení DOI" se ruší; přibývá „Lead → stažení PDF na /dekujeme: 60–80 % (odhad)".
5. **A/B hypotéza 3** (dříve „PDF hned vs. po potvrzení") se nahrazuje: **nabídka telefonu nad tlačítkem PDF vs. pod ním**; metrika míra telefonů z leadů; vzorek spočítat stejným vzorcem jako ostatní (výchozí míra 5 %, detekovat relativní zlepšení o 40 %).

---

## 0. Kontext a cíl

**Ze zadání (výslovně):**
- Lead magnet: nabídnout hodnotu a výměnou získat kontakt. Úspěch = počet kontaktů a odpověď na otázku „mohli bychom na ni zítra spustit reklamu?".
- Návštěvník: český drobný investor, přichází z reklamy na mobilu, věnuje stránce jen pár sekund.
- Obsah: srovnání ETF obchodovaných na NYSE, se skutečnými daty a uvedeným zdrojem.
- Hodnota zřejmá ještě před formulářem; první obrazovka navazuje na slib reklamy a okamžitě komunikuje, co návštěvník získá.
- Interaktivní prvky volíme sami, každý vede ke kontaktu. Formulář s minimem polí. Promyšlené, co návštěvník dostane po odeslání.
- Měření celé cesty od příchodu po odeslání formuláře.
- Výstupy: 2 verze reklamy, README (zdůvodnění pořadí sekcí, očekávaná konverze, 3 A/B hypotézy seřazené podle dopadu), nasazení na bezplatný hosting (Vercel).
- Design ani texty nesmí působit jako generický výstup AI.

**Upřesněno se zadavatelem:**
- Fiktivní spotřebitelský portál v duchu portálů Clientela.
- Kontakty do Brevo (double opt-in, automatický e-mail s lead magnetem).
- Formulář jen s e-mailem. Nepovinný telefon až po odeslání (Clientelo kvalifikuje leady po telefonu).
- Patička a disclaimery ve stylu Clientela.
- Srovnání = NYSE fond + jeho evropská (UCITS) dvojčata. QQQ vynechat.
- Framework: Astro.
- Po revizi: lead magnet = návod ke koupi u českých brokerů; reklama B přerámována na praktičnost; formulář na první obrazovce.

**Předpoklady:**
- Stránka v češtině, vykání.
- Provozovatelem a správcem osobních údajů je reálný subjekt (navrženo Clientelo Czech s.r.o.) – vyžaduje souhlas Clientela (§16).

**Výklad zadání (první odstavec README):** srovnáváme ETF obchodované na NYSE (Arca). Protože je český drobný investor u evropského brokera kvůli nařízení PRIIPs koupit nemůže, ke každému ukazujeme dostupný evropský ekvivalent. Bez toho by srovnání nemělo použitelný výstup. Originály z NYSE jsou na stránce vždy vidět vedle dvojčat (TER, burza, zdroj).

---

## 1. Cílová skupina

**Primární:** začínající až mírně pokročilý český drobný investor, 25–45 let, na mobilu. O „ETF na S&P 500" (VOO, SPY) slyšel z YouTube, Redditu, podcastů nebo od známých. Chce pravidelně investovat menší částky (stovky až nízké tisíce Kč měsíčně), účet u brokera má nebo zakládá (XTB, Trading 212, Fio, Degiro).

**Bolest:** u evropského brokera americké ETF nenajde, nebo neví, kterou z mnoha evropských verzí vybrat a jak ji v aplikaci najít.

**Co přesvědčí:** konkrétní odpověď během pár sekund, věcný tón bez slibů výnosů, viditelný zdroj dat, praktický postup pro jeho brokera.

**Co odradí:** dlouhý formulář, slib „zbohatnete", pocit skrytého prodeje, nečitelná tabulka na mobilu, žargon bez vysvětlení.

---

## 2. Nabídka: co návštěvník dostane a kdy si řekneme o kontakt

**Zdarma, bez kontaktu (hodnota před formulářem):**
- Hned na první obrazovce: odpověď pro S&P 500 – originály z NYSE (VOO, SPY, IVV) a jejich evropská dvojčata s TER.
- Pod ní: další NYSE fondy (VTI, VT, SCHD) a kalkulačka poplatků.

**Za e-mail (lead magnet):**
- **PDF „Jak koupit S&P 500 a další americké indexy u XTB, Trading 212, Fio a Degiro"** (3–4 strany):
  - pro každého brokera: která dvojčata nabízí, ISIN a ticker k vyhledání, poplatky brokera za nákup, postup krok za krokem (údaje ověřené u brokera k datu uvedenému v PDF; nic se nedomýšlí),
  - tabulka všech párů originál → dvojče s TER a ISIN,
  - akumulace vs. distribuce a co to znamená pro daně v ČR (časový test).
- Hodnota, kterou na stránce zdarma nedostane: praktický postup pro **jeho** brokera.

**Moment žádosti:**
- **Hlavní:** na první obrazovce, hned pod odpovědí pro S&P 500. K odeslání nevede žádná interakce navíc – hodnota je ukázaná (odpověď), ale ne kompletní (jak to koupit).
- **Další místa:** v každé kartě dalších fondů („Poslat návod pro tento fond"), pod výsledkem kalkulačky, u náhledu návodu, sticky lišta.

**Po odeslání:** viz §7.

---

## 3. Značka a vizuální směr

- **Značka:** „Indexák" (pracovní název; doména se ověří, do té doby `*.vercel.app`). Interaktivní prvek: „Najdi dvojče".
- **Tón:** věcný, sebevědomý, krátké věty, bez superlativů a slibů výnosů. Vykání. Žádné úsečné „Tři fondy. Stejné akcie. Jiná cena." šablony – věty mají znít jako od člověka.
- **Vizuální směr: „tržní strana novin".** Papírově bílé pozadí, černá typografie, jediná signální barva (tmavě zelená), tickery a čísla v neproporcionálním písmu s tabulkovými číslicemi. Žádné fialové přechody, glassmorphism ani ikonky v kartičkách.
- **Hlavní motiv:** dvojice tickerů spojená šipkou `VOO ⇄ SPYL`. Opakuje se v reklamách, hero, kartách i v PDF.
- **Mobile first:** návrh pro 390×844; desktop je rozšíření.
- **Přístupnost:** kontrast min. WCAG AA, ovládání klávesnicí, popisky polí, `prefers-reduced-motion`.
- **Ochranné známky:** názvy a tickery fondů jen popisně, bez log vydavatelů; v patičce „Ochranné známky patří jejich vlastníkům; stránka s vydavateli fondů nespolupracuje."

---

## 4. Struktura stránky a pořadí sekcí

| # | Sekce | Otázka návštěvníka |
|---|---|---|
| 1 | **Hero (první obrazovka)** – nadpis dle varianty reklamy (§9), podnadpis s přínosem, **karta odpovědi S&P 500** (originály NYSE + dvojčata, TER, zdroj), **e-mailový formulář** „Pošlete mi návod" | „Jsem tu správně a co tu dostanu?" |
| 2 | **Další fondy** – čipy VTI / VT / SCHD → karta s originálem, dvojčaty (nebo poctivým „přesné dvojče neexistuje") a odkazem „Poslat návod pro tento fond" | „A co můj fond?" |
| 3 | **Kalkulačka „Kolik stojí poplatky"** – dvojčata mezi sebou + srovnávací řádek fondu s poplatkem 1,5 % p.a.; pod výsledkem formulář | „Kolik to dělá v penězích?" |
| 4 | **„Proč VOO u evropského brokera nekoupíte"** – PRIIPs/KID ve 3 větách, výjimky (stávající držitelé, profesionální klienti) | „Proč bych tomu měl věřit?" |
| 5 | **Co je v návodu** – náhled stran PDF (logotypy brokerů jen textem), výčet obsahu, formulář | „Co přesně dostanu?" |
| 6 | **FAQ** – zdarma? spam? co je KID? kdo za tím stojí a co se stane s mými údaji? | „Kde je háček?" |
| 7 | **Patička** – provozovatel (firma, IČO, sídlo, kontakt), informace o předávání kontaktů partnerům, disclaimery, ochranné známky, odkazy na zásady a nastavení cookies | „Kdo to provozuje?" |

**Karta odpovědi v hero (kompaktní, 3 řádky dvojčat):**
- Řádek „Originál (NYSE Arca): VOO 0,03 % · SPY 0,09 % · IVV 0,03 %".
- Dvojčata seřazená podle TER: SPYL 0,03 % · VUAA 0,07 % · CSPX 0,07 % – u každého ticker, akumulace, a ISIN se zobrazí po ťuknutí.
- Řádek zdroje „Zdroj: vydavatelé fondů, k {datum}".

**Rozpočet první obrazovky (390×844):** nadpis (2 řádky) + podnadpis (2 řádky) + karta (cca 180 px) + pole a tlačítko. Při implementaci se ověří, že se tlačítko vejde nad ohyb; pokud ne, zkrátí se podnadpis, karta se nezkracuje.

**Zdůvodnění pořadí (do README):** studený návštěvník z reklamy rozhoduje během pár sekund, proto první obrazovka obsahuje slib reklamy, odpověď i formulář najednou – k odeslání není potřeba žádná interakce. Hodnota je ukázaná (které dvojče, za kolik), ale ne kompletní (jak ho koupit u mého brokera) – právě tu mezeru zaplňuje návod. Další sekce slouží těm, kdo ještě nejsou rozhodnutí, v pořadí jejich otázek: můj fond → kolik to dělá → proč věřit → co dostanu → háček → kdo to provozuje. Každá má vlastní cestu ke kontaktu.

**Sticky lišta (mobil):** viditelná od začátku, skrytá jen tehdy, když je ve viewportu některý formulář. Text „Pošlete mi návod zdarma", skočí na nejbližší formulář.

### Cesta od každého prvku ke kontaktu (tabulka do README)
| Prvek | Cesta ke kontaktu | Událost |
|---|---|---|
| Karta odpovědi S&P 500 (hero) | formulář přímo pod ní (0 interakcí) | `form_viewed{placement:hero}` |
| Karty dalších fondů | odkaz „Poslat návod pro tento fond" → fokus do nejbližšího formuláře s předvyplněným fondem | `card_cta_clicked{pair}` |
| Kalkulačka | formulář pod výsledkem | `form_viewed{placement:calc}` |
| Náhled návodu | formulář v sekci | `form_viewed{placement:preview}` |
| Sticky lišta | skok na nejbližší formulář | `sticky_cta_clicked` |

---

## 5. Interaktivní prvky

### 5.1 Karta odpovědi a karty dalších fondů
- **S&P 500 (VOO / SPY / IVV):** dvojčata SPYL, VUAA, CSPX (vše fyzická replikace, Irsko, akumulační).
- **VT (celý svět):** dvojčata/alternativy SPYY (MSCI ACWI), VWCE (FTSE All-World), FWRA – u každého index, protože se mírně liší.
- **VTI (celý US trh):** „Přesné dvojče neexistuje"; nejbližší alternativa SPDR Russell 3000 UCITS (ověří se TER u SSGA), s vysvětlením rozdílu indexu.
- **SCHD:** „UCITS fond na index Dow Jones U.S. Dividend 100 neexistuje"; ukáže se nejbližší dividendová alternativa s jasným „jiný index" a kalkulačka se pro SCHD nenabízí.
- **Vyřazeno:** syntetické (swapové) fondy – jejich náklady nelze poctivě srovnat jen podle TER.
- Řazení podle TER, formulace „nejnižší poplatek (TER)", ne „nejlevnější" ani „nejlepší".
- U každého fondu odkaz na zdroj, datum a odkaz na KID vydavatele.

### 5.2 Kalkulačka „Kolik stojí poplatky"
- **Vstupy:** měsíční vklad (výchozí 3 000 Kč, 500–50 000 Kč), horizont (výchozí 20 let, 5–40 let), skupina fondů (S&P 500 / celý svět).
- **Model (ilustrativní, ne příslib):** modelové roční zhodnocení indexu R = 7 % p.a. před náklady.
  - Rᵢ = R − TERᵢ; rᵢ = (1 + Rᵢ)^(1/12) − 1; FVᵢ = C · ((1 + rᵢ)ⁿ − 1) / rᵢ (vklady na konci měsíce).
  - **Zaplaceno na poplatcích** u fondu i = FV(TER = 0) − FVᵢ.
- **Výstup:**
  - celkem vloženo,
  - pro každé dvojče: zaplaceno na poplatcích (Kč),
  - **srovnávací řádek: „fond s poplatkem 1,5 % p.a. (příklad)"** – dává rozdílu mezi ETF kontext; neoznačuje se jako „typický", pokud k tomu nebude zdroj.
  - Ilustrativně (výchozí parametry): SPYL vs VUAA ≈ 6 870 Kč; fond s 1,5 % zaplatí řádově přes 200 000 Kč. Přesná čísla spočítá kód z ověřených TER.
- **Nemodelujeme** (poznámka pod výsledkem): poplatky brokera, kurzové konverze, spready, daně, tracking difference.
- **Proč kalkulačka nesrovnává originál s dvojčetem (do README):** VOO má TER 0,03 %, takže by ukázala nulový nebo záporný rozdíl a návštěvník originál stejně koupit nemůže. Smysl má srovnání toho, co koupit **může**.

### 5.3 Daně (opravený text pro stránku, PDF i README)
- Srážková daň z amerických dividend je srovnatelná: irský fond platí 15 %, Čech u amerického ETF s formulářem W-8BEN také 15 %.
- Rozdíl je v české dani: u amerického ETF jsou výplaty dividend zdaněny každý rok (s povinností je přiznat), u **akumulačního** irského dvojčete se dividendy reinvestují uvnitř fondu a při prodeji po 3 letech (časový test) je zisk osvobozen. Pro českého investora je tedy akumulační dvojče daňově spíš výhodnější.
- Obecná informace, ne daňové poradenství; odkaz na zdroj.

**Záměrně nezařazeno:** skládání portfolia / kvíz „jaký jste investor" – personalizovaný výběr fondů se blíží investičnímu doporučení.

---

## 6. Data a zdroje

- **Soubor:** `src/data/etf-pairs.json` – jediný zdroj pro stránku, kalkulačku, PDF i reklamy.
- **Struktura hodnoty:** `{ value, sourceUrl, asOf }` pro každé pole (TER, ISIN, domicil, distribuce, replikace, index, burza).
- **Primární zdroje:** stránky a factsheety vydavatelů. Agregátory jen ke kontrole – hodnota ověřená jen agregátorem se před spuštěním ověří u vydavatele.
- **Ověřeno při revizi (k 11. 10. 2026):**

| Fond | TER | Burza / ISIN | Zdroj |
|---|---|---|---|
| VOO | 0,03 % | NYSE Arca | Vanguard factsheet F0968 |
| SPY | 0,0945 % (zobrazit 0,09 %) | NYSE Arca | ssga.com |
| IVV | 0,03 % | NYSE Arca | ishares.com |
| VTI | 0,03 % | NYSE Arca | Vanguard F0970 |
| VT | 0,06 % | NYSE Arca | Vanguard F3141 |
| SCHD | 0,06 % | NYSE Arca | schwabassetmanagement.com |
| SPYL | 0,03 %, akum. | IE000XZSV718 | ssga.com |
| VUAA | 0,07 %, akum. | IE00BFMXXD54 | Vanguard factsheet |
| CSPX | 0,07 %, akum. | IE00B5BMR087 | iShares factsheet |
| VWCE | 0,14 % (od 28. 7. 2026) | IE00BK5BQT80 | vanguard |
| SPYY | 0,12 % | IE00B44Z5B48 | agregátor → ověřit u SSGA |
| FWRA | 0,15 % | IE000716YHJ7 | agregátor → ověřit u Invesco |
| SPDR Russell 3000 UCITS | ověřit | IE00BKY7WX37 | ověřit u SSGA |

- **PRIIPs (ověřeno):** od 2018 vyžaduje KID u produktů pro retail v EU; američtí poskytovatelé ho nevydávají, proto je EU brokeři retailu nenabízejí. Stávající držitelé mohou držet a prodat; nové nákupy jen profesionální klienti. Zdroje: justETF, LYNX (KID), ESMA.
- **QQQ:** obchoduje se na Nasdaqu – doloží se prospektem z SEC.
- **Údaje o brokerech (do PDF):** dostupnost konkrétních dvojčat, ISIN/ticker, poplatek za nákup – ověří se přímo na stránkách brokerů k datu v PDF. Neověřitelný údaj se do PDF nedá.
- **Aktualizace:** ruční, měsíčně, podle checklistu v README (TER, data brokerů).

---

## 7. Formulář, Brevo a cesta po odeslání

### 7.1 Formulář
- Jedno pole `email` + tlačítko „Pošlete mi návod".
- Text pod tlačítkem (souhlas ve formuláři, ne až v e-mailu): „Pošleme vám návod a občas tipy k investování do ETF. Odhlásíte se jedním klikem. Provozovatel a zpracování údajů: [odkaz]." Přesné znění schválí právník (§16).
- Skrytá pole: `pair`, `calc_deposit`, `calc_horizon`, `placement` (`hero` / `card` / `calc` / `preview`), UTM parametry, `aid`, `consent_text_version`, `consent_marketing` (stav cookie souhlasu), honeypot.
- Validace e-mailu na klientu i serveru.
- Funguje i bez JavaScriptu (nativní POST, server vygeneruje `aid`, redirect 303).

### 7.2 Backend (Astro API routes, `src/pages/api/*.ts`, `prerender = false`)
- **`POST /api/subscribe`** (přijímá JSON i `x-www-form-urlencoded`):
  - honeypot, kontrola `Origin`, rate limit přes Upstash (`@upstash/ratelimit`, např. 5 / IP / 10 min),
  - Brevo `POST /v3/contacts/doubleOptinConfirmation` s `templateId`, `includeListIds`, `redirectionUrl = {SITE_URL}/potvrzeno?aid={aid}`, atributy (pár, kalkulačka, UTM, umístění, AID, verze a čas souhlasu); atributy předem založené v Brevu,
  - duplicitní kontakt (400) → úspěch,
  - se souhlasem s marketingovým měřením odešle `Lead` do Meta Conversions API (`event_id` sdílené s Pixelem pro deduplikaci, e-mail lowercase + SHA-256, `action_source: website`); bez souhlasu nebo bez JS se CAPI neposílá,
  - JSON: `{ ok, error? }`; formulář bez JS: redirect na `/dekujeme?aid=…` nebo `/?error=…#form`.
- **`POST /api/profile`** – uloží doplňky po odeslání (broker, telefon + souhlasy) jako samostatný záznam přes `POST /v3/contacts` s `updateEnabled: true`, párováno přes atribut `AID` (kontakt z double opt-in v tu chvíli ještě nemusí existovat). Telefon v atributu `SMS` ve formátu `+420…`; chyba „číslo už má jiný kontakt" se ošetří.
- Proměnné prostředí v `.env.example` (§10).

### 7.3 Cesta
1. **`/dekujeme?aid=…`** (ihned):
   - „Ještě jeden klik: potvrďte e-mail" + tlačítka „Otevřít Gmail" / „Otevřít Seznam Email".
   - **Okamžitá hodnota:** „U kterého brokera máte účet?" – 4 čipy (XTB, Trading 212, Fio, Degiro, + „Zatím žádný"). Po ťuknutí se hned ukáže, která S&P 500 dvojčata u něj najde a jejich ISIN/ticker (z ověřených dat). Volba se uloží k profilu (`/api/profile`) – Clientelo ji využije při kvalifikaci.
   - **Nepovinný telefon:** „Chcete pomoct s prvním nákupem? Zavoláme vám a projdeme postup u vašeho brokera, bez doporučování konkrétních fondů." Uvedeno, kdo volá (provozovatel). Jedno pole + **dva samostatné nezaškrtnuté souhlasy:** (a) telefonický kontakt provozovatelem, (b) předání údajů jmenovitě uvedeným partnerům (seznam v zásadách). Odeslat lze s (a) i bez (b).
2. **Potvrzovací e-mail (Brevo šablona s `{{ params.DOIurl }}`):** předmět „Potvrďte a návod je váš", jedno tlačítko.
3. **`/potvrzeno?aid=…`:** okamžité stažení PDF + nabídka telefonu (zobrazí se vždy, s textem „Pokud jste telefon už zadali, nemusíte nic dělat"; potvrzení často probíhá na jiném zařízení).
4. **E-mail s návodem:** Brevo automatizace po přidání do seznamu.
- `/dekujeme` a `/potvrzeno` mají `noindex`.

### 7.4 Telefonát (provozní podmínka, ne kód)
- Clientelo použije písemný skript bez osobních investičních doporučení (jen postup v aplikaci brokera, obecné informace). Do README a §16.

### 7.5 PDF návod
- Generuje se z `etf-pairs.json` (+ `brokers.json`) pomocí `@react-pdf/renderer` při buildu (čistý JS, běží na Vercelu), se zaregistrovaným TTF fontem s českou diakritikou. Čísla v PDF a na stránce jsou vždy totožná.

---

## 8. Měření

### 8.1 Nástroje
- **PostHog EU cloud** (`eu.i.posthog.com`), `person_profiles: 'identified_only'`, DPA.
  - **Bez souhlasu:** `cookieless_mode`, jen anonymní agregované události bez trvalého ID (stránka, kroky trychtýře, varianta reklamy) – dají spočítat konverzi a odpad mezi kroky na úrovni varianty.
  - **Se souhlasem s analytikou:** připojí se `aid` → propojení celé cesty včetně `/dekujeme` a `/potvrzeno`.
  - Právní posouzení režimu bez souhlasu je součástí §16.
- **Meta Pixel + CAPI, GA4 (Consent Mode v2)** – jen po souhlasu; Meta má v cookie liště vlastní účel („sdílení s Meta pro měření reklam").
- **Brevo** – zdroj pravdy pro počet kontaktů a potvrzení (událost `doi_confirmed` může být nadhodnocená kvůli bezpečnostním skenerům pošty).

### 8.2 Cookie lišta
- Tlačítka „Odmítnout" a „Přijmout" stejně výrazná, nastavení po účelech (analytika / Meta / GA4), záznam verze textu a času, odkaz „Nastavení cookies" v patičce.

### 8.3 Události
| # | Událost | Parametry |
|---|---|---|
| 1 | `page_view` | utm_source, utm_campaign, utm_content, hero_variant |
| 2 | `form_viewed` | placement |
| 3 | `form_started` | placement |
| 4 | `form_submitted` / `form_error` | placement / error_type |
| 5 | `thankyou_viewed` | |
| 6 | `broker_selected` | broker |
| 7 | `phone_submitted` | page, consent_partners |
| 8 | `doi_confirmed` | |
| 9 | `pdf_downloaded` | |
| – | `pair_selected`, `card_cta_clicked`, `calc_used`, `calc_result_viewed`, `sticky_cta_clicked`, `faq_opened`, `source_link_clicked`, `scroll_depth` | |

### 8.4 Metriky (podle varianty reklamy)
- **Konverze** = `form_submitted` / unikátní návštěvníci (hlavní KPI), rozpad podle `placement`.
- Míra potvrzení double opt-in (Brevo), míra telefonů z leadů, podíl leadů s vybraným brokerem.
- Odpad mezi kroky; kolik konverzí přišlo z hero vs. níže.

### 8.5 Výkon
- LCP < 1,5 s na mobilu (4G), CLS < 0,1, analytika async po vykreslení. Výsledky Lighthouse v README.

---

## 9. Reklamy

Meta (Instagram + Facebook), 4:5 a 9:16, vizuálně ve stylu stránky s motivem dvojice tickerů. Obě vedou na stejnou URL; podle `utm_content` se mění nadpis a podnadpis hero, karta S&P 500 a formulář zůstávají. Kampaň v kategorii Financial products and services; počítat s omezeními Meta pro finanční weby (Core Setup).

### Verze A – „Problém"
- **Vizuál:** čip `VOO` s poznámkou „u evropského brokera nedostupné" → šipka → `SPYL · VUAA · CSPX`.
- **Primární text:** „Hledali jste u brokera VOO a nenašli ho? Není to chyba. Evropská pravidla brání brokerům prodávat americké ETF drobným investorům. Na stejný index S&P 500 ale existují evropské fondy. Podívejte se, které to jsou a co stojí."
- **Titulek:** „VOO u evropského brokera nekoupíte. Tady je náhrada."
- **Tlačítko:** Více informací
- **Hero A:** „U evropského brokera VOO jako drobný investor nekoupíte. Jeho evropské dvojče ano." / podnadpis: „Níže vidíte, které fondy sledují stejný index a kolik stojí. Návod, jak je koupit u vašeho brokera, vám pošleme zdarma."

### Verze B – „Praktický návod"
- **Vizuál:** stylizovaný řádek vyhledávání v aplikaci brokera s ISIN `IE000XZSV718` a nápisem „S&P 500 · TER 0,03 %"; pod tím jména brokerů textem (bez log).
- **Primární text:** „Máte účet u XTB, Trading 212, Fio nebo Degira a chcete investovat do S&P 500? Nemusíte hledat ve stovkách fondů. Pošleme vám přesný ISIN a postup pro vašeho brokera."
- **Titulek:** „S&P 500 u vašeho brokera: přesný ISIN a postup"
- **Tlačítko:** Získat návod
- **Hero B:** „S&P 500 u vašeho brokera: který fond vybrat a jak ho najít." / podnadpis: „Tři evropské fondy na S&P 500 a jejich poplatky vidíte hned. Postup pro XTB, Trading 212, Fio a Degiro vám pošleme e-mailem."

**Výchozí hero (bez UTM):** totožný s variantou A.

**Výstupy:** PNG obou verzí ve 4:5 a 9:16 v `/ads`, texty v README. Žádné sliby výnosů, provozovatel uveden v profilu stránky na Meta.

---

## 10. Architektura a technologie

- **Astro 5** (`output: 'static'`, API routes s `export const prerender = false`), `@astrojs/vercel`, React ostrůvky, TypeScript, SCSS.
- **Hosting:** Vercel. Pro hodnocení zadání stačí bezplatný tarif; **ostrá komerční kampaň musí běžet na tarifu/účtu Clientela** (Hobby je jen pro nekomerční použití).
- **Stránky:** `/`, `/dekujeme`, `/potvrzeno`, `/zasady-ochrany-osobnich-udaju`, `/cookies`, `404`.
- **Meta a SEO:** OG obrázek 1200×630, favicon, `noindex` pro děkovací stránky.
- **Bezpečnost:** CSP v `vercel.json` (PostHog EU, `connect.facebook.net`, `googletagmanager.com`, inline skripty přes hashe).
- **Proměnné prostředí (`.env.example`):** `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_DOI_TEMPLATE_ID`, `META_PIXEL_ID`, `META_CAPI_TOKEN`, `META_TEST_EVENT_CODE`, `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST`, `PUBLIC_GA4_ID`, `SITE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

| Jednotka | Účel | Rozhraní | Závisí na |
|---|---|---|---|
| `data/etf-pairs.json`, `data/brokers.json` + `lib/pairs.ts` | data a typy | `getPair(id)`, `sortByTer()`, `twinsAtBroker(broker, group)` | – |
| `lib/calc.ts` | čistý výpočet | `computeFees(funds, deposit, years, R)` | – |
| `lib/consent.ts` | stav souhlasu po účelech | `getConsent()`, `onConsentChange()` | – |
| `lib/track.ts` | analytika podle souhlasu | `track(event, props)`, `getAid()` | PostHog, consent |
| `AnswerCard` | karta S&P 500 v hero | – | pairs, track |
| `FundPicker` + `FundCard` | další fondy | `onCta(pairId)` | pairs, track |
| `FeeCalculator` | kalkulačka | `group` | calc, track |
| `LeadForm` | e-mailový formulář | `placement`, kontext | track, `/api/subscribe` |
| `BrokerPicker` | výběr brokera na `/dekujeme` | – | pairs, `/api/profile` |
| `PhoneOffer` | nepovinný telefon | `page` | track, `/api/profile` |
| `StickyCta`, `ConsentBanner` | – | – | track / consent |
| `api/subscribe.ts` | Brevo DOI + CAPI | POST | Brevo, Meta, Upstash |
| `api/profile.ts` | broker, telefon, souhlasy | POST | Brevo, Upstash |
| `scripts/build-pdf.tsx` | PDF návod | – | pairs, brokers |

---

## 11. Chybové stavy

- Neplatný e-mail → hláška u pole.
- Brevo chyba → e-mail zůstane vyplněný, „Něco se nepovedlo, zkuste to znovu", `form_error`, log.
- Duplicitní kontakt → úspěch (chování Brevo se ověří testem).
- Honeypot → tichý „úspěch" bez kontaktu.
- Rate limit / cizí `Origin` → obecná chyba.
- Neplatný telefon / číslo u jiného kontaktu → hláška u pole; bez souhlasu (a) se neodešle.
- Bez JavaScriptu → hero karta a formulář fungují (POST + redirect 303, chyba přes `?error=`).
- Chybějící `aid` → server vygeneruje nové.

---

## 12. Testování

- **Jednotkové (Vitest):** `calc.ts` (známé hodnoty: 3 000 Kč/20 let/7 % → SPYL vs VUAA ≈ 6 870 Kč; krajní rozsahy; TER = 0), `pairs.ts` (každá hodnota má `sourceUrl` a `asOf`; žádný syntetický fond), validace e-mailu a telefonu.
- **API:** `subscribe` a `profile` s mockem Brevo/Meta/Upstash – úspěch, duplicita, chyba, honeypot, limit, JSON i form-encoded, CAPI jen se souhlasem.
- **E2E (Playwright, 390×844):** formulář v hero je nad ohybem; varianty `utm_content=a/b` a bez UTM; odeslání z hero → `/dekujeme` → výběr brokera → telefon se souhlasem (a) bez (b); analytické události ověřené zachycením síťových požadavků; běh bez JS. E2E nevolá ostré Brevo (testovací seznam / mock).
- **Ruční:** reálný double opt-in (Gmail, Seznam), doručení PDF, kontrola v Brevu, Meta Events Manager s test kódem, Lighthouse mobile, reálné telefony (iOS Safari, Android Chrome).

---

## 13. Očekávaná konverze (odhad týmu, ověří se daty)

| Metrika | Odhad | Zdůvodnění |
|---|---|---|
| Návštěvník → odeslaný e-mail | **3–6 %** | studený mobilní provoz z Meta ve financích; zvyšuje: formulář na první obrazovce, jediné pole, praktický lead magnet; snižuje: finance, pár sekund pozornosti |
| Odeslání → potvrzení DOI | **50–65 %** | potvrzení často na jiném zařízení, Seznam |
| Lead → telefon | **3–8 %** | nepovinné, nabídnuto dvakrát |

README uvede, že jde o odhad, ne benchmark se zdrojem, a že první vyhodnocení má smysl po cca 1 000 návštěvách na variantu.

---

## 14. A/B hypotézy (seřazené podle očekávaného dopadu)

1. **Lead magnet:** „Návod ke koupi u vašeho brokera" vs. „Tahák všech dvojčat". Nabídka je největší páka konverze; čekáme výrazný rozdíl. Metrika: konverze; sekundárně míra telefonů.
2. **Umístění formuláře:** formulář na první obrazovce pod odpovědí vs. až pod kalkulačkou. Čekáme vyšší konverzi u hero; hlídáme míru potvrzení DOI (kvalitu). Metrika: konverze, DOI.
3. **Doručení PDF:** ke stažení hned na `/dekujeme` vs. až po potvrzení e-mailu. Okamžitá hodnota může zvýšit spokojenost a telefony, ale snížit míru potvrzení. Metrika: kontakty použitelné pro telefonát (potvrzené nebo s telefonem). Varianta „hned" vyžaduje souhlas právníka s jiným nastavením souhlasů.

Ke každé hypotéze README uvede očekávaný efekt a potřebný vzorek. Test reklam A vs. B běží paralelně na úrovni kreativ v Meta.

---

## 15. Klíčová rozhodnutí do README

- Výklad zadání „NYSE + evropská dvojčata" (§0) – první odstavec README.
- PRIIPs: proč americké ETF u evropského brokera drobný investor nekoupí (a výjimky), se zdroji.
- Proč lead magnet je návod ke koupi u brokera (jediná hodnota, kterou stránka zdarma nedává).
- Proč formulář na první obrazovce a tabulka „prvek → cesta ke kontaktu".
- Proč kalkulačka srovnává dvojčata mezi sebou + řádek fondu s 1,5 % a proč ne originál vs. dvojče.
- Daně: srovnatelná srážková daň, akumulace + časový test zvýhodňují dvojče (§5.3).
- Proč chybí QQQ (Nasdaq) a syntetické fondy.
- Proč reklama B nestaví na čísle v korunách (rozdíl mezi dvojčaty S&P 500 je jen cca 6 900 Kč na 20 let).
- Proč není skládání portfolia ani kvíz (investiční doporučení).
- Proč telefon až po e-mailu a proč dva oddělené souhlasy.
- Měření: anonymně bez souhlasu, propojení cesty po souhlasu.
- Zdůvodnění pořadí sekcí (§4), očekávaná konverze (§13), A/B hypotézy (§14), texty reklam (§9), checklist aktualizace dat a checklist před spuštěním (§16), otevřený stav „připraveno, blokuje: …".

---

## 16. Checklist před spuštěním reklamy

- [ ] Clientelo souhlasí s uvedením jako provozovatel / správce (firma, IČO, sídlo, kontakt na stránce, v e-mailech i v zásadách). Nikdy vymyšlený subjekt.
- [ ] Právník Clientela schválí: text souhlasu ve formuláři, dva souhlasy u telefonu, seznam partnerů, zásady, cookie lištu, režim analytiky bez souhlasu, formulace o PRIIPs a daních.
- [ ] Skript telefonátu bez osobních investičních doporučení.
- [ ] Vercel: tarif/účet Clientela pro komerční provoz; ideálně vlastní doména.
- [ ] Brevo: tarif s dostatečným denním limitem (bezplatný má 300 e-mailů/den), ověřená odesílací doména (SPF/DKIM), atributy, šablona DOI, seznam, automatizace s PDF otestované.
- [ ] Data fondů ověřena u vydavatelů ke dni spuštění; data brokerů ověřena na jejich stránkách.
- [ ] Meta: Pixel + CAPI ověřené v Events Manageru, kategorie Financial products and services, kontrola Core Setup.
- [ ] Lighthouse mobile splňuje §8.5; E2E testy zelené na produkční URL.

---

## 17. Mimo rozsah

- Obsahová e-mailová sekvence po návodu (dělá Clientelo).
- Napojení na CRM / software Clientela.
- Další jazykové verze, QQQ a další páry, další brokeři.
