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
