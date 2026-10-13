import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';

const STYLES_DIR = fileURLToPath(new URL('../styles/', import.meta.url));

/** Design tokens from the single source of truth, src/styles/tokens.scss. */
export function loadTokens(): { paper: string; ink: string; signal: string; muted: string; rule: string } {
  const css = compileString(
    '@use "tokens" as t; :root{--paper:#{t.$white};--ink:#{t.$ink};--signal:#{t.$euro-d};--muted:#{t.$muted};--rule:#{t.$line}}',
    { loadPaths: [STYLES_DIR] },
  ).css;
  const tok = (n: string) => {
    const m = css.match(new RegExp(`--${n}:\\s*([^;}\\s]+)`));
    if (!m) throw new Error(`token ${n} missing`);
    return m[1];
  };
  return { paper: tok('paper'), ink: tok('ink'), signal: tok('signal'), muted: tok('muted'), rule: tok('rule') };
}
