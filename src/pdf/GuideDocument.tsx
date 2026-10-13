import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Circle, Document, Font, G, Link, Page, Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import type { Broker, Fund, Group } from '../lib/types';
import { getBrokers, getData, originalsOf, twinsAtBroker, twinsSortedByTer } from '../lib/pairs';
import { formatDateCz, formatTer } from '../lib/format';
import { OPERATOR } from '../lib/operator';
import { loadPalette, multiply } from '../styles/palette';
import {
  CURVE_ORIG, CURVE_TWIN, CURVE_WIDTH, LABEL_SIZE, LOGO_CIRCLES, LOGO_LENS, LOGO_VIEWBOX, PILL_HEIGHT, STARS, STAR_R,
  TWINS_VIEWBOX, twinsPills,
} from '../lib/twins-art';

// Site fonts as static TTFs with Czech diacritics (OFL, see public/fonts/pdf/OFL-*.txt).
const FONT_DIR = fileURLToPath(new URL('../../public/fonts/pdf/', import.meta.url));
const DISPLAY = 'Bricolage Grotesque';
const TEXT = 'Figtree';
Font.register({
  family: DISPLAY,
  fonts: [
    { src: join(FONT_DIR, 'BricolageGrotesque-SemiBold.ttf'), fontWeight: 600 },
    { src: join(FONT_DIR, 'BricolageGrotesque-ExtraBold.ttf'), fontWeight: 800 },
  ],
});
Font.register({
  family: TEXT,
  fonts: [
    { src: join(FONT_DIR, 'Figtree-Regular.ttf'), fontWeight: 400 },
    { src: join(FONT_DIR, 'Figtree-Bold.ttf'), fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // čeština: bez dělení slov

const C = loadPalette(); // barvy jen z src/styles/tokens.scss
const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');

const s = StyleSheet.create({
  page: { backgroundColor: C.white, color: C.ink, fontFamily: TEXT, fontSize: 9.5, lineHeight: 1.35, padding: 36, paddingBottom: 70 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  brand: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 13, color: C.night, marginLeft: 6 },
  cover: { backgroundColor: C.night, borderRadius: 16, paddingTop: 18, paddingBottom: 20, paddingHorizontal: 30, alignItems: 'center', marginBottom: 6 },
  h1: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, lineHeight: 1.08, color: C.white, textAlign: 'center', marginTop: 10, marginBottom: 8 },
  lead: { color: C['on-night-muted'], fontSize: 10, lineHeight: 1.4, textAlign: 'center' },
  asOf: { color: C['on-night-muted'], fontSize: 8, marginTop: 8, textAlign: 'center' },
  h2: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 15, lineHeight: 1.15, color: C.night, marginTop: 18, marginBottom: 6, paddingLeft: 8, borderLeftWidth: 4, borderLeftColor: C.gold },
  h3: { fontFamily: DISPLAY, fontWeight: 600, fontSize: 10.5, color: C.night, marginTop: 9, marginBottom: 3 },
  p: { marginBottom: 5 },
  ticker: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 8.5, color: C['euro-d'], backgroundColor: C.cloud, borderRadius: 5, paddingTop: 2, paddingBottom: 1.5, paddingHorizontal: 5 },
  tickerLow: { color: C.night, backgroundColor: C.gold },
  terLow: { fontWeight: 700, color: C['mint-text'] },
  tickerOrig: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 8.5, color: C.night, paddingHorizontal: 5 },
  arrow: { color: C['euro-d'] },
  muted: { color: C.muted, fontSize: 7.5 },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.75, borderBottomColor: C.line, paddingVertical: 3 },
  cTicker: { width: 72, flexDirection: 'row', alignItems: 'center' },
  cName: { flexGrow: 1, flexShrink: 1, paddingRight: 6 },
  cIsin: { width: 86, fontSize: 8.5 },
  cTer: { width: 44, textAlign: 'right' },
  cKind: { width: 62, textAlign: 'right', color: C.muted, fontSize: 8.5 },
  li: { flexDirection: 'row', marginBottom: 3 },
  liNum: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.mint, marginRight: 6, alignItems: 'center', justifyContent: 'center' },
  liNumText: { fontFamily: DISPLAY, fontWeight: 800, fontSize: 7.5, color: C.night, lineHeight: 1 },
  liText: { flexGrow: 1, flexShrink: 1, paddingTop: 1 },
  verified: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  footer: { position: 'absolute', left: 36, right: 36, bottom: 18, fontSize: 6.8, color: C.muted, borderTopWidth: 0.75, borderTopColor: C.line, paddingTop: 5, paddingRight: 52 },
  pageNo: { position: 'absolute', right: 0, top: 5, fontSize: 7, color: C.muted },
});

