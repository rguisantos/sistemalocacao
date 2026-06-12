/** Serializa BigInt (version) e Prisma.Decimal para JSON */
export const json = (data: unknown) =>
  JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
