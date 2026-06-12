/** Serializa BigInt (version) e Prisma.Decimal para JSON */
export const json = (data: unknown) =>
  JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));

/** Extrai string de req.params (Express 5 pode retornar string[]) */
export const param = (v: string | string[] | undefined): string => {
  if (Array.isArray(v)) return v[0];
  return v ?? '';
};
