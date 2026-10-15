Link to conversation - https://claude.ai/share/be2423f3-d71d-4fa7-a120-29bb2ba1ae2b

Vytvoř návrh řešení z tohoto zadání (odpověď v češtině), postupuj podle superpowers skills:

ZADANIE B: Konverzná landing page
Cieľom je landing page s porovnaním ETF obchodovaných na NYSE pre českého drobného investora, ktorý prichádza z reklamy na mobile a stránke venuje len niekoľko sekúnd. Stránka má fungovať ako lead magnet: ponúknuť návštevníkovi hodnotu a výmenou za ňu získať jeho kontakt. Pekný dizajn nestačí, stránka musí byť optimalizovaná na prínos kontaktov. Zároveň nesmie pôsobiť ako základný výstup od Claude. Dizajn aj texty majú byť premyslené pre túto cieľovú skupinu. Pri hodnotení sa budem riadiť hlavne otázkou, či by sme na ňu mohli zajtra spustiť reklamu.

Určte cieľovú skupinu, čo návštevník dostane výmenou za kontakt a v ktorom momente oň požiadate. Hodnota by mala byť zrejmá ešte pred vyplnením formulára. Navrhnite aj dve verzie reklamy. Prvá obrazovka stránky by mala nadväzovať na prísľub reklamy a okamžite komunikovať, čo návštevník získa.

Výber interaktívnych prvkov, napríklad porovnania fondov, kalkulačky poplatkov alebo skladania portfólia, nechávam na Vás. Každý z nich by mal viesť ku kontaktu. Formulár by mal mať čo najmenej polí. Premyslite aj to, čo návštevník dostane po jeho odoslaní.

Použite skutočné dáta s uvedením zdroja a merajte celú cestu od príchodu po odoslanie formulára. V README zdôvodnite poradie sekcií, uveďte očakávanú konverziu a tri hypotézy na A/B test zoradené podľa očakávaného dopadu. Stránku nasaďte na bezplatný hosting, napríklad Vercel.

Načtu si postup ze superpowers skills a pak připravím návrh řešení.

Postupuji podle skillu brainstorming. Klasifikace: architektonická práce – jde o nový projekt (stránka, interaktivní prvky, měření, formulář s doručením, reklamy, README, nasazení), takže půjdu plnou cestou: upřesňující otázky → 2–3 přístupy → návrh po sekcích s tvým schválením → písemná specifikace → implementační plán. Kód nezačnu psát, dokud neschválíš specifikaci i plán. Pokud chceš lehčí postup, řekni.

Jak rozumím zadání

Co je v zadání výslovně:

Cíl: landing page jako lead magnet. Úspěch se měří počtem kontaktů a otázkou „mohli bychom na ni zítra pustit reklamu?“, ne vzhledem.
Návštěvník: český drobný investor, přichází z reklamy na mobilu, stránce dá pár sekund.
Obsah: porovnání ETF obchodovaných na NYSE, se skutečnými daty a uvedeným zdrojem.
Hodnota musí být vidět ještě před formulářem. První obrazovka navazuje na slib reklamy.
Interaktivní prvky volím já (porovnání, kalkulačka poplatků, skládání portfolia) a každý musí vést ke kontaktu.
Formulář má mít minimum polí a musí být vyřešeno, co návštěvník dostane po odeslání.
Měří se celá cesta od příchodu po odeslání formuláře.
Výstupy: 2 verze reklamy, README (zdůvodnění pořadí sekcí, očekávaná konverze, 3 A/B hypotézy seřazené podle dopadu) a nasazení na bezplatný hosting (Vercel).
Design ani texty nesmí působit jako generický výstup AI.

Co zatím předpokládám (oprav mě):

Stránka bude v češtině, i když je zadání slovensky.
Stack bude React + TypeScript, protože v něm pracuješ, a vercel hosting. Případně Astro/Vite, aby byl první obrazovka na mobilu co nejrychlejší.
Obsah nesmí být investiční doporučení. Půjde o srovnání a vzdělávání s disclaimerem a souhlasem se zpracováním údajů (GDPR, double opt-in).
Data o ETF (TER, AUM, výkonnost, dividendy) vezmu z veřejných zdrojů vydavatelů (iShares, Vanguard, SPDR) se zdrojem a datem stažení. Statický snapshot stačí, živé napojení není potřeba.

První otázka: Za jakou značkou stránka poběží a kam mají kontakty proudit? Na tom závisí texty, reklamy i to, co návštěvník po odeslání reálně dostane.

A) Vlastní fiktivní značka + Brevo (doporučuji): bezplatný tarif, double opt-in a automatický e-mail s lead magnetem (např. PDF/srovnání). Stránka je tak plně funkční a „zítra spustitelná“.
B) Existující klient nebo broker: dodáš značku, tón, právní omezení a cílový nástroj (CRM/ESP).
C) Fiktivní značka bez e-mailové automatizace: kontakty se ukládají jen do jednoduchého úložiště (Formspree / Google Sheet) a hodnota se odemkne přímo na stránce.
D) Jinak: popiš.

Souhlasíš? dává to za tebe smysl?
D) Stránku dělám pro Clientelo (clientelo.cz), agenturu na leadgeneraci pro investiční sektor, která provozuje vlastní investiční portály. Postav ji proto jako vlastní fiktivní spotřebitelskou značku/portál v duchu jejich webů, ne pod značkou Clientelo. Kontakty ať jdou do Brevo (bezplatný tarif, double opt-in, automatický e-mail s lead magnetem), aby byla stránka plně funkční a spustitelná hned. Formulář jen s e-mailem. Na děkovací stránce nabídni nepovinné zanechání telefonu pro konzultaci, protože Clientelo leady kvalifikuje po telefonu. Patičku a disclaimery udělej ve stylu Clientelo: informativní obsah, není investiční doporučení, riziko ztráty, GDPR.

Ano, dává to smysl a sedí to na model Clientela. Na jejich webu je to popsané přesně takhle: za kontakt nabídnout užitečný nástroj, lead vzniká vyplněním formuláře a kvalifikace probíhá po telefonu. Formulář jen s e-mailem a nepovinný telefon až na děkovací stránce je pro mobilní návštěvníka s pár sekundami nejlepší kombinace. Telefon nebude brzdit první konverzi a zároveň ho dostaneme od těch nejteplejších.

Než půjdeme dál, mám tři připomínky. První je zásadní.

