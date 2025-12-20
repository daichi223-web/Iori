/**
 * Subtracts b from a
 * @param a - The number to subtract from
 * @param b - The number to subtract
 * @returns The result of a - b
 * @throws {TypeError} If parameters are not numbers
 */
export function subtract(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both parameters must be numbers');
  }
  
  if (!isFinite(a) || !isFinite(b)) {
    throw new RangeError('Parameters must be finite numbers');
  }
  
  return a - b;
}