/** Logo mark (two overlapping circles); the overlap is painted as the multiplied colour, like the site. */
function LogoMark({ height = 14 }: { height?: number }) {
  const { left, right } = LOGO_CIRCLES;
  return (
    <Svg width={(height * LOGO_VIEWBOX.width) / LOGO_VIEWBOX.height} height={height} viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}>
      <Circle cx={left.cx} cy={left.cy} r={left.r} fill={C.euro} />
      <Circle cx={right.cx} cy={right.cy} r={right.r} fill={C.gold} />
      <Path d={LOGO_LENS} fill={multiply(C.euro, C.gold)} />
    </Svg>
  );
}

/** The hero illustration: two parallel curves, pills labelled from data, arc of gold dots. */
function TwinsArt({ width = 190 }: { width?: number }) {
  const { orig, twin } = twinsPills('sp500');
  const k = width / TWINS_VIEWBOX.width;
  const pill = (p: typeof orig, bg: string, op: number, fg: string) => (
    <View style={{ position: 'absolute', left: p.x * k, top: p.y * k, width: p.width * k, height: PILL_HEIGHT * k, borderRadius: (PILL_HEIGHT * k) / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={p.width * k} height={PILL_HEIGHT * k}>
        <Rect x={0} y={0} width={p.width * k} height={PILL_HEIGHT * k} rx={(PILL_HEIGHT * k) / 2} fill={bg} fillOpacity={op} />
      </Svg>
      <Text style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: LABEL_SIZE * k, lineHeight: 1, color: fg }}>{p.label}</Text>
    </View>
  );
  return (
    <View style={{ width, height: TWINS_VIEWBOX.height * k }}>
      <Svg width={width} height={TWINS_VIEWBOX.height * k} viewBox={`0 0 ${TWINS_VIEWBOX.width} ${TWINS_VIEWBOX.height}`}>
        <Path d={CURVE_ORIG} stroke={C.euro} strokeWidth={CURVE_WIDTH} strokeLinecap="round" fill="none" />
        <Path d={CURVE_TWIN} stroke={C.gold} strokeWidth={CURVE_WIDTH} strokeLinecap="round" fill="none" />
        <G>{STARS.map((d, i) => <Circle key={i} cx={d.cx} cy={d.cy} r={STAR_R} fill={C.gold} />)}</G>
      </Svg>
      {pill(orig, C.white, 0.14, C.white)}
      {pill(twin, C.gold, 1, C.night)}
    </View>
  );
}

