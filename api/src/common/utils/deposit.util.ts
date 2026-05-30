/**
 * Calcula el monto de seña según la configuración de la barbería.
 *
 * - PERCENTAGE: porcentaje entero del precio del servicio (ej: 30 → 30%)
 * - FIXED (default): monto fijo en pesos
 *
 * Siempre devuelve un entero redondeado hacia arriba.
 */
export function calcDeposit(
  depositType: string | null | undefined,
  depositAmount: number | null | undefined,
  servicePrice: number,
): number {
  const amount = depositAmount ?? 0;
  if (amount <= 0) return 0;

  if (depositType === 'PERCENTAGE') {
    return Math.ceil(servicePrice * amount / 100);
  }

  // FIXED (o nulo/desconocido → conservador: monto fijo)
  return Math.ceil(amount);
}
