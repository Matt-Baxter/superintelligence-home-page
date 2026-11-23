import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { NavLinks, type NavItem } from "./nav-links";
import { ThemeToggle, type ThemeMode } from "./theme-toggle";

const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Feed" },
  { href: "/analysis", label: "Lab" },
  { href: "/brief", label: "Brief" },
  { href: "/sources", label: "Sources" },
  { href: "/review", label: "Method" },
  { href: "/compare", label: "Compare" },
];

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" className="brand-mark" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.25">
      <path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5Z" />
      <path d="M12 6.2 16.9 9.05v5.9L12 17.8 7.1 14.95v-5.9Z" />
      <path d="M10.6 17 12 17.8 13.4 17" stroke="var(--bg)" strokeWidth="2" />
    </svg>
  );
}

export function SiteHeader({
  user,
  initialTheme,
}: {
  user: SessionUser | null;
  initialTheme: ThemeMode;
}) {
  const items: NavItem[] = user
    ? [...PRIMARY_NAV, { href: "/queue", label: "Queue" }, { href: "/saved", label: "Saved" }]
    : [...PRIMARY_NAV, { href: "/queue", label: "Queue" }];

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-group" style={{ textDecoration: "none" }}>
          <BrandMark />
          <span className="site-title">Superintelligence</span>
        </Link>

        <nav className="nav-row nav-primary" aria-label="Primary">
          <NavLinks items={items} />
        </nav>

        <div className="nav-row" aria-label="Account and theme">
          <ThemeToggle initialTheme={initialTheme} />
          {user ? (
            <>
              <span className="nav-user">{user.username}</span>
              <form method="post" action="/api/auth/signout" style={{ margin: 0 }}>
                <button type="submit" className="btn-secondary btn-small">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/signin" className="btn-secondary btn-small">
                Sign in
              </Link>
              <Link href="/signup" className="btn-primary btn-small">
                Join free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
