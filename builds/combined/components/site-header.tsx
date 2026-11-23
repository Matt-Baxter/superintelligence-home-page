import Link from "next/link";
import { BrandEmblem } from "@/components/brand-emblem";
import { CommandTriggerButton, CommandWayfinding } from "@/components/command-wayfinding";
import { ThemeToggle } from "@/components/theme-toggle";
import type { SessionUser } from "@/lib/auth";
import type { ThemeMode } from "@/lib/theme";

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
        <Link href="/" className="brand-group" aria-label="Superintelligence Index — Home">
          <BrandEmblem size={26} />
          <span className="site-title">Superintelligence</span>
        </Link>

        <nav className="nav-primary" aria-label="Primary sections">
          <Link href="/" className="nav-link">
            Feed
          </Link>
          <Link href="/analysis" className="nav-link">
            Scoring Lab
          </Link>
          <Link href="/brief" className="nav-link">
            Brief
          </Link>
          <Link href="/sources" className="nav-link">
            Sources
          </Link>
          <Link href="/review" className="nav-link">
            Method
          </Link>
          <Link href="/queue" className="nav-link">
            Queue
          </Link>
          <Link href="/compare" className="nav-link">
            Compare
          </Link>
          <Link href="/limits" className="nav-link">
            Limits
          </Link>
          {user && (
            <Link href="/saved" className="nav-link">
              Saved
            </Link>
          )}
        </nav>

        <div className="nav-actions">
          <CommandTriggerButton />
          <ThemeToggle initialTheme={initialTheme} />

          {user ? (
            <>
              <span className="user-pill" title={`Signed in as ${user.username}`}>
                {user.username}
              </span>
              <form method="post" action="/api/auth/signout">
                <button type="submit" className="btn-ghost btn-small">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/signin" className="btn-ghost btn-small">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary btn-small">
                Join free
              </Link>
            </>
          )}
        </div>
      </div>

      <CommandWayfinding isSignedIn={Boolean(user)} />
    </header>
  );
}