1. Český drobný investor většinou ETF z NYSE koupit nemůže. Od roku 2018 platí nařízení PRIIPs. Americké fondy (VOO, SPY, QQQ, VTI…) nemají povinný dokument KID, takže je evropští brokeři retailovým klientům prodat nesmí. To platí pro XTB, Trading 212, Degiro i Interactive Brokers. Kdyby stránka jen srovnávala NYSE ETF, slibovala by něco, co si návštěvník nekoupí. To je přesně ten typ vady, kvůli kterému by reklama „zítra“ neprošla. Podle mě se z toho ale dá udělat nejsilnější háček celé stránky: „Chcete VOO? V Česku ho nekoupíte. Tady je jeho evropské dvojče a kolik vás bude stát.“ Ke každému NYSE fondu ukážeme jeho UCITS ekvivalent (např. VOO → VUAA/CSPX) a porovnáme náklady, včetně 15% srážkové daně z dividend. Tohle chci ve specifikaci ještě ověřit a doložit zdroji.

2. Double opt-in nesmí držet hodnotu jako rukojmí. Brevo nejdřív pošle potvrzovací e-mail a lead magnet přijde až po kliknutí. Část lidí potvrzení nedokončí. Proto bych hlavní výsledek (např. výsledek kalkulačky) ukázal hned na děkovací stránce a v e-mailu poslal plnou verzi (PDF/srovnání) jako důvod k potvrzení. Míru potvrzení budeme měřit jako samostatný krok trychtýře.

3. Značka může být fiktivní, provozovatel ne. Aby stránka byla opravdu spustitelná, musí mít správce osobních údajů skutečnou firmu s IČO. Vymyšlená firma by byla fabrikace a nemohl by na ni odkazovat souhlas s GDPR. Navrhuji „Provozovatel: Clientelo Czech s.r.o.“ v patičce. Jejich portály tak zřejmě fungují, ale ověř si s nimi, že s tím souhlasí. Souhlas u telefonu musí výslovně pokrývat kontaktování a případné předání partnerům. Clientelo leady předává klientům. A obsah musí zůstat u faktického srovnání, nikoli „nejlepší ETF pro vás“. Proto bych spíš vynechal skládání portfolia: personalizovaný výběr fondů se nebezpečně blíží investičnímu doporučení.

Další otázka (podle bodu 1): Jak pojmout srovnání?

A) NYSE fond + jeho evropské dvojče (doporučuji): reklama láká na známé americké ETF, stránka vysvětlí, proč je nekoupíte, a ukáže, co koupit a za kolik. Je to věcně správné a nese to silný háček.
B) Čistě NYSE ETF, jak stojí v zadání: zadání se splní doslova, ale s rizikem, že stránka slibuje nedostupný produkt.
C) Jen UCITS ETF, NYSE pouze jako reference v textu: nejbezpečnější varianta, ale nejvíc se odchyluje od zadání.

Sources: Clientelo

Volím za A)

Beru A. Teď podle postupu navrhuji tři přístupy. Liší se tím, co je lead magnet, který interaktivní prvek ho nese a kdy si řekneme o e-mail.

Přístup 1: „Najdi své evropské dvojče“ + kalkulačka nákladů (doporučuji)

Hero navazuje na reklamu: „VOO v Česku nekoupíte. Jeho dvojče ano.“ Hned pod ním jsou dlaždice se 6–8 nejznámějšími NYSE ETF (VOO, QQQ, VTI, SCHD…).
Volně dostupné: po jednom ťuknutí se zobrazí dvojče, srovnání TER, domicil a dopad daně z dividend. Hodnotu tak návštěvník vidí ještě před formulářem.
Kalkulačka: návštěvník zadá měsíční vklad a horizont a uvidí, kolik ho za 20 let stojí poplatky a daně u jednotlivých variant. Hlavní číslo uvidí hned.
E-mail si řekneme až po první interakci, přímo u výsledku. Za něj dostane „Tahák: 10 amerických ETF a jejich evropská dvojčata + jak je koupit u českých brokerů“ (PDF) a svůj výpočet do mailu.
Proč: cesta má jen jeden mikrokrok a návštěvník dostane odpověď do 5 sekund. Formulář přichází ve chvíli největší zvědavosti a prvek se dá změřit.

Přístup 2: Kvíz o 3 krocích („Jaký investor jste?“ → doporučená dvojčata)

Na mobilu má vyšší zapojení a výsledek je částečně skrytý za e-mailem.
Nevýhody: výsledek „pro vás“ se blíží investičnímu doporučení, což je pro Clientelo compliance riziko. Zamčený výsledek navíc studený provoz často otráví.

Přístup 3: Klasika, tabulka srovnání + formulář na PDF hned v hero

Je nejrychlejší na výrobu a formulář je vidět okamžitě.
Nevýhody: tabulka je na mobilu nečitelná a hodnota je slíbená, ne ukázaná. Na studený provoz z reklamy čekám zhruba poloviční konverzi. A působilo by to jako ten „základní výstup“, který zadání zakazuje.

Doporučuji přístup 1. Ze všech nejlépe splňuje „hodnota zřejmá ještě před formulářem“ a „každý prvek vede ke kontaktu“, a přitom zůstává u faktického srovnání bez personalizovaného doporučení. Obě reklamy pak můžou testovat dvě různé emoce: „nemůžete koupit VOO“ (problém) a „kolik vás stojí poplatky“ (peníze), a obě navazují na stejný hero.

Souhlasíš s přístupem 1? Pokud ano, budu pokračovat návrhem po sekcích: struktura stránky a texty, data a zdroje, formulář a Brevo, měření, reklamy. Po každé sekci si vyžádám tvoje schválení.

Ano pokračuj s přístup 1

Sekce 1/5: Značka, styl a struktura stránky

Značka: fiktivní spotřebitelský portál „Indexák“ (pracovní název, doménu ověřím ve specifikaci). Je krátký, český a nezní jako banka. Interaktivní prvek se jmenuje „Najdi dvojče“.

Vizuální směr (aby to nebyl „Claude default“): žádné fialové přechody ani ikonky v kartičkách. Stránka bude vypadat jako tržní strana novin: papírově bílé pozadí, černá typografie, jediná signální barva (tmavě zelená) a tickery v neproporcionálním písmu s tabulkovými číslicemi. Hlavní vizuální motiv je dvojice tickerů spojená šipkou: VOO ⇄ VUAA. Ten motiv se opakuje v reklamě, v hero, ve výsledku i v PDF, takže návštěvník okamžitě pozná, že je na správném místě.

Pořadí sekcí (navrženo pro mobil, 390 px):

