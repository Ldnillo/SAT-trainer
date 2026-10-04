import type { Metadata } from "next";
import Link from "next/link";
import "katex/dist/katex.min.css";
import { currentUser } from "@/lib/auth/session";
import { signOut } from "./auth-actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAT Trainer",
  description: "Original SAT-style practice questions, tailored to the skills you need most.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  return (
    // Browser extensions (one sec, Grammarly...) add attributes to <html> before React loads; ignore those.
    <html lang="en" suppressHydrationWarning>
      <body>
        <header className="site-header">
          <Link href={user ? "/dashboard" : "/"} className="brand">
            SAT Trainer
          </Link>
          <nav>
            {user ? (
              <form action={signOut}>
                <span className="who">{user.name}</span>
                <button type="submit" className="link-button">
                  Sign out
                </button>
              </form>
            ) : (
              <>
                <Link href="/login">Sign in</Link>
                <Link href="/signup">Sign up</Link>
              </>
            )}
          </nav>
        </header>
        <div className="content">{children}</div>
        <footer className="disclaimer">
          SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse,
          this product. All practice questions on this site are original.
        </footer>
      </body>
    </html>
  );
}
