import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { ThemeToggle, type ThemeMode } from "./theme-toggle";

export function SiteHeader({
  user,
  initialTheme,
}: {
  user: SessionUser | null;
  initialTheme: ThemeMode;
}) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="brand-group">
          <span className="brand-mark" aria-hidden="true">
            SI
          </span>
          <Link href="/" className="site-title">
            Superintelligence Homepage
          </Link>
        </div>

        <nav className="nav-row" aria-label="Primary">
          <Link href="/" className="nav-link">
            Feed
          </Link>
          <Link href="/analysis" className="nav-link">
            Analysis &amp; SIM Lab
          </Link>
          <Link href="/brief" className="nav-link">
            Weekly Brief
          </Link>
          <Link href="/sources" className="nav-link">
            Sources
          </Link>
          <Link href="/review" className="nav-link">
            How Chosen
          </Link>
          {user && (
            <Link href="/saved" className="nav-link">
              Saved
            </Link>
          )}
        </nav>

        <nav className="nav-row" aria-label="Account and theme">
          <ThemeToggle initialTheme={initialTheme} />
          {user ? (
            <>
              <span className="nav-link" aria-live="polite">
                Signed in as <strong style={{ marginLeft: "0.25rem" }}>{user.username}</strong>
              </span>
              <form method="post" action="/api/auth/signout" style={{ margin: 0 }}>
                <button type="submit" className="btn-secondary">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/signin" className="btn-secondary">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
