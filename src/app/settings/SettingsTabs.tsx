"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./settings.module.css";

const TABS = [
  { href: "/settings", label: "Appearance" },
  { href: "/settings/account", label: "Account" },
];

/** Sub-tabs across the top of the settings pages. */
export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className={styles.tabs} aria-label="Settings sections">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={styles.tab} aria-current={pathname === tab.href ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
