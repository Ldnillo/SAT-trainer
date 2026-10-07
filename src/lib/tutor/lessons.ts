import { getSkill, SECTION_NAMES, type SectionId } from "../sat/taxonomy";
import { systemsLesson } from "./lessons/systems";

/** One line of a worked example. `text` may contain $...$ math. */
export interface LessonStep {
  /** Short name for what this step does, shown as the step's heading. */
  name: string;
  text: string;
}

export interface WorkedExample {
  title: string;
  /** The problem, shown above the steps. */
  problem: string;
  steps: LessonStep[];
}

export interface Lesson {
  /** URL slug, also the file-style id (e.g. "systems-of-equations"). */
  slug: string;
  title: string;
  /** Bank skill ids this lesson covers. The first one is used for the practice set at the end. */
  skills: readonly [string, ...string[]];
  /** Free lessons are open to students without a season pass. */
  free: boolean;
  minutes: number;
  /** The exact mistake students make, in one sentence. */
  trap: string;
  /** The memory hook. Keep it short enough to say out loud. */
  rule: string;
  /** Which picture to draw above the worked example. */
  diagram: "systems" | null;
  examples: [WorkedExample, ...WorkedExample[]];
  /** Clues in a question that tell the student this lesson applies. */
  clues: string[];
  /** Same authorship record the question bank uses: lessons are original NextScore writing. */
  authorship: { writer: { name: string; date: string }; reviews: { by: string; date: string; note: string }[] };
}

export const LESSONS: readonly Lesson[] = [systemsLesson];

export function getLesson(slug: string): Lesson | undefined {
  return LESSONS.find((l) => l.slug === slug);
}

/** The lesson that teaches a bank skill, if one has been written yet. */
export function lessonForSkill(skillId: string): Lesson | undefined {
  return LESSONS.find((l) => l.skills.includes(skillId));
}

export function lessonSection(lesson: Lesson): { id: SectionId; name: string } {
  const id = getSkill(lesson.skills[0]).section;
  return { id, name: SECTION_NAMES[id] };
}