Hero (první obrazovka): nadpis přebírá slib reklamy („VOO v Česku nekoupíte. Jeho evropské dvojče ano.“), pod ním mřížka 8 tickerů k ťuknutí a mikrořádek „Bez registrace · data k 30. 9. 2026 · zdroj: vydavatelé fondů“. Formulář tu záměrně není: nejdřív hodnota, pak žádost.
Karta dvojčete (otevře se po ťuknutí): TER, domicil, daň z dividend, akumulace/distribuce, dostupnost u CZ brokerů. Pod ní tlačítko „Kolik tím ušetřím?“
Kalkulačka (předvyplněná zvoleným párem): měsíční vklad a horizont, výsledkem je jedno velké číslo. Přímo pod výsledkem je pole pro e-mail: „Pošlu vám výpočet + tahák všech 10 dvojčat.“ Tady je hlavní moment žádosti, protože zvědavost je nejvyšší.
„Proč VOO nekoupíte“: PRIIPs/KID ve 3 větách. Zvyšuje důvěryhodnost u těch, kdo váhají.
Náhled taháku: rozmazaná stránka PDF s výčtem obsahu a druhá instance formuláře.
Krátké FAQ: zdarma? spam? co je KID? kde to koupím?
Patička ve stylu Clientela: provozovatel, informativní charakter, riziko ztráty, GDPR, cookies.

Na mobilu se po odscrollování hero objeví sticky lišta „Získat tahák zdarma“, která skočí na nejbližší formulář.

Proč právě takhle: každá sekce odpovídá na další otázku, kterou si návštěvník položí: „Jsem tu správně?“ → „Co z toho mám?“ → „Kolik to dělá v penězích?“ → „Proč bych měl věřit?“ → „Co přesně dostanu?“ → „Háček?“ Formulář se objeví až ve chvíli, kdy hodnota už byla ukázaná, ale ještě není kompletní. Úplný tahák je důvod nechat e-mail.

Sedí ti tahle struktura a vizuální směr? Pokud ano, další sekce bude Data a zdroje (které ETF páry, odkud čísla, jak a kdy je aktualizovat).

Ano struktura je OK, pokračuj

Sekce 2/5: Data a zdroje

Před návrhem jsem ověřil klíčová fakta. Jedno z nich mění pointu kalkulačky.

Ověřeno:

Omezení je skutečné: od ledna 2018 nařízení PRIIPs vyžaduje u každého investičního produktu prodávaného retailovým investorům v EU dokument KID. Většina amerických poskytovatelů ETF ho nikdy nevydala, a tak je evropští brokeři retailovým klientům nabízet nesmí. Kdo americký ETF už drží, může ho dál držet nebo prodat, ale přikoupit nemůže. To je dobrý obsah pro FAQ. 
quantroutine
justetf
Dvojčata se mezi sebou liší cenou: pořadí podle TER je SPYL (0,03 %) < VUAA = CSPX = SXR8 (0,07 %) < starší ETF (0,15 % a víc). TER fondu SPYL potvrzuje i přímo stránka State Street: 0,03 %, irský fond, UCITS. 
freenance
ssga

Oprava toho, co jsem psal dřív: daňový rozdíl mezi originálem a dvojčetem je pro Čecha malý. Irské fondy platí z amerických dividend optimálních 15 %, což je zhruba stejně, kolik zaplatí Čech u amerického ETF s formulářem W-8BEN. Slib „kolik ušetříte oproti VOO“ by tedy byl zavádějící. Kalkulačka proto neporovná originál s dvojčetem, ale dvojčata mezi sebou: „Všechna sledují S&P 500. Nejlevnější vás za 20 let stojí o X Kč méně než nejdražší.“ To je pravdivé, překvapivé a dobře se to změří. Tlačítko z první sekce se změní na „Které dvojče je nejlevnější?“ 
freenance

Páry, které navrhuji (jen ETF obchodované na NYSE Arca):

NYSE originál	Evropská dvojčata (UCITS)
VOO / SPY / IVV (S&P 500)	SPYL, VUAA, CSPX
VTI (celý US trh)	přesné dvojče neexistuje, ukážeme nejbližší alternativu
VT (celý svět)	VWCE a levnější alternativy
SCHD (dividendy)	přesné dvojče neexistuje, ukážeme nejbližší alternativu

Karty s poctivým „přesné dvojče neexistuje“ zvyšují důvěryhodnost. QQQ jsem vynechal, protože se obchoduje na Nasdaqu, ne na NYSE. Je ale velmi populární, takže pokud chceš, přidám ho jako výjimku.

Jak budou data uložená: v repozitáři bude statický soubor etf-pairs.json. Každá hodnota (TER, ISIN, domicil, akumulace, velikost fondu) ponese odkaz na stránku vydavatele a datum stažení. Stránka u každé karty zobrazí „Zdroj: Vanguard, k 30. 9. 2026“. Primárním zdrojem budou stránky vydavatelů (Vanguard, iShares, State Street, Invesco), agregátory typu justETF jen pro kontrolu. Živé API nestavím, protože TER se mění zřídka. Do README přidám měsíční checklist pro aktualizaci. Dostupnost u českých brokerů (XTB, Trading 212, Fio…) se mění častěji, proto ji dám jen do PDF taháku s datem ověření, ne na stránku.

Kalkulačka: návštěvník zadá měsíční vklad a horizont, modelové zhodnocení je výslovně označené jako ilustrativní, ve stylu disclaimerů Clientela. Výsledkem je rozdíl v nákladech TER mezi dvojčaty v Kč.

Souhlasíš s tímhle pojetím dat a s přepnutím kalkulačky na „nejlevnější dvojče“? A QQQ přidat, nebo vynechat? Další sekce bude formulář, Brevo a děkovací stránka.

vysvětli mi ještě ve zkratce proč přepnout kalkulačku na „nejlevnější dvojče“.
QQQ bych vynechal, co tvůj názor?

Vysvětlení burzovního zařazení a posouzení vhodnosti QQQ.

Proč „nejlevnější dvojče“: původní slib „kolik ušetříte oproti VOO“ nemá v číslech oporu. VOO má TER 0,03 % a daňově vychází pro Čecha zhruba stejně jako irská dvojčata. Kalkulačka by tak ukázala úsporu blízko nule, nebo dokonce to, že dvojče je dražší. To by návštěvníka zklamalo, nebo bychom museli čísla přikrášlit, a obojí zabíjí důvěru i compliance.

Rozdíl mezi dvojčaty navzájem je naopak skutečný a pro většinu lidí překvapivý: tři fondy na stejný index S&P 500 stojí 0,03 % až 0,07 % ročně, starší i víc. Na dlouhém horizontu to dělá tisíce korun za nic. Dává to i návštěvníkovi jasnou otázku, na kterou chce odpověď („které z nich mám vzít?“), a ta přirozeně vede k taháku za e-mail. Navíc je to faktické srovnání nákladů, ne doporučení „kupte X“, takže zůstáváme na bezpečné straně.

QQQ: souhlasím s vynecháním. Zadání výslovně říká NYSE a hodnotitel si toho může všimnout. Kdybychom QQQ zařadili, vypadalo by to jako přehlédnutí, ne jako záměr. Do README dám jednu větu, že je vynechané vědomě (obchoduje se na Nasdaqu) a že jde o kandidáta na rozšíření, pokud data ukážou poptávku. Čtyři páry stačí: na mobilu jsou dlaždice větší a výběr rychlejší.

