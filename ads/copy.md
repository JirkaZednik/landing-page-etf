# Reklamy Meta (Instagram + Facebook)

Kategorie kampaně: Financial products and services. Obě verze vedou na stejnou URL; `utm_content` přepíná nadpis a podnadpis hero (varianta podle prvního písmene).

## Verze A – „Problém"
- Kreativy: `a-4x5.png` (1080×1350), `a-9x16.png` (1080×1920)
- Primární text: Hledali jste u brokera VOO a nenašli ho? Není to chyba. Evropská pravidla brání brokerům prodávat americké ETF drobným investorům. Na stejný index S&P 500 ale existují evropské fondy. Podívejte se, které to jsou a co stojí.
- Titulek: VOO u evropského brokera nekoupíte. Tady je náhrada.
- Tlačítko: Více informací
- URL 4:5: `{SITE_URL}/?utm_source=meta&utm_medium=paid_social&utm_campaign=etf_dvojce_launch&utm_content=a-4x5`
- URL 9:16: `{SITE_URL}/?utm_source=meta&utm_medium=paid_social&utm_campaign=etf_dvojce_launch&utm_content=a-9x16`

## Verze B – „Praktický návod"
- Kreativy: `b-4x5.png`, `b-9x16.png`
- Primární text: Máte účet u XTB, Trading 212, Fio nebo Degira a chcete investovat do S&P 500? Nemusíte hledat ve stovkách fondů. Pošleme vám přesný ISIN a postup pro vašeho brokera.
- Titulek: S&P 500 u vašeho brokera: přesný ISIN a postup
- Tlačítko: Získat návod
- URL 4:5: `{SITE_URL}/?utm_source=meta&utm_medium=paid_social&utm_campaign=etf_dvojce_launch&utm_content=b-4x5`
- URL 9:16: `{SITE_URL}/?utm_source=meta&utm_medium=paid_social&utm_campaign=etf_dvojce_launch&utm_content=b-9x16`

Čísla a ISIN na kreativách se berou ze `src/data/etf-pairs.json` (`npm run ads`). Po každé aktualizaci dat kreativy znovu vyrenderujte. Stejný skript vyrenderuje i `public/og.png` (1200×630, z verze A) – výchozí náhled webu při sdílení. Žádné sliby výnosů; provozovatel je uveden v profilu stránky na Meta.
