import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAT Trainer",
  description: "Original SAT-style practice questions, tailored to the skills you need most.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <div className="content">{children}</div>
        <footer className="disclaimer">
          SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse,
          this product. All practice questions on this site are original.
        </footer>
      </body>
    </html>
  );
}
