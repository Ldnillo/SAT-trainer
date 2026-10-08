import Link from "next/link";
import { lessonForSkill } from "@/lib/tutor/lessons";

/** "Review this lesson" link shown after a missed question, when a lesson exists for its skill. */
export function LessonLink({ skillId }: { skillId: string }) {
  const lesson = lessonForSkill(skillId);
  if (!lesson) return null;
  return (
    <p style={{ margin: "12px 0 0" }}>
      Want a quick refresher?{" "}
      <Link href={`/tutor/${lesson.slug}`}>
        <strong>Review the lesson: {lesson.title}</strong> ({lesson.minutes} min)
      </Link>
    </p>
  );
}
