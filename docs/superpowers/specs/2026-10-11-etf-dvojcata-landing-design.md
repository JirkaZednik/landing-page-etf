# Indexák – „Najdi evropské dvojče" · Návrh řešení (spec)

- **Datum:** 2026-10-11
- **Zadání:** Zadání B – konverzní landing page (srovnání ETF obchodovaných na NYSE pro českého drobného investora)
- **Pro:** Clientelo (clientelo.cz) – stránka běží pod vlastní fiktivní spotřebitelskou značkou, ne pod značkou Clientelo
- **Stav:** návrh schválený po sekcích v konverzaci, čeká na revizi této specifikace

---

## 0. Kontext a cíl

**Ze zadání (výslovně):**
- Lead magnet: nabídnout hodnotu a výměnou získat kontakt. Úspěch = počet kontaktů a odpověď na otázku „mohli bychom na ni zítra spustit reklamu?".
- Návštěvník: český drobný investor, přichází z reklamy na mobilu, věnuje stránce jen pár sekund.
- Obsah: srovnání ETF obchodovaných na NYSE, se skutečnými daty a uvedeným zdrojem.
- Hodnota zřejmá ještě před formulářem; první obrazovka navazuje na slib reklamy.
- Interaktivní prvky volíme sami, každý vede ke kontaktu. Formulář s minimem polí. Promyšlené, co návštěvník dostane po odeslání.
- Měření celé cesty od příchodu po odeslání formuláře.
- Výstupy: 2 verze reklamy, README (zdůvodnění pořadí sekcí, očekávaná konverze, 3 A/B hypotézy seřazené podle dopadu), nasazení na bezplatný hosting (Vercel).
- Design ani texty nesmí působit jako generický výstup AI.

**Upřesněno se zadavatelem:**
- Fiktivní spotřebitelský portál v duchu portálů Clientela.
- Kontakty jdou do Brevo (bezplatný tarif, double opt-in, automatický e-mail s lead magnetem).
- Formulář jen s e-mailem. Nepovinný telefon až na děkovací stránce (Clientelo kvalifikuje leady po telefonu).
- Patička a disclaimery ve stylu Clientela: informativní obsah, není investiční doporučení, riziko ztráty, GDPR.
- Srovnání pojmout jako „NYSE fond + jeho evropské (UCITS) dvojče" (varianta A).
- QQQ vynechat.

**Předpoklady:**
- Stránka v češtině.
- Provozovatelem a správcem osobních údajů uvedeným v patičce bude reálný subjekt (navrženo Clientelo Czech s.r.o.) – vyžaduje souhlas Clientela, viz §16.

---

## 1. Cílová skupina

**Primární:** začínající až mírně pokročilý český drobný investor, 25–45 let, na mobilu. Slyšel o „ETF na S&P 500" (VOO, SPY) z YouTube, Redditu, podcastů nebo od kamarádů, chce pravidelně investovat menší částky (typicky stovky až nízké tisíce Kč měsíčně), účet u brokera má nebo si ho zakládá (XTB, Trading 212, Fio, Degiro…).

**Jeho situace a bolest:** u evropského brokera americké ETF nenajde, nebo neví, kterou z mnoha evropských verzí vybrat. Nechce studovat, chce rychlou a důvěryhodnou odpověď.

**Co ho přesvědčí:** konkrétní odpověď během pár sekund, věcný tón bez slibů výnosů, viditelný zdroj dat.

**Co ho odradí:** dlouhý formulář, slib „zbohatnete", pocit, že ho chce někdo něco prodat, nečitelná tabulka na mobilu.

---

## 2. Nabídka: co návštěvník dostane a kdy si řekneme o kontakt

**Zdarma, bez kontaktu (hodnota před formulářem):**
- Pro zvolený NYSE fond okamžitě jeho evropská dvojčata se srovnáním TER, domicilu, ISIN a akumulace/distribuce.
- Kalkulačka: kolik stojí rozdíl v poplatcích mezi dvojčaty na zvoleném horizontu (hlavní číslo vidí hned).

