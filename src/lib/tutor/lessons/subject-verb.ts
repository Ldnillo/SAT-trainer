import type { Lesson } from "../lessons";
import { CLAUDE_LESSON_AUTHORSHIP } from "../authorship";

export const subjectVerbLesson: Lesson = {
  slug: "subject-verb-agreement",
  title: "Subject-verb agreement and pronouns",
  skills: ["form-structure-and-sense"],
  free: false,
  minutes: 5,
  trap: "You match the verb to the noun nearest to it instead of the real subject.",
  rule: "Cross out the phrase between the subject and the verb. Then match what is left.",
  diagram: null,
  examples: [
    {
      title: "A phrase hiding the subject",
      problem: "The collection of rare coins ______ on display. Choose is or are.",
      steps: [
        { name: "Find the phrase starting with of", text: "\"Of rare coins\" is a phrase that describes the collection. The real subject is never inside an \"of\" phrase." },
        { name: "Cross it out", text: "The sentence becomes \"The collection ______ on display.\"" },
        { name: "Count what is left", text: "\"Collection\" is one thing, so it is singular. Singular subjects take singular verbs." },
        { name: "Answer", text: "\"Is\". The word \"coins\" sits right next to the blank, but it is not the subject." },
      ],
    },
    {
      title: "The same trap with a plural subject",
      problem: "The results of the new study ______ that sleep affects memory. Choose suggest or suggests.",
      steps: [
        { name: "Cross out the of phrase", text: "Removing \"of the new study\" leaves \"The results ______ that sleep affects memory.\"" },
        { name: "Count the subject", text: "\"Results\" ends in s and means more than one result, so it is plural." },
        { name: "Match the verb", text: "A plural subject takes the plain verb with no s: they suggest. A singular subject would take the s: it suggests." },
        { name: "Answer", text: "\"Suggest\". The singular word \"study\" is the decoy." },
      ],
    },
    {
      title: "Pronouns follow the same counting",
      problem: "A company must protect ______ customers' data. Choose its or their.",
      steps: [
        { name: "Find what the pronoun points back to", text: "The pronoun refers to \"a company\"." },
        { name: "Count it", text: "\"A company\" is one thing. Even though it contains many people, grammar treats it as a single unit." },
        { name: "Match the pronoun", text: "A singular noun takes a singular pronoun, and \"its\" is singular." },
        { name: "Answer", text: "\"Its\". The word \"customers'\" is plural, but it is not what the pronoun points back to." },
      ],
    },
  ],
  clues: [
    "The choices are forms of one word: is/are, was/were, has/have, or it/they.",
    "Look for a phrase between the subject and the verb (often starting with of, in, or with).",
    "Ask: one thing or more than one? Then match the verb or pronoun to that count.",
  ],
  authorship: CLAUDE_LESSON_AUTHORSHIP,
};
