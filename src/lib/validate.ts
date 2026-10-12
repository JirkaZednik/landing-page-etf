// Shared by client and server; no dependencies.

const EMAIL_RE = /^[^\s@]+@([^\s@.]+\.)+[^\s@.]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidEmail(s: string): boolean {
  const t = s.trim();
  return t.length <= 254 && EMAIL_RE.test(t);
}

export function normalizeCzPhone(s: string): string | null {
  let t = s.replace(/[\s\-.()]/g, '');
  if (t.startsWith('00420')) t = '+420' + t.slice(5);
  else if (/^420\d{9}$/.test(t)) t = '+' + t;
  else if (/^\d{9}$/.test(t)) t = '+420' + t;
  return /^\+420[2-9]\d{8}$/.test(t) ? t : null;
}

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}