**Za e-mail (lead magnet):**
- **PDF tahák „Americké ETF a jejich evropská dvojčata"** (2–3 strany): všechny páry s TER a ISIN, akumulace vs. distribuce, jak fond najít u brokera podle ISIN, dostupnost u českých brokerů s datem ověření.
- Vlastní výpočet z kalkulačky e-mailem.

**Moment žádosti:** přímo pod výsledkem kalkulačky, kdy je zvědavost nejvyšší (hodnota už byla ukázána, ale není kompletní). Druhé místo: sekce s náhledem taháku. Na mobilu sticky lišta „Získat tahák zdarma" po odscrollování hero.

**Po odeslání:** viz §7 (okamžitá hodnota na děkovací stránce, nepovinný telefon, PDF po potvrzení e-mailu).

---

## 3. Značka a vizuální směr

- **Značka:** „Indexák" (pracovní název; dostupnost domény se ověří, do té doby `*.vercel.app`). Interaktivní prvek: „Najdi dvojče".
- **Tón:** věcný, sebevědomý, krátké věty, bez superlativů a slibů výnosů. Oslovení: vykání (finanční téma, širší věkové rozpětí).
- **Vizuální směr: „tržní strana novin".** Papírově bílé pozadí, černá typografie, jediná signální barva (tmavě zelená), tickery a čísla v neproporcionálním písmu s tabulkovými číslicemi. Žádné fialové přechody, glassmorphism ani ikonky v kartičkách.
- **Hlavní motiv:** dvojice tickerů spojená šipkou `VOO ⇄ VUAA`. Opakuje se v reklamě, hero, kartě výsledku i v PDF.
- **Mobile first:** návrh pro šířku 390 px; desktop je rozšíření, ne opak.
- **Přístupnost:** kontrast min. WCAG AA, ovládání klávesnicí, popisky polí, `prefers-reduced-motion`.

---

## 4. Struktura stránky a pořadí sekcí

| # | Sekce | Otázka návštěvníka, na kterou odpovídá |
|---|---|---|
| 1 | **Hero** – nadpis přebírá slib reklamy (varianta A/B dle `utm_content`), mřížka 4 dlaždic NYSE fondů, mikrořádek „Bez registrace · data k {datum} · zdroj: vydavatelé fondů". Bez formuláře. | „Jsem tu správně?" |
| 2 | **Karta dvojčete** – otevře se po ťuknutí na dlaždici: dvojčata, TER, domicil, ISIN, akumulace, zdroj. Tlačítko „Které dvojče je nejlevnější?" | „Co z toho mám?" |
| 3 | **Kalkulačka** – předvyplněná zvoleným párem; vklad + horizont → jedno velké číslo. **Pod výsledkem formulář #1.** | „Kolik to dělá v penězích?" |
| 4 | **„Proč VOO nekoupíte"** – PRIIPs/KID ve 3 větách + „kdo už drží, může držet a prodat". | „Proč bych tomu měl věřit?" |
| 5 | **Náhled taháku** – rozmazaná stránka PDF, výčet obsahu, **formulář #2**. | „Co přesně dostanu?" |
| 6 | **FAQ** (4–5 otázek: zdarma? spam? co je KID? kde to koupím? kdo za tím stojí?) | „Kde je háček?" |
| 7 | **Patička** – provozovatel, disclaimery ve stylu Clientela, odkazy na zásady. | „Kdo to provozuje?" |

**Zdůvodnění pořadí (půjde do README):** sekce kopírují pořadí otázek, které si studený návštěvník z reklamy klade. Formulář se objeví teprve tehdy, když je hodnota ukázaná (karta, číslo z kalkulačky), ale ještě ne kompletní – kompletní tahák je důvod nechat e-mail. Důvěryhodnostní sekce (4–6) jsou až za prvním formulářem, protože většina konverzí má přijít od lidí, kteří odpověď dostali rychle; sekce 4–6 slouží váhajícím a mají vlastní druhý formulář.

