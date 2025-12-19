/**
 * Validates an email address using a regular expression.
 * @param email The email address string to validate.
 * @returns True if the email is valid, false otherwise.
 */
export function isValidEmail(email: string): boolean {
  // Reject leading/trailing whitespace rather than trimming silently.
  if (email !== email.trim()) {
    return false;
  }

  // A common and reasonably robust regex for email validation.
  // It checks for a basic format: something@something.domain
  // It does not cover all edge cases per RFCs, but is generally sufficient for most applications.
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
