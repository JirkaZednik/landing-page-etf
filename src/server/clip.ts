/** Free-text request fields written to Brevo attributes: trimmed, at most 100 characters. */
export const clip = (s: string | undefined): string => (s ?? '').trim().slice(0, 100);
