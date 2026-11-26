// Winning tickets out of one million; zero also means the target is ineligible.
export function upgradeThreshold(source, target) {
  if (!Number.isFinite(source) || !Number.isFinite(target) || source <= 0 || target <= source) return 0;
  const a = Math.round(source * 1e9), b = Math.round(target * 1e9);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !a || b <= a) return 0;
  const from = BigInt(a), to = BigInt(b);
  // Compare before rounding: even a fraction above 75% must be rejected.
  return from * 4n > to * 3n ? 0 : Number(from * 1000000n / to);
}
