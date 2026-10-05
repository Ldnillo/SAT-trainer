import formStructureAndSense from "../../../content/questions/form-structure-and-sense.json";
import linearFunctions from "../../../content/questions/linear-functions.json";
import percentages from "../../../content/questions/percentages.json";
import wordsInContext from "../../../content/questions/words-in-context.json";
import { QuestionContentSchema, type QuestionContent } from "../sat/question";
import { getSkill, SECTION_NAMES, type Difficulty } from "../sat/taxonomy";

/**
 * Questions shown on the home page so visitors can try NextScore before signing up.
 * Taken straight from the question bank files (all original NextScore questions, each one
 * reviewed by a person), so a fix to the question shows up here too.
 */
export const SAMPLE_QUESTION_IDS = [
  "words-in-context-009",
  "form-structure-and-sense-006",
  "percentages-010",
  "linear-functions-006",
] as const;

export interface SampleQuestion {
  id: string;
  section: string;
  skill: string;
  difficulty: Difficulty;
  content: QuestionContent;
}

const FILES = [formStructureAndSense, linearFunctions, percentages, wordsInContext];

export function sampleQuestions(): SampleQuestion[] {
  return SAMPLE_QUESTION_IDS.map((id) => {
    const file = FILES.find((f) => f.questions.some((q) => q.id === id));
    const question = file?.questions.find((q) => q.id === id);
    if (!file || !question) throw new Error(`Home page sample question ${id} is missing from content/questions.`);
    const { section, skill } = getSkill(file.skill);
    return {
      id,
      section: SECTION_NAMES[section],
      skill: skill.name,
      difficulty: question.difficulty as Difficulty,
      content: QuestionContentSchema.parse(question.content),
    };
  });
}
