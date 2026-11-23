import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  taken: "That username is already taken. Please choose another.",
  username: "Username must be 3 to 30 characters using letters, numbers, underscores or hyphens.",
  email: "Enter a valid, non-disposable email address.",
  email_taken: "An account already uses that email. Sign in instead.",
  password: "Password must be at least 8 characters.",
  credentials: "Incorrect username or password.",
  rate: "Too many attempts right now. Please wait a few minutes and try again.",
  network: "This network has reached today's sign-up limit. Please try again tomorrow.",
  invalid: "Could not complete that request. Please try again.",
};

const FREE_TIER_PERKS = [
  "Vote on stories and keep a saved reading list",
  "40 live paper analyses per day",
  "Rate items in the human review queue",
];

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
      <form method="post" action={isSignUp ? "/api/auth/signup" : "/api/auth/signin"} className="auth-form">
        <h1>{isSignUp ? "Create a free account" : "Sign in"}</h1>
        <p className="auth-lede">
          {isSignUp
            ? "Free forever. We store your username, email and a salted password hash — nothing else."
            : "Welcome back. Sign in to vote, save stories and review the queue."}
        </p>

        {isSignUp && (
          <ul className="auth-perks">
            {FREE_TIER_PERKS.map((perk) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>
        )}

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
          aria-describedby={isSignUp ? "auth-username-hint" : undefined}
        />
        {isSignUp && (
          <span id="auth-username-hint" className="field-hint">
            3 to 30 letters, numbers, underscores or hyphens. Shown publicly on reviews.
          </span>
        )}

        {isSignUp && (
          <>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              aria-describedby="auth-email-hint"
            />
            <span id="auth-email-hint" className="field-hint">
              Required, never shown publicly. Disposable addresses are not accepted.
            </span>
          </>
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
          aria-describedby={isSignUp ? "auth-password-hint" : undefined}
        />
        {isSignUp && (
          <span id="auth-password-hint" className="field-hint">
            At least 8 characters; stored only as a salted scrypt hash.
          </span>
        )}

        <button type="submit" className="btn-primary auth-submit-btn">
          {isSignUp ? "Create free account" : "Sign in"}
        </button>

        <p className="auth-switch">
          {isSignUp ? (
            <>
              Already have an account? <Link href={`/signin?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link>
            </>
          ) : (
            <>
              Need an account? <Link href={`/signup?returnTo=${encodeURIComponent(returnTo)}`}>Create one free</Link>
            </>
          )}
        </p>
        {isSignUp && (
          <p className="auth-switch">
            <Link href="/limits">See every limit and how abuse is prevented</Link>
          </p>
        )}
      </form>
    </div>
  );
}