**Sticky lišta (mobil):** zobrazí se po odscrollování hero, text „Získat tahák zdarma", skočí na nejbližší formulář. Skryje se, když je formulář ve viewportu.

---

## 5. Interaktivní prvky

### 5.1 Mřížka „Najdi dvojče" (hero)
- 4 dlaždice: `VOO / SPY / IVV` (S&P 500), `VTI`, `VT`, `SCHD`.
- Ťuknutí → smooth scroll na kartu dvojčete, událost `pair_selected`.

### 5.2 Karta dvojčete
- Pro S&P 500: SPYL, VUAA, CSPX seřazené podle TER.
- U VTI a SCHD poctivě „Přesné dvojče neexistuje" + nejbližší alternativa s vysvětlením rozdílu (index, počet akcií).
- U každé hodnoty odkaz na zdroj a datum.

### 5.3 Kalkulačka „Které dvojče je nejlevnější?"
- **Vstupy:** měsíční vklad (posuvník + pole, výchozí 3 000 Kč, rozsah 500–50 000 Kč), horizont (výchozí 20 let, rozsah 5–40 let).
- **Model (ilustrativní):** modelové roční zhodnocení indexu R = 7 % p.a. před náklady, výslovně označené jako ilustrativní a ne příslib.
  - Čisté roční zhodnocení fondu i: Rᵢ = R − TERᵢ
  - Měsíční sazba: rᵢ = (1 + Rᵢ)^(1/12) − 1
  - Budoucí hodnota pravidelných vkladů C po n měsících: FVᵢ = C · ((1 + rᵢ)ⁿ − 1) / rᵢ
  - **Výsledek:** rozdíl FV nejlevnějšího a nejdražšího dvojčete v páru, zaokrouhleno na stovky Kč; sekundárně celková částka zaplacená na poplatcích u každého dvojčete.
- **Nemodelujeme** (uvedeno v poznámce pod výsledkem): poplatky brokera, kurzové konverze, spready, daně, tracking difference.
- Pro páry bez přesného dvojčete kalkulačka porovná dostupné alternativy, pokud jsou alespoň dvě; jinak tlačítko vede rovnou na formulář.
- **Proč kalkulačka porovnává dvojčata mezi sebou (do README):** srovnání „originál vs. dvojče" by ukázalo úsporu blízko nule nebo vyšší náklady dvojčete – VOO má TER 0,03 % a irské fondy platí z amerických dividend 15% srážkovou daň, zhruba tolik jako Čech u amerického ETF s W-8BEN. Rozdíl mezi dvojčaty navzájem (0,03 % vs. 0,07 %) je naopak skutečný, pro většinu lidí překvapivý a vede k otázce „které mám vzít?", na kterou odpovídá tahák. Jde o faktické srovnání nákladů, ne o doporučení konkrétního fondu.

**Záměrně nezařazeno:** skládání portfolia / kvíz „jaký jste investor" – personalizovaný výběr fondů se blíží investičnímu doporučení (compliance riziko pro Clientelo).

---

## 6. Data a zdroje

- **Soubor:** `src/data/etf-pairs.json` – jediný zdroj pro stránku, kalkulačku, PDF i reklamu B.
- **Struktura hodnoty:** `{ value, sourceUrl, asOf }` pro každé pole (TER, ISIN, domicil, distribuce, velikost fondu, burza).
- **Primární zdroje:** stránky vydavatelů (Vanguard, iShares/BlackRock, State Street, Invesco). Agregátory (justETF) jen ke kontrole.
- **Již ověřeno při návrhu:**
  - PRIIPs: od ledna 2018 vyžaduje KID u produktů pro retail v EU; američtí poskytovatelé ho nevydávají → EU brokeři je retailu nesmí nabízet; stávající držitelé mohou držet/prodat (justETF, quantroutine.com).
  - SPYL (State Street SPDR S&P 500 UCITS ETF Acc): TER 0,03 %, irský fond, UCITS (ssga.com).
  - VUAA (Vanguard S&P 500 UCITS ETF USD Acc): TER 0,07 %, ISIN IE00BFMXXD54, Irsko, akumulační (vanguard, etf.capital).
