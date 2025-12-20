/**
 * Calculates Fibonacci number.
 * @param n Non-negative integer index.
 * @returns Fibonacci number at position n.
 */
export function fibonacci(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("n must be a non-negative integer");
  }

  let a = 0;
  let b = 1;

  for (let i = 0; i < n; i += 1) {
    const next = a + b;
    a = b;
    b = next;
  }

  return a;
}
