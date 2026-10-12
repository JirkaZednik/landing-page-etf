export async function parseBody(req: Request): Promise<{ data: Record<string, string>; isForm: boolean }> {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const data: Record<string, string> = {};
    try {
      const json: unknown = await req.json();
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        for (const [k, v] of Object.entries(json)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') data[k] = String(v);
        }
      }
    } catch {
      return { data: {}, isForm: false };
    }
    return { data, isForm: false };
  }
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const data: Record<string, string> = {};
    try {
      for (const [k, v] of await req.formData()) if (typeof v === 'string') data[k] = v;
    } catch {
      return { data: {}, isForm: true };
    }
    return { data, isForm: true };
  }
  return { data: {}, isForm: false };
}
