const METRES_PER_KM = 1000;

/** Metres under a kilometre, kilometres with one decimal from there on. */
export function formatListDistance(metres: number, language: string): string {
  const whole = Math.round(metres);
  if (whole < METRES_PER_KM) return `${whole} m`;
  const km = new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    metres / METRES_PER_KM
  );
  return `${km} km`;
}