Mám tedy datovou sekci brát jako schválenou a pokračovat formulářem, Brevem a děkovací stránkou?

OK, souhlasím s tímhle pojetím dat a s přepnutím kalkulačky na „nejlevnější dvojče“.
Zároveň jak zmiňuješ, všechny tyto důležité poznatky uveď i do README (QQQ, proč „nejlevnější dvojče“).

Rozumím. Do README dám samostatnou sekci „Klíčová rozhodnutí“: proč NYSE fondy nejdou koupit (PRIIPs), proč kalkulačka porovnává dvojčata mezi sebou, proč chybí QQQ a proč daň z dividend nehraje velkou roli. Všechno se zdroji.

Sekce 3/5: Formulář, Brevo a co přijde po odeslání

Formulář: jedno pole na e-mail a tlačítko „Poslat mi tahák“. Pod ním jeden řádek mikrotextu („Žádný spam, odhlásíte se jedním klikem. Zásady zpracování údajů“). Formulář je na stránce dvakrát, pod výsledkem kalkulačky a u náhledu taháku, a oba se měří zvlášť. Skrytě se s ním odešle zvolený pár ETF, vstupy kalkulačky a UTM parametry. Call centrum Clientela tak uvidí, co člověka zajímalo a z jaké reklamy přišel.

Technicky: API klíč Brevo nesmí být v prohlížeči. Formulář proto volá serverless funkci na Vercelu (/api/subscribe) a ta zavolá v Brevu endpoint pro double opt-in s naší šablonou potvrzovacího e-mailu a seznamem. Proti spamu stačí skryté pole (honeypot) a základní limit požadavků. Captcha by na mobilu brzdila konverzi.

Cesta po odeslání:

Děkovací stránka /dekujeme (otevře se okamžitě):
Nahoře je velké „Ještě jeden klik: potvrďte e-mail“ s tlačítkem „Otevřít Gmail“ / „Otevřít Seznam Email“. Čeští uživatelé mají hodně schránek na Seznamu.
Hned pod tím je hodnota bez čekání: kompletní srovnání zvoleného páru a výsledek kalkulačky. Návštěvník tak nemá pocit, že dal e-mail za nic, i když potvrzení odloží.
Nepovinný telefon: „Chcete projít, jak začít? Krátký hovor zdarma, bez prodeje fondů.“ Jedno pole a samostatný nezaškrtnutý souhlas s telefonickým kontaktem a předáním údajů partnerům. Telefon se uloží ke stejnému kontaktu v Brevu.
Potvrzovací e-mail: předmět „Potvrďte a tahák je váš“, krátký text a jedno tlačítko.
Po potvrzení → stránka /potvrzeno: okamžité stažení PDF taháku a ten samý odkaz dorazí i e-mailem (automatizace v Brevu: přidání do seznamu spustí odeslání e-mailu). Kdo nenechal telefon, dostane tady druhou nabídku, protože v tomhle momentu je zájem nejvyšší.

PDF tahák (2–3 strany) se generuje ze stejného etf-pairs.json jako stránka, takže čísla vždycky souhlasí. Obsah: všechna dvojčata s TER a ISINy, akumulace vs. distribuce, jak hledat podle ISIN u brokera, dostupnost u českých brokerů s datem ověření.

Chybové stavy:

Neplatný e-mail: hláška přímo u pole.
Brevo neodpoví: zadaný e-mail zůstane vyplněný, zobrazí se „Zkuste to znovu“ a chyba se zaloguje.
E-mail už v seznamu je: chová se jako úspěch, žádné „tento e-mail už existuje“.

Compliance poznámka: posílat obsahové e-maily po taháku vyžaduje souhlas (zákon 480/2004 Sb.). Ten zajistí double opt-in s jasným textem v potvrzovacím e-mailu. Přesné znění souhlasů ale doporučuji nechat odsouhlasit právníkovi Clientela. V README to bude uvedené jako předpoklad pro spuštění.

Sedí ti takhle cesta po odeslání? Další sekce bude měření celé cesty.

ano pokračuj

Sekce 4/5: Měření celé cesty

Nástroje (všechny zdarma):

PostHog v režimu bez cookies pro celý trychtýř a funnely. Neukládá nic do prohlížeče, takže měří i lidi, kteří odmítnou cookie lištu. Bez toho bychom u studeného provozu z reklamy mohli přijít o velkou část dat. Přesné podmínky bezplatného tarifu a právní posouzení režimu bez cookies ověřím ve specifikaci.
Meta Pixel + Conversions API (ze serveru) a GA4 až po souhlasu v cookie liště. Reklamní systém potřebuje událost Lead, aby kampaň uměla optimalizovat na kontakty. Serverová cesta posílá lead z /api/subscribe i tehdy, když pixel zablokuje adblock, ale jen se souhlasem.
Brevo jako zdroj pravdy pro počet kontaktů. V README popíšu, jak data z analytiky a Brevo porovnávat.

Události trychtýře (v pořadí cesty):

#	Událost	Parametry
1	page_view	utm_source, utm_campaign, utm_content = varianta reklamy
2	pair_selected	který pár
3	calc_used	vklad, horizont
4	calc_result_viewed	
5	form_viewed	umístění (kalkulačka / náhled PDF)
6	form_started	první kliknutí do pole
7	form_submitted / form_error	umístění / typ chyby
8	thankyou_viewed	
9	phone_submitted	stránka (/dekujeme / /potvrzeno)
10	doi_confirmed	
11	pdf_downloaded	

K tomu vedlejší události: sticky_cta_clicked, faq_opened, source_link_clicked (zajímá někoho zdroj dat?) a hloubka scrollu.

Propojení celé cesty: stránka bude jedna aplikace, takže přechod na /dekujeme nevyžaduje nové načtení a návštěvník zůstává stejný. Potvrzení e-mailu přichází z jiného zařízení nebo okna. Proto do odkazu, kam Brevo po potvrzení přesměruje, přidáme anonymní ID návštěvy a /potvrzeno ho připojí zpátky ke stejné cestě. Cesta „reklama → potvrzený lead → telefon“ je tak vidět v jednom funnelu.

Hlavní metriky (každá rozdělená podle varianty reklamy):

Konverze = odeslané formuláře / unikátní návštěvníci (hlavní KPI)
Míra potvrzení double opt-in
Míra telefonů z leadů (ta nejvíc zajímá Clientelo)
Odpad mezi kroky: kde lidé odcházejí (hero → výběr páru → kalkulačka → formulář)

Ve PostHogu připravím uložený funnel a jednoduchý dashboard. Odkaz bude v README.

Rychlost jako součást měření: na mobilu z reklamy rozhoduje první vteřina. Cíl je LCP pod 1,5 s na 4G, analytika se načítá asynchronně až po vykreslení a v README budou výsledky z Lighthouse.

