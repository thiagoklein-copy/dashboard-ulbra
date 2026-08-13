export const AUTH_COOKIE = "ulbra_dashboard_auth";

export function isValidPassword(password: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return false;
  return password === expected;
}
