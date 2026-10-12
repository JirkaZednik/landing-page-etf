// Read at call time. Deployed functions get process.env; `astro dev` exposes .env via import.meta.env only.
export const env = (key: string): string =>
  process.env[key] ?? ((import.meta.env as Record<string, string | undefined>)[key] ?? '');