Sedí ti takové měření? Poslední sekce bude dvě verze reklamy a jak navazují na hero. Pak sepíšu specifikaci, do které přijde i očekávaná konverze a A/B hypotézy.

Assembling a team of parallel reviewers for the task.

Spouštím pět nezávislých recenzentů, každý se dívá z jiného úhlu: soulad se zadáním, konverze (CRO), právo a compliance, fakta a data, technická proveditelnost.

Recenze jsou hotové. Shrnu, na čem se recenzenti shodli, co beru, kde nesouhlasím a co potřebuji rozhodnout od tebe.

Shodli se na tom víc recenzentů (beru bez debaty)
Hero neříká, co návštěvník dostane, a cesta k formuláři je dlouhá. Dnes vede k formuláři 3–4 interakce: dlaždice, karta, kalkulačka a teprve pak formulář.
→ Hero ukáže rovnou odpověď pro S&P 500, protože tam míří většina provozu: VOO ⇄ SPYL · VUAA · CSPX s TER. Pod ní bude podnadpis s přínosem a e-mailové pole. Ostatní fondy a kalkulačka přijdou až pod tím. Sticky lišta bude vidět od začátku a doplním výchozí hero pro návštěvy bez UTM.
Reklama B je postavená na slabém čísle. Fact-checker spočítal, že SPYL proti VUAA dává při 3 000 Kč měsíčně za 20 let jen 6 870 Kč, tedy 0,45 % výsledné částky. Slovo „až“ je navíc zavádějící.
„VOO v Česku nekoupíte“ je příliš absolutní. Výjimkou jsou profesionální klienti, stávající držitelé a opce. Na Metě to navíc hrozí zamítnutím reklamy. → „U evropského brokera VOO jako drobný investor nekoupíte.“
Odhad konverze 8–12 % je přehnaný. → 3–6 %, double opt-in 50–65 %, telefon 3–8 %.
Souhlasy u telefonu je potřeba rozdělit na „zavolá vám provozovatel“ a „předání konkrétně jmenovaným partnerům“. Text „bez prodeje fondů“ zmizí, protože odporuje předávání údajů partnerům.
Opravy faktů
Daně jsem zjednodušil. Akumulační irské dvojče je pro Čecha daňově spíš výhodnější než VOO: daň se odkládá a po 3 letech platí časový test. Opravím to ve specifikaci, na stránce i v README.
VWCE stojí od 28. 7. 2026 0,14 %, ne 0,22 %. U VT je nejlevnější alternativa SPYY za 0,12 %.
SCHD nemá žádné UCITS dvojče a alternativy sledují jiné indexy. Kalkulačka se proto u SCHD neukáže.
Syntetický Invesco (0,05 %) nezařadím, protože srovnání podle TER by u něj nebylo poctivé.
Technika
Vercel Hobby je jen pro nekomerční použití. Kampaň pro Clientelo musí běžet na jejich tarifu. Doplním to do checklistu.
Bezplatné Brevo má 300 e-mailů denně. To je pro kampaň málo, počítat s tarifem Starter.
Telefon na /dekujeme nemá ke komu uložit, protože kontakt v Brevu vzniká až po potvrzení double opt-in. → Uložit samostatně se spárováním přes aid.
PDF vygeneruji přes @react-pdf/renderer, ne Playwright, protože ten v buildu na Vercelu nejede.
Rate limit poběží přes Upstash (bezplatný tarif). Volba hybrid v Astru 5 neexistuje. Doplním CSP, OG obrázek, 404 stránku a noindex pro děkovací stránky.
aid a PostHog: EU instance a aid se k analytice připojí až po souhlasu. Bez souhlasu se posílají jen anonymní události. Meta CAPI bude mít vlastní účel souhlasu.
Kde s recenzentem nesouhlasím

Compliance recenzent tvrdí, že jde o „skrytou reklamu, protože srovnávané fondy platí“. Tak to není: klienti Clientela jsou fondy kvalifikovaných investorů a emitenti dluhopisů, ne Vanguard ani iShares. Platí ale jeho jádro: stránka musí jasně říct, kdo ji provozuje a že kontakty mohou být předány partnerům. Totéž platí pro skript telefonátu, který nesmí obsahovat doporučení konkrétního fondu. Obojí doplním.

Co potřebuji rozhodnout od tebe

CRO i hodnotitel zadání se shodli, že tahák v dnešní podobě nestojí za e-mail. Tabulka dvojčat je na stránce zdarma a jediné, co člověk opravdu nemá, je jak to koupit u svého brokera. Navrhuji změnit lead magnet a s ním i reklamu B:

Lead magnet: „Návod: jak koupit S&P 500 (a další) u XTB, Trading 212, Fio a Degiro: ISIN, poplatky brokera, postup krok za krokem“. Údaje o brokerech se před spuštěním ověří, nic se nedomýšlí.
Reklama B (nově): „Máte XTB / Trading 212 / Fio? Tady je přesný ISIN, který hledáte.“ Hraje na praktičnost místo slabého čísla v korunách.
Kalkulačka zůstane jako doplněk: ukáže srovnání dvojčat i s orientačním řádkem „typický podílový fond s poplatkem 1,5 %“ (≈ 230 tis. Kč za 20 let). Teprve to dává rozdílu v korunách smysl.
A/B hypotézy přeřadím podle dopadu:
návod ke koupi proti taháku dvojčat;
formulář v hero proti formuláři až pod kalkulačkou;
PDF ke stažení hned na děkovací stránce proti až po potvrzení double opt-in.
Test textu tlačítka vyřadím.

Souhlasíš s touto změnou lead magnetu a reklamy B? Pokud ano, zapracuji všechny výše uvedené úpravy do specifikace a pošlu ti ji znovu ke schválení.

Ano, souhlasím. 
Také souhlasím že "Hero neříká, co návštěvník dostane, a cesta k formuláři je dlouhá. Dnes vede k formuláři 3–4 interakce: dlaždice, karta, kalkulačka a teprve pak formulář." -> toto taky vyřešíš?

Ano, to je teď hlavní změna. Formulář bude přímo na první obrazovce hned pod odpovědí, takže k odeslání nebude potřeba žádné ťuknutí navíc. Zapracuji to spolu se všemi úpravami z recenzí.

Specifikace v2 je commitnutá a aktualizovaná i v projektu.

Jak je teď vyřešená první obrazovka (§4):

