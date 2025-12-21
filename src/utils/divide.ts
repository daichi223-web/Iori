/**
 * Divides two numbers safely with validation
 * @param dividend - The number to be divided
 * @param divisor - The number to divide by
 * @returns The result of dividend / divisor
 * @throws {Error} If divisor is zero or inputs are not finite numbers
 */
export function divide(dividend: number, divisor: number): number {
  if (!Number.isFinite(dividend) || !Number.isFinite(divisor)) {
    throw new Error('Both arguments must be finite numbers');
  }

  if (divisor === 0) {
    throw new Error('Division by zero is not allowed');
  }

  return dividend / divisor;
}