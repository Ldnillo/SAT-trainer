import type { Lesson } from "../lessons";
import { CLAUDE_LESSON_AUTHORSHIP } from "../authorship";

export const transitionsLesson: Lesson = {
  slug: "transitions",
  title: "Transitions",
  skills: ["transitions"],
  free: true,
  minutes: 4,
  trap: "You pick the transition word that sounds smooth instead of checking how the two sentences actually relate.",
  rule: "Name the relationship first: same direction, opposite, cause, or example. Then pick the word.",
  diagram: null,
  examples: [
    {
      title: "Opposite direction",
      problem: "The plan was cheap. ______, it was slow. Which transition fits the blank?",
      steps: [
        { name: "Read both sentences alone", text: "Sentence 1 says the plan was cheap, which is good. Sentence 2 says it was slow, which is bad." },
        { name: "Name the relationship", text: "Good news followed by bad news points in opposite directions. That is a contrast." },
        { name: "Pick from the contrast family", text: "Contrast words are However, But, Yet, and In contrast." },
        { name: "Answer", text: "\"However\" fits: \"The plan was cheap. However, it was slow.\"" },
      ],
    },
    {
      title: "Cause and result",
      problem: "The river flooded after three days of rain. ______, the bridge was closed. Which transition fits?",
      steps: [
        { name: "Read both sentences alone", text: "Sentence 1: the river flooded. Sentence 2: the bridge was closed." },
        { name: "Name the relationship", text: "The flood made the closing happen. The first sentence is the cause and the second is the result." },
        { name: "Pick from the cause family", text: "Cause words are Therefore, As a result, Consequently, and Thus." },
        { name: "Answer", text: "\"As a result\" fits. A word like \"However\" would wrongly suggest the bridge closing was a surprise." },
      ],
    },
    {
      title: "An example of the last idea",
      problem: "Many animals travel long distances each year. ______, the Arctic tern flies from pole to pole. Which transition fits?",
      steps: [
        { name: "Read both sentences alone", text: "Sentence 1 makes a general claim about many animals. Sentence 2 names one specific animal." },
        { name: "Name the relationship", text: "A specific case that backs up a general claim is an example." },
        { name: "Pick from the example family", text: "Example words are For example and For instance." },
        { name: "Answer", text: "\"For example\" fits. \"Therefore\" would claim the tern's trip was caused by the first sentence, which it was not." },
      ],
    },
  ],
  clues: [
    "The blank is at the start of a sentence, and the choices are words like However, Therefore, or For example.",
    "Say the relationship in plain words before you look at the choices: \"opposite\", \"because of that\", or \"here is an example\".",
    "Cross out any choice from the wrong family first. Often only one or two remain.",
  ],
  authorship: CLAUDE_LESSON_AUTHORSHIP,
};