Nadpis a podnadpis podle reklamy: podnadpis rovnou říká, co návštěvník dostane („…návod, jak je koupit u vašeho brokera, vám pošleme zdarma“).
Karta odpovědi pro S&P 500: originály z NYSE (VOO 0,03 %, SPY 0,09 %, IVV 0,03 %) a pod nimi dvojčata SPYL, VUAA a CSPX s TER a zdrojem. Splňuje to zároveň výtku, že srovnání NYSE fondů musí být vidět.
E-mailový formulář přímo pod kartou: k odeslání tak není potřeba žádná interakce. Dřív jich byly 3–4.
Sticky lišta je vidět od začátku. Ostatní fondy a kalkulačka jsou až pod tím a každý prvek má vlastní cestu ke kontaktu. Tabulka „prvek → kontakt“ půjde do README.
E2E test hlídá, že tlačítko je nad ohybem na 390×844.

Další změny ve v2:

Lead magnet je teď návod ke koupi u XTB, Trading 212, Fio a Degiro.
Reklama B stojí na „přesný ISIN a postup pro vašeho brokera“.
Na /dekujeme si návštěvník jedním ťuknutím zvolí brokera a hned vidí, co u něj najde. Je to okamžitá hodnota pro návštěvníka a zároveň data pro kvalifikaci, kterou dělá Clientelo.
Data, daně a kalkulačka jsou opravené podle fact-checku: tabulka ověřených TER, kalkulačka ukazuje i řádek fondu s poplatkem 1,5 %.
Konverze: odhad snížený na 3–6 %.
A/B hypotézy: přeřazené podle dopadu.
Souhlasy u telefonu jsou rozdělené na dva.
Technika: Upstash, @react-pdf/renderer, PostHog EU a měření bez souhlasu anonymně.
Checklist před spuštěním nově obsahuje tarify Vercel/Brevo a skript telefonátu.

Projdi si ji prosím. Až ji schválíš, napíšu implementační plán.

2026 10 11 etf dvojcata landing design
Document·MD 

Toto bude git repozitář pro tento projekt, tak si ho připoj - https://github.com/JirkaZednik/landing-page-etf.git

Repozitář je prázdný, takže do něj přenesu oba dosavadní commity se specifikací a pushnu je jako main.

Repozitář je připojený: JirkaZednik/landing-page-etf. Byl prázdný, tak jsem do něj přenesl oba dosavadní commity se specifikací a pushnul je jako větev main. Na GitHubu je specifikace v docs/superpowers/specs/2026-10-11-etf-dvojcata-landing-design.md a dál budu pracovat v tomhle repozitáři.

Teď čekám na tvoje schválení specifikace v2. Potom napíšu implementační plán, uložím ho do docs/superpowers/plans/ a commitnu sem.

Prošel jsem všechny tři připomínky znovu proti původnímu zadání. Ve všech třech máš podle mě pravdu, u dvou s malým upřesněním.

1) Název „ETF Dvojče“

Je lepší než „Indexák“. Pojmenovává přesně to, co stránka dělá, a sedí na nadpis hero („Jeho evropské dvojče ano.“) i na obě reklamy. Návštěvník z reklamy tak v první vteřině vidí stejné slovo. „Indexák“ byl obecný a nic neříkal.

Jediná nevýhoda je, že zní spíš jako nástroj než jako portál. Pro jednoúčelovou stránku, která má nabízet lead magnet, je to ale spíš výhoda. Doménu (např. etfdvojce.cz) jsem neověřoval.

Přejmenování je mechanická změna: texty, meta tagy, PDF, OG obrázek, znovu vygenerované reklamy, README a testy.

2) Clientelo v patičce

Máš pravdu, tady jsem to přehnal. Zadání nic o provozovateli neříká. Ty jsi chtěl patičku ve stylu Clientela, ne s Clientelem.

Uvést na veřejně nasazené stránce skutečnou firmu (Clientelo Czech s.r.o., IČO, sídlo) jako správce osobních údajů bez jejího souhlasu je u ukázky na pohovor zbytečné a spíš riskantní. Kdokoli tam vyplní e-mail, předá ho podle textu stránky firmě, která o tom neví.

Navrhuji:

Ze stránky, PDF i e-mailů Clientelo úplně odstranit. Disclaimery zůstanou v jeho stylu (informativní obsah, není investiční doporučení, riziko ztráty, GDPR).
Jako provozovatele demo uvést tebe jako fyzickou osobu, nebo neutrální text „Demo projekt, kontakt: …“.
V README vysvětlit, že pro ostré spuštění se mění jen jeden soubor (src/lib/operator.ts) a seznam partnerů.
Krok „Clientelo musí souhlasit / právník“ z blokerů dema vypadne a přesune se do sekce „Před ostrým spuštěním u klienta“.

Na hodnotitelovu otázku „šlo by zítra spustit reklamu?“ to pořád odpovídá dobře: ano, po výměně údajů provozovatele v jednom souboru.

3) Double opt-in

Tady máš pravdu a přiznávám, že jsem to měl rozporovat víc. Double opt-in byl v tvém zadání („…double opt-in, automatický e-mail s lead magnetem“). Upozornil jsem jen na to, aby nedržel hodnotu jako rukojmí, a CRO recenzent to označil jako slabé místo.

Co double opt-in dělá:

Měřenou konverzi ze zadání („po odoslanie formulára“) nesnižuje.
Slíbený výsledek (PDF návod) ale posouvá za další krok v e-mailu, často na jiném zařízení. Odhadem 35–50 % lidí ho nikdy nedokončí, takže návod nedostanou.
U jednoduché konverzní stránky to jde proti smyslu lead magnetu: slibujeme „pošlete mi návod“ a místo něj pošleme „potvrďte e-mail“.

Je potřeba právně? V Česku ne. Poslat požadovaný návod je vyřízení žádosti a pro další obchodní e-maily stačí jasný souhlas ve formuláři (ten už tam je). Double opt-in je dobrá praxe pro kvalitu databáze a doložení souhlasu, ne povinnost. U Clientela kvalitu leadu stejně ověřuje telefonát.

Navrhuji single opt-in:

Po odeslání se na /dekujeme hned objeví tlačítko „Stáhnout návod (PDF)“ a výběr brokera s ISINy.
Zároveň Brevo hned pošle e-mail s návodem (kontakt se přidá do seznamu a automatizace ho odešle).
Nabídka telefonu zůstane na /dekujeme. Stránka /potvrzeno a krok doi_confirmed v měření odpadnou.
V README se upraví tabulka konverze (řádek o potvrzení e-mailu zmizí) a třetí A/B hypotéza, která testovala právě „PDF hned vs. po potvrzení“. Nahradil bych ji testem „nabídka telefonu hned nad PDF vs. až pod ním“, protože to přímo ovlivňuje to, co Clientelo potřebuje, tedy počet telefonů.

Za co se platí: do databáze se dostane víc překlepů a falešných adres. Mírní to validace e-mailu, honeypot a kvalifikace po telefonu.

Pokud souhlasíš, udělám všechny tři změny v jedné úpravě specifikace a plánu a pak je provedu se subagenty a kontrolou jako dosud, do stejného PR #1. Potřebuji od tebe jen jedno rozhodnutí: koho uvést jako provozovatele dema – tebe jménem a e-mailem (např. jirka.zednik@gmail.com), nebo neutrální „Demo projekt“ s kontaktním e-mailem?

