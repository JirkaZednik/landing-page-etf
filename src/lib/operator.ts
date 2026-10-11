// Převzato z patičky clientelo.cz; k odsouhlasení Clienteliem (spec §16). Jediné místo s údaji provozovatele.
export const OPERATOR = {
  name: 'Clientelo Czech s.r.o.',
  ico: '22193456',
  address: 'Platnéřská 90/13, Staré Město, 110 00 Praha 1',
  email: 'fundraising@clientelo.cz',
  phone: '+420 725 345 102',
  web: 'https://clientelo.cz',
} as const satisfies { name: string; ico: string; address: string; email: string; phone: string; web: string };
