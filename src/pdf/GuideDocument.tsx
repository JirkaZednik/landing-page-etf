import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Document, Font, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { Broker, Group } from '../lib/types';
import { getBrokers, getData, originalsOf, twinsAtBroker, twinsSortedByTer } from '../lib/pairs';
import { formatDateCz, formatTer } from '../lib/format';
import { OPERATOR } from '../lib/operator';
import { loadTokens } from './tokens';

const FONT_DIR = fileURLToPath(new URL('../../public/fonts/pdf/', import.meta.url));
Font.register({
  family: 'IxText',
  fonts: [{ src: join(FONT_DIR, 'text-regular.ttf') }, { src: join(FONT_DIR, 'text-bold.ttf'), fontWeight: 700 }],
});
Font.register({ family: 'IxMono', src: join(FONT_DIR, 'mono-regular.ttf') });
Font.registerHyphenationCallback((word) => [word]); // čeština: bez dělení slov

const C = loadTokens();
const host = (url: string) => new URL(url).hostname.replace(/^www\./, '');

const s = StyleSheet.create({
  page: { backgroundColor: C.paper, color: C.ink, fontFamily: 'IxText', fontSize: 10, lineHeight: 1.3, padding: 36, paddingBottom: 66 },
  h1: { fontSize: 24, fontWeight: 700, lineHeight: 1.15, marginBottom: 10 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 14, marginBottom: 5, borderBottomWidth: 1, borderBottomColor: C.signal, paddingBottom: 3 },
  h3: { fontSize: 10.5, fontWeight: 700, marginTop: 7, marginBottom: 2 },
  p: { marginBottom: 5 },
  mono: { fontFamily: 'IxMono', fontSize: 9 },
  signal: { color: C.signal },
  muted: { color: C.muted, fontSize: 8 },
  motif: { fontFamily: 'IxMono', fontSize: 28, lineHeight: 1.2, marginTop: 6, marginBottom: 16 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.rule, paddingVertical: 2.5 },
  cTicker: { width: 62 },
  cName: { flexGrow: 1, flexShrink: 1, paddingRight: 6 },
  cIsin: { width: 84 },
  cTer: { width: 42, textAlign: 'right' },
  cKind: { width: 62, textAlign: 'right' },
  li: { flexDirection: 'row', marginBottom: 2 },
  liNum: { width: 16 },
  liText: { flexGrow: 1, flexShrink: 1 },
  footer: { position: 'absolute', left: 36, right: 36, bottom: 18, fontSize: 7, color: C.muted, borderTopWidth: 0.5, borderTopColor: C.rule, paddingTop: 4, paddingRight: 52 },
  pageNo: { position: 'absolute', right: 36, bottom: 18, fontSize: 7, color: C.muted },
});

const kindLabel = (d: 'acc' | 'dist') => (d === 'acc' ? 'akumulační' : 'distribuční');

function Source({ url, asOf, label = 'zdroj' }: { url: string; asOf: string; label?: string }) {
  return (
    <Text style={s.muted}>
      {label}: <Link src={url} style={{ color: C.muted }}>{host(url)}</Link>, k {formatDateCz(asOf)}
    </Text>
  );
}

function Arrow({ children = '→', size }: { children?: string; size?: number }) {
  return <Text style={[s.mono, s.signal, size ? { fontSize: size } : {}]}>{children}</Text>;
}

function GroupAtBroker({ broker, group }: { broker: Broker; group: Group }) {
  const rows = twinsAtBroker(broker.id, group.id);
  const asOf = formatDateCz(broker.asOf);
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
            <Text style={[s.mono, s.cTicker]}>{ticker}</Text>
            <Text style={s.cName}>{fund.name.value}</Text>
            <Text style={[s.mono, s.cIsin]}>{fund.isin.value}</Text>
            <Text style={s.cTer}>{formatTer(fund.ter.value)}</Text>
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
              <Text style={s.liNum}>{i + 1}.</Text>
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
      <Text style={[s.muted, { marginTop: 4 }]}>Údaje ověřeny na stránkách brokera k {formatDateCz(broker.asOf)}</Text>
    </View>
  );
}

function PairsTable() {
  const data = getData();
  return (
    <View>
      <Text style={s.h2} minPresenceAhead={100}>
        Všechny páry: originál z NYSE <Arrow size={13} /> evropské dvojče
      </Text>
      {data.groups.map((g) => {
        const originals = originalsOf(g.id);
        const twins = twinsSortedByTer(g.id);
        return (
          <View key={g.id} wrap={false} style={{ marginBottom: 4 }}>
            <Text style={s.h3}>{g.label}</Text>
            {originals.map((f) => (
              <View key={f.id} style={s.row}>
                <Text style={[s.mono, s.cTicker]}>{f.id}</Text>
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
                  <Text style={[s.mono, s.cTicker]}><Arrow>→ </Arrow>{f.id}</Text>
                  <Text style={s.cName}>{f.name.value}</Text>
                  <Text style={[s.mono, s.cIsin]}>{f.isin.value}</Text>
                  <Text style={s.cTer}>{formatTer(f.ter.value)}</Text>
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
            {OPERATOR.name}, IČO {OPERATOR.ico}, {OPERATOR.address} · {OPERATOR.email} · {OPERATOR.web}
          </Text>
          <Text>
            Informace mají obecnou povahu a nejsou investičním doporučením ani daňovým poradenstvím. Investování nese riziko ztráty, minulé výnosy nezaručují budoucí. Ochranné známky patří jejich vlastníkům; stránka s vydavateli fondů ani brokery nespolupracuje.
          </Text>
        </View>
        <Text fixed style={s.pageNo} render={({ pageNumber, totalPages }) => `strana ${pageNumber}/${totalPages}`} />
        <Text style={s.h1}>Jak koupit S&P 500 a další americké indexy u XTB, Trading 212, Fio a Degiro</Text>
        <Text style={s.motif}>
          VOO <Arrow size={28}>⇄</Arrow> SPYL
        </Text>
        <Text style={s.p}>
          Americké ETF jako VOO evropský broker drobnému investorovi neprodá, protože k nim neexistuje dokument KID. Na stejné indexy ale existují evropské fondy – tento návod ukazuje, jak je u vašeho brokera najít.
        </Text>
        <Text style={[s.p, { color: C.muted }]}>Ověřeno k {formatDateCz(data.asOf)}</Text>

        {brokers.map((b) => (
          <BrokerSection key={b.id} broker={b} />
        ))}
        <PairsTable />
        <Taxes />

      </Page>
    </Document>
  );
}
