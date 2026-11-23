import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  taken: "That username is already taken. Please choose another.",
  username: "Username must be 3 to 30 characters using letters, numbers, underscores or hyphens.",
  password: "Password must be at least 8 characters.",
  credentials: "Incorrect username or password.",
  rate: "Too many attempts from this network. Please wait a few minutes and try again.",
  invalid: "Could not complete that request. Please try again.",
};

export function AuthForm({
  mode,
  errorCode,
  returnTo,
}: {
  mode: "signin" | "signup";
  errorCode?: string;
  returnTo: string;
}) {
  const isSignUp = mode === "signup";
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.invalid : null;

  return (
    <div className="auth-card">
      <form
        method="post"
        action={isSignUp ? "/api/auth/signup" : "/api/auth/signin"}
        className="auth-form"
      >
        <h1>{isSignUp ? "Create an account" : "Sign in"}</h1>
        <p style={{ margin: "0 0 0.5rem", color: "var(--muted)", fontSize: "0.875rem" }}>
          {isSignUp
            ? "Vote on landmark superintelligence stories and keep your own saved reading list. Only a username and password are stored."
            : "Welcome back. Sign in to vote on stories and open your saved list."}
        </p>

        {errorMessage && (
          <p className="form-error" role="alert">
            {errorMessage}
          </p>
        )}

        <input type="hidden" name="returnTo" value={returnTo} />

        {/* Honeypot anti-bot field (hidden from assistive tech and human readers) */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="auth-website">Leave this field blank</label>
          <input id="auth-website" type="text" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <label htmlFor="auth-username">Username</label>
        <input
          id="auth-username"
          name="username"
          type="text"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9_-]{3,30}"
          autoComplete="username"
        />
        {isSignUp && (
          <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            3 to 30 letters, numbers, underscores or hyphens.
          </span>
        )}

        <label htmlFor="auth-password">Password</label>
        <input
          id="auth-password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={200}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
        {isSignUp && (
          <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            At least 8 characters; stored only as a salted scrypt hash.
          </span>
        )}

        <button type="submit" className="btn-primary" style={{ marginTop: "0.875rem" }}>
          {isSignUp ? "Sign up" : "Sign in"}
        </button>

        <p style={{ margin: "0.75rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
          {isSignUp ? (
            <>
              Already have an account? <Link href={`/signin?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link>
            </>
          ) : (
            <>
              Need an account? <Link href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}>Sign up</Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