- **Ověří se při implementaci (krok „sběr dat"):** všechny ostatní hodnoty (VOO, SPY, IVV, VTI, VT, SCHD a jejich UCITS dvojčata/alternativy včetně CSPX, VWCE), vždy ze stránky vydavatele. Nic se nedoplňuje z paměti.
- **Burza:** zařazeny jen fondy s primárním listingem na NYSE Arca (ověří se u každého).
- **Dostupnost u českých brokerů:** jen v PDF s datem ověření, ne na stránce (mění se často).
- **Aktualizace:** ruční, měsíčně, podle checklistu v README. Živé API se nestaví (TER se mění zřídka).
- **Zobrazení:** u každé karty „Zdroj: {vydavatel}, k {datum}" s odkazem; v patičce souhrnný seznam zdrojů.

---

## 7. Formulář, Brevo a cesta po odeslání

### 7.1 Formulář
- Jedno pole `email` + tlačítko „Poslat mi tahák".
- Mikrotext: „Žádný spam, odhlásíte se jedním klikem." + odkaz na zásady zpracování údajů.
- Skrytá pole: `pair`, `calc_deposit`, `calc_horizon`, `placement` (`calc` / `preview`), UTM parametry, `aid` (anonymní ID návštěvy), honeypot.
- Validace e-mailu na klientu i serveru.

### 7.2 Backend
- Vercel serverless funkce `POST /api/subscribe`:
  - ověří honeypot a jednoduchý limit (např. max. 5 požadavků / IP / 10 min),
  - zavolá Brevo endpoint pro vytvoření kontaktu s double opt-in (šablona potvrzovacího e-mailu, cílový seznam, `redirectionUrl = /potvrzeno?aid={aid}`), atributy: pár, vstupy kalkulačky, UTM, umístění formuláře,
  - při souhlasu s marketingovými cookies pošle serverovou událost `Lead` do Meta Conversions API,
  - vrátí `{ ok: true }` nebo `{ ok: false, error }`.
- Vercel serverless funkce `POST /api/phone`: uloží telefon a záznam souhlasu (čas, text souhlasu, stránka) k existujícímu kontaktu v Brevu.
- API klíče jen v proměnných prostředí Vercelu.

### 7.3 Cesta
1. **`/dekujeme?aid=…`** (ihned po odeslání):
   - „Ještě jeden klik: potvrďte e-mail" + tlačítka „Otevřít Gmail" / „Otevřít Seznam Email".
   - Okamžitá hodnota bez čekání: kompletní srovnání zvoleného páru a výsledek kalkulačky.
   - Nepovinný telefon: „Chcete projít, jak začít? Krátký hovor zdarma, bez prodeje fondů." Jedno pole + **samostatný nezaškrtnutý souhlas** s telefonickým kontaktem a předáním údajů partnerům.
2. **Potvrzovací e-mail (Brevo šablona):** předmět „Potvrďte a tahák je váš", krátký text, jedno tlačítko. Text výslovně uvádí, k čemu potvrzením dává souhlas (zasílání taháku a obsahových e-mailů).
3. **`/potvrzeno?aid=…`** (po kliknutí v e-mailu): okamžité stažení PDF + druhá nabídka telefonu. Nabídka se zobrazí vždy (potvrzení často probíhá na jiném zařízení, takže stav nelze spolehlivě zjistit) s textem „Pokud jste telefon už zadali, nemusíte nic dělat". Opakované zadání v Brevu jen přepíše stejný atribut.
4. **E-mail s tahákem:** Brevo automatizace – přidání kontaktu do seznamu spustí e-mail s odkazem na PDF a výpočtem.

### 7.4 PDF tahák
- Generuje se z `etf-pairs.json` skriptem při buildu (HTML šablona → PDF), uložen jako statický soubor. Čísla v PDF a na stránce jsou tak vždy totožná.

---

## 8. Měření

### 8.1 Nástroje
- **PostHog v režimu bez cookies** (persistence v paměti, bez zápisu do prohlížeče) – celý trychtýř, funnely, dashboard. Bezplatný tarif a právní posouzení režimu bez cookies se ověří při implementaci.
- **Meta Pixel + Conversions API, GA4** – až po souhlasu v cookie liště.
- **Brevo** – zdroj pravdy pro počet kontaktů; README popíše porovnání s analytikou.

### 8.2 Propojení cesty
- `aid` (anonymní náhodné ID) se vytvoří při příchodu, posílá se ve formuláři, přenáší se v URL na `/dekujeme` a přes `redirectionUrl` Brevo na `/potvrzeno`. PostHog na každé stránce převezme `aid` jako distinct ID. Cesta reklama → lead → potvrzení → telefon je tak v jednom funnelu i při přechodu mezi stránkami a zařízeními.

### 8.3 Události
| # | Událost | Parametry |
|---|---|---|
| 1 | `page_view` | utm_source, utm_campaign, utm_content (varianta reklamy), hero_variant |
| 2 | `pair_selected` | pair |
| 3 | `calc_used` | deposit, horizon |
| 4 | `calc_result_viewed` | pair, result |
| 5 | `form_viewed` | placement |
| 6 | `form_started` | placement |
| 7 | `form_submitted` / `form_error` | placement / error_type |
| 8 | `thankyou_viewed` | |
| 9 | `phone_submitted` | page |
| 10 | `doi_confirmed` | |
| 11 | `pdf_downloaded` | |
| – | `sticky_cta_clicked`, `faq_opened`, `source_link_clicked`, `scroll_depth` | |

### 8.4 Metriky (vždy rozdělené podle varianty reklamy)
- **Konverze** = `form_submitted` / unikátní návštěvníci (hlavní KPI)
- **Míra potvrzení** double opt-in = `doi_confirmed` / `form_submitted`
- **Míra telefonů** = `phone_submitted` / `form_submitted`
- **Odpad mezi kroky** hero → pair → calc → form

### 8.5 Výkon
- Cíl: LCP < 1,5 s na mobilu (4G), CLS < 0,1. Analytika async po vykreslení. Výsledky Lighthouse v README.

---

## 9. Reklamy

Platforma Meta (Instagram + Facebook), formáty 4:5 (feed) a 9:16 (stories/reels), vizuálně ve stylu stránky s motivem dvojice tickerů. Obě vedou na stejnou URL; podle `utm_content` se mění jen nadpis hero (a u B se rovnou otevře kalkulačka).

### Verze A – „Problém"
- **Vizuál:** čip `VOO` s razítkem „V ČR nekoupíte" → šipka → `SPYL · VUAA · CSPX`.
- **Primární text:** „Hledali jste u brokera VOO a nenašli ho? Chyba to není. Evropská pravidla americké ETF drobným investorům nepovolují. Každé má ale evropské dvojče se stejným indexem. Najděte to své za 10 sekund."
- **Titulek:** „VOO v Česku nekoupíte. Jeho dvojče ano."
- **Tlačítko:** Zjistit více
- **Hero A:** „VOO v Česku nekoupíte. Jeho evropské dvojče ano."

### Verze B – „Peníze"
- **Vizuál:** tři identické křivky S&P 500, každá s jinou cenovkou TER, velké číslo „až {X} Kč rozdíl za 20 let" (ilustrativní).
- **Primární text:** „Tři fondy. Stejný index S&P 500. Stejné akcie. Jiná cena. Rozdíl v poplatcích vypadá malý, dokud ho nespočítáte na 20 let. Zjistěte, které evropské dvojče amerického ETF je nejlevnější."
- **Titulek:** „Stejný S&P 500, jiná cena. Které dvojče je nejlevnější?"
- **Tlačítko:** Spočítat
- **Hero B:** „Stejný S&P 500. Jiná cena. Spočítejte si rozdíl." + otevřená kalkulačka (S&P 500).
- **{X}** se spočítá kalkulačkou z ověřených TER s výchozími parametry (3 000 Kč/měsíc, 20 let, 7 % p.a. modelově) a v reklamě i na stránce je označené jako ilustrativní.

**Výstupy:** PNG obou verzí v obou formátech v `/ads`, texty v README.

---

## 10. Architektura a technologie

- **Framework:** Astro (statické HTML pro rychlý LCP) + React ostrůvky pro interaktivní části, TypeScript, SCSS.
- **Hosting:** Vercel (bezplatný tarif), serverless funkce pro `/api/*`.
- **Stránky:** `/`, `/dekujeme`, `/potvrzeno`, `/zasady-ochrany-osobnich-udaju`, `/cookies`.

**Jednotky (každá s jedním účelem):**
| Jednotka | Účel | Rozhraní | Závisí na |
|---|---|---|---|
| `data/etf-pairs.json` + `lib/pairs.ts` | data a typy, výběr páru | `getPair(id)`, `sortByTer()` | – |
| `lib/calc.ts` | čistý výpočet kalkulačky | `computeFeeGap(pair, deposit, years, R)` | – |
| `lib/track.ts` | tenký obal nad analytikou, consent-aware | `track(event, props)`, `getAid()` | PostHog, consent |
| `lib/consent.ts` | stav souhlasu s cookies | `getConsent()`, `onConsentChange()` | – |
| `TickerGrid` | dlaždice v hero | `onSelect(pairId)` | pairs, track |
| `TwinCard` | karta dvojčete | `pairId` | pairs, track |
| `FeeCalculator` | UI kalkulačky | `pairId`, `onResult` | calc, track |
| `LeadForm` | e-mailový formulář | `placement`, kontext (pair, calc) | track, `/api/subscribe` |
| `PhoneOffer` | nepovinný telefon | `page` | track, `/api/phone` |
| `StickyCta` | sticky lišta | – | track |
| `ConsentBanner` | cookie lišta | – | consent |
| `api/subscribe.ts` | Brevo DOI + CAPI | POST JSON | Brevo, Meta CAPI |
| `api/phone.ts` | uložení telefonu + souhlasu | POST JSON | Brevo |
| `scripts/build-pdf.ts` | generování taháku | – | pairs |

---

## 11. Chybové stavy

- Neplatný e-mail → hláška u pole, žádný request.
- Brevo nedostupné / chyba → e-mail zůstane vyplněný, „Něco se nepovedlo, zkuste to znovu", událost `form_error`, log na serveru.
- E-mail už v seznamu → chová se jako úspěch.
- Honeypot vyplněn → tiše „úspěch", kontakt se nevytvoří.
- Limit požadavků překročen → obecná chybová hláška.
- Telefon neplatný → hláška u pole; bez zaškrtnutého souhlasu se neodešle.
- JavaScript nedostupný → karta S&P 500 a formulář fungují jako statické HTML (formulář s nativním POST na `/api/subscribe` a redirectem).
- Chybějící `aid` v URL → vygeneruje se nové, cesta se jen nepropojí.

---

## 12. Testování

- **Jednotkové (Vitest):** `calc.ts` (známé hodnoty, krajní rozsahy, TER = 0), `pairs.ts` (každá hodnota má `sourceUrl` a `asOf`), validace e-mailu/telefonu.
- **API:** `subscribe` a `phone` s mockem Brevo – úspěch, duplicita, chyba, honeypot, limit.
- **E2E (Playwright, mobilní viewport 390×844):** příchod s `utm_content=a` i `=b` → správný hero; výběr páru → karta → kalkulačka → odeslání → `/dekujeme`; telefon se souhlasem; analytické události v pořadí.
- **Ruční:** reálný double opt-in na testovací adresu (Gmail i Seznam), doručení PDF, kontrola v Brevu; Lighthouse mobile; kontrola na reálném telefonu (iOS Safari, Android Chrome).

---

## 13. Očekávaná konverze (odhad, ověří se daty)

| Metrika | Odhad | Zdůvodnění |
|---|---|---|
| Návštěvník → odeslaný e-mail | **8–12 %** (verze A spíš horní hranice, B dolní) | studený mobilní provoz, ale jediné pole, hodnota ukázaná předem a lead magnet přímo navazuje na otázku z reklamy |
| Odeslání → potvrzení DOI | **60–75 %** | potvrzení motivované PDF, tlačítka „Otevřít Gmail/Seznam" |
| Lead → telefon | **8–15 %** | nepovinné, nabízeno dvakrát v momentech nejvyššího zájmu |

Hodnoty jsou odhad týmu, ne benchmark se zdrojem; README to výslovně uvede a určí, po kolika návštěvách (cca 1 000 na variantu) je první vyhodnocení smysluplné.

---

## 14. A/B hypotézy (seřazené podle očekávaného dopadu)

1. **Umístění prvního formuláře.** Formulář přímo v kartě dvojčete (hned po prvním ťuknutí) místo až pod kalkulačkou zvýší konverzi, protože ho uvidí víc lidí (odpad mezi kartou a kalkulačkou). Riziko: nižší kvalita / míra DOI. Metrika: konverze, sekundárně míra DOI.
2. **Rámování nabídky.** „Tahák všech dvojčat (PDF)" vs. „Hlídání poplatků: dáme vědět, když se objeví levnější dvojče + tahák". Průběžná hodnota může zvýšit konverzi i míru DOI. Metrika: konverze, DOI.
3. **Text tlačítka.** „Poslat mi tahák" vs. „Chci znát nejlevnější dvojče" (navazuje na otázku z kalkulačky). Menší, ale levný test. Metrika: `form_started` → `form_submitted`.

(Test reklam A vs. B běží paralelně jako test kreativ na úrovni Meta, nepočítá se mezi hypotézy stránky.)

---

## 15. Klíčová rozhodnutí do README

- **PRIIPs:** proč NYSE ETF český drobný investor u evropského brokera nekoupí, se zdroji.
- **Proč kalkulačka porovnává dvojčata mezi sebou**, ne originál s dvojčetem (§5.3).
- **Proč daň z dividend nehraje velkou roli** (irské fondy 15 % ≈ Čech s W-8BEN).
- **Proč chybí QQQ:** obchoduje se na Nasdaqu, ne na NYSE; kandidát na rozšíření, pokud data ukážou poptávku.
- **Proč není skládání portfolia ani kvíz:** blízko investičnímu doporučení.
- **Proč telefon až po e-mailu:** maximum konverzí na první kontakt, telefon od nejteplejších.
- **Proč měření bez cookies + pixel se souhlasem.**
- Zdůvodnění pořadí sekcí (§4), očekávaná konverze (§13), A/B hypotézy (§14), texty reklam (§9), checklist aktualizace dat a checklist před spuštěním (§16).

---

## 16. Checklist před spuštěním reklamy

- [ ] Clientelo odsouhlasí uvedení jako provozovatel / správce údajů (jinak doplnit jiný reálný subjekt – nikdy vymyšlený).
- [ ] Právník Clientela odsouhlasí znění souhlasů (e-mail, telefon + předání partnerům) a zásady zpracování údajů.
- [ ] Brevo: odesílací doména ověřena (SPF/DKIM), šablona DOI, seznam, automatizace s PDF otestovány.
- [ ] Data v `etf-pairs.json` ověřena ke dni spuštění.
- [ ] Meta: Pixel + CAPI ověřené v Events Manageru, zařazení kampaně podle zásad Meta pro finanční služby.
- [ ] Lighthouse mobile splňuje cíle §8.5.
- [ ] E2E testy zelené na produkční URL.

---

## 17. Mimo rozsah

- Obsahová e-mailová sekvence po taháku (dělá Clientelo ve svém systému).
- Napojení na CRM / software Clientela.
- Vlastní doména (lze doplnit bez změny kódu).
- Další jazykové verze, QQQ a další páry.
