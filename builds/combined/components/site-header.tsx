import Link from "next/link";
import { BrandEmblem } from "@/components/brand-emblem";
import { CommandTriggerButton, CommandWayfinding } from "@/components/command-wayfinding";
import { NavLinks, type NavItem } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import type { SessionUser } from "@/lib/auth";
import type { ThemeMode } from "@/lib/theme";

const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Index" },
  { href: "/analysis", label: "Scoring Lab" },
  { href: "/brief", label: "Brief" },
  { href: "/sources", label: "Sources" },
  { href: "/review", label: "Ledger" },
  { href: "/queue", label: "Quorum" },
  { href: "/compare", label: "Synthesis" },
  { href: "/limits", label: "Governance" },
];

export function SiteHeader({
  user,
  initialTheme,
}: {
  user: SessionUser | null;
  initialTheme: ThemeMode;
}) {
  const items = user
    ? [...BASE_NAV_ITEMS, { href: "/saved", label: "Saved" }]
    : BASE_NAV_ITEMS;

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-group" aria-label="Superintelligence Index — Home">
          <BrandEmblem size={24} />
          <span className="brand-lockup-text">
            <span className="site-title">Superintelligence</span>
            <span className="site-submark">Research Index</span>
          </span>
        </Link>

        <nav className="nav-primary" aria-label="Primary sections">
          <NavLinks items={items} />
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
                Join
              </Link>
            </>
          )}
        </div>
      </div>

      <CommandWayfinding isSignedIn={Boolean(user)} />
    </header>
  );
}
