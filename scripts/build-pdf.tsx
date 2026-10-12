import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToFile } from '@react-pdf/renderer';
import { GuideDocument } from '../src/pdf/GuideDocument';
import { getData, getBrokers, validateData, validateBrokers } from '../src/lib/pairs';

const OUT = fileURLToPath(new URL('../public/navod-etf.pdf', import.meta.url));

const errors = [...validateData(getData()), ...validateBrokers(getBrokers(), getData())];
if (errors.length) {
  console.error('build-pdf: data validation failed:\n' + errors.join('\n'));
  process.exit(1); // neověřená data do PDF nepustíme
}
mkdirSync(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });
await renderToFile(<GuideDocument />, OUT);
console.log(`build-pdf: wrote ${OUT}`);
