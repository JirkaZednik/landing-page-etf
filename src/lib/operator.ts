// Jediné místo s údaji provozovatele (správce údajů). Demo běží pod neutrálním ukázkovým provozovatelem;
// pro ostré spuštění se nahradí tento soubor (+ seznam partnerů v zásadách), viz README „Před ostrým spuštěním u klienta".
export const OPERATOR = {
  name: 'ETF Dvojče – ukázkový projekt',
  email: 'etf-dvojce@seznam.cz',
  note: 'Ukázkový projekt vytvořený jako zadání pro přijímací řízení. Nejde o nabídku investičních služeb.',
} as const satisfies { name: string; email: string; web?: string; note: string };
