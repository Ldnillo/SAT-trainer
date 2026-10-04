import { SettingsTabs } from "./SettingsTabs";
import styles from "./settings.module.css";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <main className={styles.page}>
      <h1>Settings</h1>
      <SettingsTabs />
      {children}
    </main>
  );
}
