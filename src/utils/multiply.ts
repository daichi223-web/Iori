/**
 * Multiplies two numbers and returns their product
 * @param a - First number
 * @param b - Second number
 * @returns The product of a and b
 * @throws {TypeError} If inputs are not valid numbers
 */
export function multiply(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new RangeError('Arguments must be finite numbers');
  }
  
  return a * b;
}