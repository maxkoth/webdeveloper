// Pure formatters shared by the live (client) components.

export function money(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Signed percentage from a fraction (0.12 → "+12.0%"). */
export function pct(frac: number | null | undefined, signed = true): string {
  if (frac == null || !isFinite(frac)) return "—";
  const v = frac * 100;
  const sign = signed && v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}
