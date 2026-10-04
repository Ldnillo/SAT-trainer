import type { QuestionContent } from "../src/lib/sat/question";

export function rwQuestion(overrides: Partial<QuestionContent> = {}): QuestionContent {
  return {
    passages: [
      {
        label: null,
        text: "Honeybees communicate the location of food through a movement called the waggle dance. The angle of the dance relative to vertical indicates direction, while its duration indicates distance. ______ a forager that dances for a long time is signaling that the flowers are far from the hive.",
      },
    ],
    table: null,
    stem: "Which choice completes the text with the most logical transition?",
    choices: [
      { label: "A", text: "Thus," },
      { label: "B", text: "However," },
      { label: "C", text: "Meanwhile," },
      { label: "D", text: "In contrast," },
    ],
    correctChoice: "A",
    acceptedAnswers: [],
    explanation: "The last sentence applies the rule stated before it, so a consequence transition fits.",
    distractorRationales: [
      { label: "B", text: "No contrast." },
      { label: "C", text: "Not simultaneous events." },
      { label: "D", text: "No contrast." },
    ],
    publicDomainSource: null,
    ...overrides,
  };
}

export function sprQuestion(overrides: Partial<QuestionContent> = {}): QuestionContent {
  return {
    passages: [],
    table: null,
    stem: "If $4x - 5 = 2$, what is the value of $x$?",
    choices: [],
    correctChoice: null,
    acceptedAnswers: ["7/4", "1.75"],
    explanation: "Add 5 to both sides to get $4x = 7$, then divide by 4.",
    distractorRationales: [],
    publicDomainSource: null,
    ...overrides,
  };
}