/** Mint check disc (as in the site's trust row). */
function Check() {
  return (
    <Svg width={10} height={10} viewBox="0 0 18 18" style={{ marginRight: 4 }}>
      <Circle cx={9} cy={9} r={9} fill={C.mint} />
      <Path d="M5 9.4l2.6 2.5L13 6.6" stroke={C.night} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Ids of the lowest-TER funds in a list, only when the list actually has a cheaper and a dearer fund. */
function lowestTer(funds: Fund[]): Set<string> {
  if (funds.length < 2) return new Set();
  const min = Math.min(...funds.map((f) => f.ter.value));
  if (funds.every((f) => f.ter.value === min)) return new Set();
  return new Set(funds.filter((f) => f.ter.value === min).map((f) => f.id));
}

function Ticker({ children, low }: { children: string; low?: boolean }) {
  return <Text style={low ? [s.ticker, s.tickerLow] : s.ticker}>{children}</Text>;
}

const kindLabel = (d: 'acc' | 'dist') => (d === 'acc' ? 'akumulační' : 'distribuční');

function Source({ url, asOf, label = 'zdroj' }: { url: string; asOf: string; label?: string }) {
  return (
    <Text style={s.muted}>
      {label}: <Link src={url} style={{ color: C.muted }}>{host(url)}</Link>, k {formatDateCz(asOf)}
    </Text>
  );
}

function GroupAtBroker({ broker, group }: { broker: Broker; group: Group }) {
  const rows = twinsAtBroker(broker.id, group.id);
  const asOf = formatDateCz(broker.asOf);
  const low = lowestTer(rows.map((r) => r.fund));
  return (
    <View wrap={false}>
      <Text style={s.h3}>
        {group.label}
        {!group.exactTwin && group.twins.length > 0 ? ' – nejbližší alternativa, jiný index' : ''}
      </Text>
      {!group.exactTwin && group.note ? <Text style={[s.muted, { marginBottom: 2 }]}>{group.note}</Text> : null}
      {group.twins.length === 0 ? null : rows.length === 0 ? (
        <Text style={s.p}>U {broker.name} jsme k {asOf} fond z této skupiny nenašli.</Text>
      ) : (
        rows.map(({ fund, ticker }) => (
          <View key={fund.id} style={s.row}>
            <View style={s.cTicker}><Ticker low={low.has(fund.id)}>{ticker}</Ticker></View>
            <Text style={s.cName}>{fund.name.value}</Text>
            <Text style={s.cIsin}>{fund.isin.value}</Text>
            <Text style={low.has(fund.id) ? [s.cTer, s.terLow] : s.cTer}>{formatTer(fund.ter.value)}</Text>
            <Text style={s.cKind}>{kindLabel(fund.distribution.value)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function BrokerSection({ broker }: { broker: Broker }) {
  const groups = getData().groups;
  const hasSteps = Array.isArray(broker.steps?.value) && broker.steps.value.length > 0;
  return (
    <View>
      <Text style={s.h2} minPresenceAhead={80}>Návod pro {broker.name}</Text>
      {broker.buyFee?.value ? (
        <View wrap={false} style={{ marginBottom: 3 }}>
          <Text style={s.p}>Poplatek za nákup: {broker.buyFee.value}</Text>
          <Source url={broker.buyFee.sourceUrl} asOf={broker.buyFee.asOf} />
        </View>
      ) : null}
      {broker.listings.length === 0 ? (
        <Text style={s.p}>U tohoto brokera jsme dostupnost zatím neověřili.</Text>
      ) : (
        groups.map((g) => <GroupAtBroker key={g.id} broker={broker} group={g} />)
      )}
      {hasSteps ? (
        <View wrap={false}>
          <Text style={s.h3}>Postup krok za krokem</Text>
          {broker.steps.value.map((step, i) => (
            <View key={i} style={s.li} wrap={false}>
              <View style={s.liNum}><Text style={s.liNumText}>{i + 1}</Text></View>
              <Text style={s.liText}>{step}</Text>
            </View>
          ))}
          <Source url={broker.steps.sourceUrl} asOf={broker.steps.asOf} />
        </View>
      ) : (
        <View wrap={false}>
          <Text style={s.h3}>Postup krok za krokem</Text>
          <Text style={s.p}>Postup jsme u tohoto brokera zatím neověřili.</Text>
        </View>
      )}
      <View style={s.verified}>
        <Check />
        <Text style={s.muted}>Údaje ověřeny na stránkách brokera k {formatDateCz(broker.asOf)}</Text>
      </View>
    </View>
  );
}

function PairsTable() {
  const data = getData();
  return (
    <View>
      <Text style={s.h2} minPresenceAhead={100}>
        Všechny páry: originál z NYSE <Text style={s.arrow}>→</Text> evropské dvojče
      </Text>
      {data.groups.map((g) => {
        const originals = originalsOf(g.id);
        const twins = twinsSortedByTer(g.id);
        const low = lowestTer(twins);
        return (
          <View key={g.id} wrap={false} style={{ marginBottom: 4 }}>
            <Text style={s.h3}>{g.label}</Text>
            {originals.map((f) => (
              <View key={f.id} style={s.row}>
                <View style={s.cTicker}><Text style={s.tickerOrig}>{f.id}</Text></View>
                <Text style={s.cName}>originál</Text>
                <Text style={s.cIsin}>{f.exchange.value}</Text>
                <Text style={s.cTer}>{formatTer(f.ter.value)}</Text>
                <Text style={s.cKind}> </Text>
              </View>
            ))}
            {twins.length === 0 ? (
              <Text style={s.muted}>{g.note ?? 'Evropské dvojče zatím neuvádíme.'}</Text>
            ) : (
              twins.map((f) => (
                <View key={f.id} style={s.row}>
                  <View style={s.cTicker}>
                    <Text style={[s.arrow, { width: 11 }]}>→</Text>
                    <Ticker low={low.has(f.id)}>{f.id}</Ticker>
                  </View>
                  <Text style={s.cName}>{f.name.value}</Text>
                  <Text style={s.cIsin}>{f.isin.value}</Text>
                  <Text style={low.has(f.id) ? [s.cTer, s.terLow] : s.cTer}>{formatTer(f.ter.value)}</Text>
                  <Text style={s.cKind}>{f.distribution.value === 'acc' ? 'akum.' : 'dist.'}</Text>
                </View>
              ))
            )}
          </View>
        );
      })}
      <Text style={s.muted}>Zdroj: vydavatelé fondů (factsheety), k {formatDateCz(data.asOf)}</Text>
    </View>
  );
}

function Taxes() {
  return (
    <View wrap={false}>
      <Text style={s.h2}>Akumulace, distribuce a daně v ČR</Text>
      <Text style={s.p}>
        Srážková daň z amerických dividend je u obou cest srovnatelná: irský fond platí v USA 15 %, český investor u amerického ETF s formulářem W-8BEN také 15 %.
      </Text>
      <Text style={s.p}>
        Rozdíl je v české dani. Dividendy z amerického ETF se v Česku daní každý rok a musíte je uvést v daňovém přiznání. U akumulačního irského fondu se dividendy reinvestují uvnitř fondu a zisk z prodeje po více než 3 letech držení (časový test) je od daně z příjmů osvobozen.
      </Text>
      <Text style={s.p}>Pro českého drobného investora je proto akumulační evropské dvojče daňově spíš výhodnější.</Text>
      <Text style={s.p}>Obecná informace, ne daňové poradenství.</Text>
      <Text style={s.muted}>
        Zdroje: <Link src="https://www.irs.gov/forms-pubs/about-form-w-8-ben" style={{ color: C.muted }}>irs.gov (formulář W-8BEN)</Link>
        {' · '}
        <Link src="https://www.zakonyprolidi.cz/cs/1992-586" style={{ color: C.muted }}>zakonyprolidi.cz (zákon č. 586/1992 Sb.)</Link>
      </Text>
    </View>
  );
}

export function GuideDocument() {
  const data = getData();
  const brokers = getBrokers();
  return (
    <Document title="Jak koupit S&P 500 a další americké indexy u českých brokerů" author={OPERATOR.name} language="cs">
      <Page size="A4" style={s.page}>
        <View fixed style={s.footer}>
          <Text>
            {OPERATOR.name} · {OPERATOR.email} · {OPERATOR.note}
          </Text>
          <Text>
            Informace mají obecnou povahu a nejsou investičním doporučením ani daňovým poradenstvím. Investování nese riziko ztráty, minulé výnosy nezaručují budoucí. Ochranné známky patří jejich vlastníkům; stránka s vydavateli fondů ani brokery nespolupracuje.
          </Text>
          <Text style={s.pageNo} render={({ pageNumber, totalPages }) => `strana ${pageNumber}/${totalPages}`} />
        </View>
        <View style={s.brandRow}>
          <LogoMark />
          <Text style={s.brand}>ETF Dvojče</Text>
        </View>
        <View style={s.cover}>
          <TwinsArt />
          <Text style={s.h1}>Jak koupit S&P 500 a další americké indexy u XTB, Trading 212, Fio a Degiro</Text>
          <Text style={s.lead}>
            Americké ETF jako VOO evropský broker drobnému investorovi neprodá, protože k nim neexistuje dokument KID. Na stejné indexy ale existují evropské fondy – tento návod ukazuje, jak je u vašeho brokera najít.
          </Text>
          <Text style={s.asOf}>Ověřeno k {formatDateCz(data.asOf)}</Text>
        </View>

        {brokers.map((b) => (
          <BrokerSection key={b.id} broker={b} />
        ))}
        <PairsTable />
        <Taxes />

      </Page>
    </Document>
  );
}
