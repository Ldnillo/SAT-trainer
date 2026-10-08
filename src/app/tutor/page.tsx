import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { passStatus } from "@/lib/billing/pass";
import { getDb } from "@/lib/db/client";
import { LESSONS, lessonSection } from "@/lib/tutor/lessons";
import styles from "./tutor.module.css";

export const metadata: Metadata = { title: "Tutor" };

export default async function TutorPage() {
  const user = await requireUser("/tutor");
  const hasPass = (await passStatus(await getDb(), user.id)).active;
  return (
    <main className={styles.page}>
      <p className="eyebrow">Tutor</p>
      <h1 className={styles.title}>Five-minute lessons on the skills students miss most</h1>
      <p className={styles.muted}>
        Each lesson names the trap, gives you one rule to remember, and walks through an example one step at a time. Then
        you practice it right away.
      </p>
      <ul className={styles.list}>
        {LESSONS.map((lesson) => (
          <li key={lesson.slug} className={`${styles.item} surface`}>
            <div>
              <h3>{lesson.title}</h3>
              <p className={styles.muted}>
                {lessonSection(lesson).name} · {lesson.minutes} min
                {lesson.free ? " · Free" : hasPass ? "" : " · Season pass"}
              </p>
            </div>
            <Link href={`/tutor/${lesson.slug}`} className="button small">
              {lesson.free || hasPass ? "Start lesson" : "Preview"}
            </Link>
          </li>
        ))}
      </ul>
      <p className={styles.muted} style={{ marginTop: 20 }}>
        More lessons are on the way.
      </p>
    </main>
  );
}
