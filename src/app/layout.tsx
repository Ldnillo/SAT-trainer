import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import "katex/dist/katex.min.css";
import { Logo } from "@/components/Logo";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { currentUser } from "@/lib/auth/session";
import { siteConfig } from "@/lib/site";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { signOut } from "./auth-actions";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "NextScore: digital SAT practice that adapts to you", template: "%s · NextScore" },
  description: "Original digital SAT practice questions, tailored to the skills where you can gain the most points.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  const { supportEmail } = siteConfig();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    // Browser extensions (one sec, Grammarly...) add attributes to <html> before React loads; ignore those.
    // data-theme is set only for an explicit light or dark choice; without it the device setting decides.
    <html lang="en" className={font.variable} data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
      <body>
        <header className="site-header" data-signed-in={user ? "" : undefined}>
          <div className="site-header-inner">
            <Link href={user ? "/dashboard" : "/"} className="brand" aria-label="NextScore home">
              <Logo />
            </Link>
            <nav>
              <ThemeToggle />
              {user ? (
                <>
                  <NavLink href="/dashboard">Dashboard</NavLink>
                  <NavLink href="/review">Review</NavLink>
                  <NavLink href="/pass" className="nav-wide-only">
                    Season pass
                  </NavLink>
                  <NavLink href="/settings">Settings</NavLink>
                  <form action={signOut}>
                    <span className="who">{user.name}</span>
                    <button type="submit" className="link-button">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login">Sign in</Link>
                  <Link href="/signup" className="button small">
                    Start free
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <div className="content">{children}</div>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <Logo />
            <p>
              SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse,
              this product. All practice questions on NextScore are original.
            </p>
            <p className="footer-links">
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <a href={`mailto:${supportEmail}`}>Contact</a>
            </p>
            <p>© {new Date().getFullYear()} NextScore</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
