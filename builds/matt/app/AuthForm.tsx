import { messageFor } from "@/lib/messages";

// Shared sign-in / sign-up form: plain HTML, works with the keyboard and without JavaScript.
// (REQ-009, REQ-010, REQ-023)
export function AuthForm({ mode, error }: { mode: "signin" | "signup"; error?: string }) {
  const message = messageFor(error);
  const label = mode === "signup" ? "Sign up" : "Sign in";
  return (
    <form className="auth-form" method="post" action={`/api/auth/${mode}`}>
      <h1>{label}</h1>
      {message && (
        <p role="alert" className="form-error">
          {message}
        </p>
      )}
      <label htmlFor="username">Username</label>
      <input id="username" name="username" type="text" autoComplete="username" required />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        required
      />
      {mode === "signup" && <p className="hint">3 to 30 letters, numbers, _ or -. Password at least 8 characters.</p>}
      <button type="submit">{label}</button>
      <p className="switch">
        {mode === "signup" ? (
          <>
            Already have an account? <a href="/signin">Sign in</a>
          </>
        ) : (
          <>
            New here? <a href="/signup">Sign up</a>
          </>
        )}
      </p>
    </form>
  );
}
