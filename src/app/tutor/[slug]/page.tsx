import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonSteps } from "@/components/LessonSteps";
import { MathText } from "@/components/MathText";
import { SystemsDiagram } from "@/components/SystemsDiagram";
import { requireUser } from "@/lib/auth/session";
import { passStatus } from "@/lib/billing/pass";
import { getDb } from "@/lib/db/client";
import { startPractice } from "@/app/practice/actions";
import { getLesson } from "@/lib/tutor/lessons";
import styles from "../tutor.module.css";

export async function generateMetadata({ params }: PageProps<"/tutor/[slug]">): Promise<Metadata> {
  const lesson = getLesson((await params).slug);
  return { title: lesson ? lesson.title : "Tutor" };
}

export default async function LessonPage({ params }: PageProps<"/tutor/[slug]">) {
  const { slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson) notFound();
  const user = await requireUser(`/tutor/${slug}`);
  // Paid lessons are gated here on the server, so the content never reaches a student without a pass.
  const unlocked = lesson.free || (await passStatus(await getDb(), user.id)).active;

  return (
    <main className={styles.page}>
      <Link href="/tutor" className={styles.back}>
        ← All lessons
      </Link>
      <h1 className={styles.title}>{lesson.title}</h1>
      <p className={styles.muted}>{lesson.minutes}-minute lesson</p>

      {!unlocked ? (
        <section className={`${styles.block} surface`}>
          <h2>This lesson is part of the season pass</h2>
          <p>
            <Link href="/pass" className="button">
              See season pass
            </Link>
          </p>
        </section>
      ) : (
        <>
          <section className={`${styles.block} ${styles.trap} surface`}>
            <h2>The trap</h2>
            <p>
              <MathText text={lesson.trap} />
            </p>
          </section>
          <section className={`${styles.block} ${styles.rule} surface`}>
            <p>
              <MathText text={lesson.rule} />
            </p>
          </section>

          {lesson.diagram === "systems" && <SystemsDiagram />}

          {lesson.examples.map((example) => (
            <section key={example.title} className={`${styles.block} surface`}>
              <h2>{example.title}</h2>
              <p className={styles.problem}>
                <MathText text={example.problem} />
              </p>
              <LessonSteps steps={example.steps.map((s) => ({ name: s.name, body: <MathText text={s.text} /> }))} />
            </section>
          ))}

          <section className={`${styles.block} surface`}>
            <h2>How to spot it</h2>
            <ul className={styles.clues}>
              {lesson.clues.map((c) => (
                <li key={c}>
                  <MathText text={c} />
                </li>
              ))}
            </ul>
          </section>

          <section className={`${styles.block} ${styles.practice} surface`}>
            <div>
              <h2>Try it now</h2>
              <p className={styles.muted}>A short practice set on this skill.</p>
            </div>
            <form action={startPractice}>
              <input type="hidden" name="focus" value="skill" />
              <input type="hidden" name="value" value={lesson.skills[0]} />
              <button type="submit" className="button">
                Practice this skill
              </button>
            </form>
          </section>

          <p className={styles.credit}>
            Original NextScore lesson written by {lesson.authorship.writer.name}, {lesson.authorship.writer.date}.
          </p>
        </>
      )}
    </main>
  );
}
