import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ThemePicker } from "@/components/ThemePicker";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import styles from "./settings.module.css";

export const metadata: Metadata = { title: "Settings" };

export default async function AppearancePage() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <section className={`${styles.section} surface`}>
      <h2>Appearance</h2>
      <p className={styles.muted}>
        Choose how NextScore looks. You can also switch between light and dark with the button at the top right of any page.
      </p>
      <ThemePicker initial={theme} />
    </section>
  );
}
