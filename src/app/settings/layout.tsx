import { isAdminEmail } from "@/lib/auth/admin";
import { currentUser } from "@/lib/auth/session";
import { SettingsTabs } from "./SettingsTabs";
import styles from "./settings.module.css";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const user = await currentUser();
  return (
    <main className={styles.page}>
      <h1>Settings</h1>
      <SettingsTabs staff={!!user && isAdminEmail(user.email)} />
      {children}
    </main>
  );
}
