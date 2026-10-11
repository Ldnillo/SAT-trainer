import type { Lesson } from "../lessons";
import { CLAUDE_LESSON_AUTHORSHIP } from "../authorship";

export const wordsInContextLesson: Lesson = {
  slug: "words-in-context",
  title: "Words in context",
  skills: ["words-in-context"],
  free: false,
  minutes: 5,
  trap: "You grab the meaning you already know for a word, even though the sentence uses a different one.",
  rule: "Cover the choices. Predict your own word from the clues, then match it.",
  diagram: null,
  examples: [
    {
      title: "Predict before you look",
      problem: "The first draft was long, but the editor praised the second for its ______, since it said much in few words. Which word fits?",
      steps: [
        { name: "Cover the choices", text: "Looking at the choices first makes every word seem possible. Read only the sentence." },
        { name: "Find the clue", text: "\"Said much in few words\" tells you exactly what the blank means." },
        { name: "Predict your own word", text: "A good prediction is \"shortness\" or \"brevity\". Many students stop here in their head and it already narrows the choices." },
        { name: "Match", text: "Now look at the choices and pick the one closest to your word, such as \"concision\". A word like \"complexity\" or \"length\" fights the clue." },
      ],
    },
    {
      title: "A familiar word with a new meaning",
      problem: "The mayor's remarks were measured, delivered with careful restraint. As used here, what does \"measured\" most nearly mean?",
      steps: [
        { name: "Spot the familiar meaning", text: "\"Measured\" usually means something was checked with a ruler or a scale. That is the trap." },
        { name: "Test it in the sentence", text: "\"Remarks were checked with a ruler\" makes no sense." },
        { name: "Use the clue", text: "\"Careful restraint\" is right next to it and explains the meaning: the remarks were controlled and not too strong." },
        { name: "Answer", text: "Pick the choice closest to \"controlled\" or \"careful\"." },
      ],
    },
    {
      title: "Tone clues",
      problem: "She was ______ about the results, refusing to celebrate until a second lab confirmed them. Which word fits?",
      steps: [
        { name: "Find the clue", text: "\"Refusing to celebrate until a second lab confirmed them\" shows she did not trust the results yet." },
        { name: "Predict", text: "The blank must mean careful or doubtful." },
        { name: "Match", text: "\"Cautious\" or \"skeptical\" fits. \"Thrilled\" or \"delighted\" fits the sentence's start but is contradicted by \"refusing to celebrate\"." },
        { name: "Answer", text: "Always check your pick against the clue after the blank, not just before it." },
      ],
    },
  ],
  clues: [
    "A blank (______) in a short passage, or a question asking what a word \"most nearly means\" as used.",
    "Look for the clue: a restatement, an opposite, or an example near the blank.",
    "If you know the word, ask whether that meaning really fits this sentence.",
  ],
  authorship: CLAUDE_LESSON_AUTHORSHIP,
};
