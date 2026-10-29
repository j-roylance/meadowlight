/** Bigint-safe JSON for CityState snapshots (localStorage + Postgres jsonb). */

export function bigintReplacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? { __bigint: v.toString() } : v;
}

export function reviveBigints<T>(obj: unknown): T {
  const walk = (v: unknown): unknown => {
    if (v && typeof v === "object") {
      if ("__bigint" in (v as object) && Object.keys(v as object).length === 1) {
        return BigInt((v as { __bigint: string }).__bigint);
      }
      if (Array.isArray(v)) return v.map(walk);
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as object)) out[k] = walk(val);
      return out;
    }
    return v;
  };
  return walk(obj) as T;
}

export function stringifyState(value: unknown): string {
  return JSON.stringify(value, bigintReplacer);
}

export function parseState<T>(raw: string): T {
  return reviveBigints<T>(JSON.parse(raw));
}

export function cloneState<T>(value: T): T {
  return parseState(stringifyState(value));
}