ok, proveď změny, PR už sem mergnul, pošli pod novým commitem. 
Ohledně "koho uvést jako provozovatele dema" asi bude nejlepší neutrální? Co myslíš?

Weighing privacy concerns against GDPR identification requirements for demo projects.

Ano, neutrální je lepší. Stránka nebude veřejně spojená s tvým jménem a pro ukázku na pohovor je „demo projekt“ upřímné označení. Jedna věc ale zůstává: kdo na stránce nechá e-mail, musí mít kam napsat kvůli svým údajům (GDPR). Potřebuji tedy funkční kontaktní e-mail a nechci si ho vymýšlet.

Jaký kontaktní e-mail uvést u neutrálního provozovatele „ETF Dvojče – ukázkový projekt“ (patička, zásady, e-maily)?
Jiný e-mail (napíšu)

Jaký e-mail mám uvést? Napiš mi ho a hned se pustím do změn.

etf-dvojce@seznam.cz

Hlavní větev po sloučení obsahuje přesně to, co bylo v PR. Založím novou větev, krátce doplním specifikaci a plán (v3) a změny provedu stejným postupem se subagenty a kontrolou.

Všechny tři změny jsou hotové a jsou v main (b700ccb..8a4fd06). Jde o 5 commitů navazujících přímo na tvůj merge. Testy prošly (333 unit, 14 build, 34 E2E), lint i build jsou v pořádku.

1) Název „ETF Dvojče“

Nový název je na stránce, v meta/OG, v PDF, v e-mailových textech a v README. Obě reklamy i OG obrázek jsem znovu vygeneroval z dat.
Přidal jsem test, který selže, kdyby se „Indexák“ nebo „Clientelo“ znovu objevil v kódu, testech, reklamách nebo v textu PDF.

2) Neutrální provozovatel

Na stránce je teď „ETF Dvojče – ukázkový projekt“ s kontaktem etf-dvojce@seznam.cz, bez IČO, adresy a telefonu.
Zásady i FAQ říkají, že jde o demo a údaje se nikomu nepředávají. Oba souhlasy u telefonu zůstaly, aby bylo vidět, jak by fungoval ostrý provoz.
Clientelo je jen v README jako kontext zadání. README teď rozlišuje „Demo: připraveno“ a „Před ostrým spuštěním u klienta“: výměna souboru operator.ts, seznam partnerů, právník, účty a data Trading 212/Fio.

3) Bez double opt-in

Po odeslání formuláře je na /dekujeme hned „Hotovo. Návod je váš.“ a tlačítko „Stáhnout návod (PDF)“. Brevo zároveň pošle e-mail s návodem. Pod tím je výběr brokera a nepovinný telefon.
/potvrzeno zmizela a stará adresa vede přes přesměrování 301 na /dekujeme. Krok doi_confirmed z měření zmizel.
README: v tabulce konverze je místo potvrzení e-mailu řádek „stažení PDF 60–80 %“. Hypotéza H3 je teď „telefon nad PDF vs. pod ním“ (vzorek ~2 213 leadů, tj. ~55 300 návštěv na variantu).
Kontrola našla jednu skutečnou chybu, která vznikla s touto změnou. Když Brevo kontakt odmítne kvůli konfliktu identifikátoru, lead se dřív tiše ztratil. Teď to zkusí znovu, takže e-mail se do seznamu dostane vždy.

Rozhodnutí, která jsem udělal za tebe (s cenou, kdyby byla špatně):

Oba souhlasy u telefonu jsem v demu nechal a zásady říkají, že se nic nepředává. Cena: souhlas k neexistujícím partnerům může působit zvláštně.
Brevo kontakt páruji přes ext_id = aid, jinak by broker a telefon skončily u kontaktu bez e-mailu. Při konfliktu se pokus opakuje s novým aid. Cena: u vracejícího se návštěvníka s novým aid může broker a telefon skončit u samostatného kontaktu bez e-mailu (popsané v README, ověří se živým testem v Brevu).
Text „Stejný návod jsme vám poslali i e-mailem.“ zůstal bez podmínky. Cena: nebude pravda u vracejícího se kontaktu, dokud se v Brevu nepovolí opakované spuštění automatizace (je v checklistu).
Verze souhlasu s cookies zůstala 2026-10-11, protože jeho text se neměnil. Verze souhlasu ve formuláři je nová, 2026-10-13.
Pushnul jsem rovnou do main fast-forwardem, jak jsi chtěl.

Pokud máš Vercel napojený na main, právě se to nasazuje. Pak ještě v README doplnit produkční URL a pustit produkční smoke testy (BASE_URL=… npm run test:e2e -- tests/e2e/production.spec.ts). Ty ověří i přesměrování z /potvrzeno a CSP hlavičky.

2026 10 11 etf dvojcata landing design
Document·MD 
Diagnosing why phone submission fails without a broker.

Než navrhnu hlášku, potřebuji zjistit, proč to vůbec selhává. Podle návrhu má jít telefon odeslat i bez výběru brokera, takže to vypadá spíš na chybu než na chybějící validaci. Podívám se do kódu.

Klient i server posílají telefon bez brokera správně. Podle kódu má projít, takže chyba vzniká až v odpovědi Brevo. Ověřím v dokumentaci, jak Brevo páruje kontakty.

Read developers.brevo.com
https://developers.brevo.com/reference/createcontact
Didn't run

Zastavil jsem se. Dokumentaci Brevo jsem chtěl otevřít jen kvůli ověření, jak páruje kontakty, a ten krok jsi odmítl.

Z kódu zatím vím tohle: telefon má jít odeslat i bez výběru brokera. Klient (PhoneOffer) posílá telefon samostatně a server (/api/profile) brokera nevyžaduje. Hláška „Něco se nepovedlo, zkuste to znovu.“ se zobrazí, jen když API vrátí chybu. Tady je to nejspíš 502, protože požadavek do Brevo selhal. Nová hláška „Vyberte prosím brokera“ by tedy jen zakryla chybu, kterou je potřeba opravit. A nutit návštěvníka vybírat brokera kvůli telefonu by snížilo počet telefonů, o které Clientelu jde nejvíc.

Pravděpodobná příčina: když broker vybraný není, telefon je první zápis do profilu. Brevo nejspíš kontakt podle ext_id (= aid) nenajde, nebo odmítne připsat telefon ke kontaktu vytvořenému formulářem. Jistotu dá až skutečná odpověď Brevo, kterou server zapisuje do logu.

Jak dál? Stačí jedna z možností:

