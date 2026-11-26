// Shared by the target picker, wheel and authoritative server draw. Use integer
// nanoTON so a decimal quote on an exact percentage boundary never loses 1%.
export function upgradePercent(source, target) {
  if (!Number.isFinite(source) || !Number.isFinite(target) || source <= 0 || target <= source) return 0;
  const a = Math.round(source * 1e9), b = Math.round(target * 1e9);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !a || b <= a) return 0;
  return Math.max(75, Number(BigInt(a) * 100n / BigInt(b)));
}
