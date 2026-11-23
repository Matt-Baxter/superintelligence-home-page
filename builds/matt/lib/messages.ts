// User-facing error messages, looked up by a short code in the URL. Only these fixed sentences
// are ever shown, so nothing a visitor types into a URL is echoed back onto the page.

export const MESSAGES: Record<string, string> = {
  taken: "That username is taken.",
  username: "Username must be 3 to 30 characters: letters, numbers, underscores or hyphens.",
  password: "Password must be at least 8 characters.",
  credentials: "Username or password is incorrect.",
  server: "Something went wrong. Please try again.",
};

export function messageFor(code: string | undefined): string | null {
  return code && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : null;
}