Pošli mi řádek z Vercel → Logs pro /api/profile u neúspěšného pokusu. Je tam [brevo] <status> <kód>, např. [brevo] 400 duplicate_parameter. Podle něj opravím přesně.
Povol mi otevřít dokumentaci Brevo. Ověřím, jak se kontakt hledá podle ext_id, a opravu postavím na tom.
Chceš jen tu hlášku i tak? Udělám ji, ale chyba při odeslání telefonu by zůstala.

už to funguje, asi sem to nějak špatně zadával

Dobře, tak to nechávám, jak to je.

Jedna věc by to mohla vysvětlit: /api/profile má limit 20 požadavků za 10 minut z jedné IP adresy. Do limitu se počítá i každé ťuknutí na brokera. Při opakovaném testování se dá rychle vyčerpat a stránka pak ukáže obecné „Něco se nepovedlo, zkuste to znovu.“, protože chyba z překročení limitu nemá vlastní hlášku. Po pár minutách to zase funguje, což by sedělo na to, co jsi viděl.

Jestli chceš, můžu pro ten případ doplnit vlastní hlášku, např. „Příliš mnoho pokusů za krátkou dobu. Zkuste to prosím za pár minut.“, aby to příště nepůsobilo jako chyba.

jo to bude nejspíš ono, v brevu v "contacts" i vidím jednotlivé záznamy.

To sedí. Každé ťuknutí na brokera je samostatný zápis do Brevo, takže při testování se limit naplní rychle a další pokusy pak končí obecnou chybou.

Můžu to vylepšit dvěma drobnostmi:

Vlastní hláška při překročení limitu: „Příliš mnoho pokusů za krátkou dobu. Zkuste to prosím za pár minut.“
Výběr brokera odesílat s krátkým zpožděním, aby se při překlikávání uložila jen poslední volba. Tím se šetří limit i počet zápisů v Brevo.

Mám to udělat v novém PR?

za mě není potřeba, podle mě by neměla nastat situace kdy by uživatel posílal tolik requestu..to se asi stane jen při testování ne?

Ano, běžný návštěvník se k limitu nedostane. Typicky jednou až dvakrát ťukne na brokera a jednou odešle telefon, což jsou zhruba tři požadavky z dvaceti povolených za 10 minut.

Jediná výjimka by mohla nastat při velké kampani. Limit se počítá podle IP adresy a čeští mobilní operátoři sdílejí jednu IP mezi mnoho zákazníků. U /api/profile je to s rezervou dvaceti požadavků nepravděpodobné. Citlivější je limit formuláře (5 odeslání za 10 minut), a ten už je v docs/brevo-setup.md §9.7 jako položka „sledovat první dny kampaně“. Pro demo a pohovor se tím zabývat nemusíš.

tak za mě jsme u konec, vše jsem nastavil, ověřil a otestoval. 
Pojď prosím udělat závěrečné review celého projektu od zadání až k řešení, ideálně s využitím subagentu. Zkontroluj taky pečlivě readme.md a co můžeš z brevo-setup.md ověřit sám, tak ověř.

Reviewing project documentation for production setup details.

Pustím se do toho. Nejdřív stáhnu aktuální stav a najdu produkční URL, pak paralelně spustím čtyři nezávislé recenzenty: soulad se zadáním, README, ověření produkce podle brevo-setup.md a technika s daty.

Projekt je technicky v dobrém stavu, ale README tvrdí, že web nikde neběží, a tři věci na stránce bych před odevzdáním opravil. Review dělali čtyři nezávislí recenzenti: soulad se zadáním, README, produkce podle brevo-setup.md a kód s daty. Na produkci (https://etf-dvojce.vercel.app) nikdo neodeslal skutečný kontakt.

Co je v pořádku:

Kód: žádná kritická chyba. Lokálně prošlo 366 unit, 19 build a 57 E2E testů, produkční E2E 65/65.
Bezpečnost: hlavičky a CSP na produkci přesně sedí s konfigurací. Cizí původ požadavku API odmítne a omezení počtu odeslání (Upstash) je aktivní.
Souhlasy: bez souhlasu nic neodchází do Meta ani Google. Po přijetí se Pixel, GA4 i PostHog spustí.
Data: všech 134 hodnot má zdroj a datum, namátkou tři TER sedí s vydavateli. PDF obsahuje ověřený Trading 212 a Fio je označený jako neověřený.
Z brevo-setup.md jsem ověřil:
16 atributů Brevo sedí 1:1 s kódem.
12 proměnných prostředí sedí s .env.example.
/dekujeme má noindex a /potvrzeno vrací 404.
Zadání: splněné téměř ve všech bodech.

Měření na produkci: LCP 2,0 s (medián z 5 běhů Lighthouse), cíl 1,5 s tedy splněný není. CLS je 0, přístupnost, best practices a SEO mají 1,00.

Co bych opravil před odevzdáním:

README je zastaralé. Tvrdí, že web nikde neběží, nasazení neproběhlo a produkční URL „ČEKÁ“. Tytéž zastaralé údaje jsou i v brevo-setup.md §9.5 a §9.8. README test tyto zastaralé věty navíc vyžaduje, takže se musí upravit spolu s README. Nahoru bych přidal krátké shrnutí s odkazem na web a na tři odpovědi ze zadání.
Cookie lišta zakrývá formulář na menších telefonech (375×667, 360×740, typicky prohlížeč uvnitř aplikace Facebooku nebo Instagramu). Je to na přiloženém snímku. Testy hlídaly jen 390×844.
aid odchází se souhlasem v adrese /dekujeme?aid= do GA4 a Meta Pixelu. README tvrdí opak a aid je zároveň klíč, kterým se ukládá telefon.
Hero B neukazuje ISIN, přitom je to hlavní motiv reklamy B.

Doporučené drobnosti:

GET na API vrací chybu 500 místo 405.
Cookie _fbc chybí na stránce /cookies a nemaže se po odvolání souhlasu.
Gramatika: v PDF „Návod pro Fio banka“, zdvojený popisek poplatku u Trading 212, „3–4 strany“ (PDF má 4).
Na mobilu jsou oříznuté názvy fondů.
Tlačítko „Získat návod“ v Meta reklamě neexistuje, je potřeba vybrat některé z nabídky Meta.
Serverová funkce běží v USA (iad1), ne ve Frankfurtu.

Provozovatel „ukázkový projekt“ zůstává záměrně.

Souhrn s tabulkou bodů ze zadání je v ZAVERECNE-REVIEW.md. Podrobné zprávy jsou vedle něj v .superpowers/final-review/ (01 až 04).

Mám body 1–4 a ty drobnosti opravit stejným postupem do nového PR?

Zaverecne review
Document·MD 

Ano, body 1–4 a ty drobnosti opravit stejným postupem do nového PR

Pouštím se do toho stejným postupem: plán, implementace se subagenty, kontrola každého úkolu, závěrečná kontrola a nové PR.