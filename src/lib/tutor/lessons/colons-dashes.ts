import type { Lesson } from "../lessons";
import { CLAUDE_LESSON_AUTHORSHIP } from "../authorship";

export const colonsDashesLesson: Lesson = {
  slug: "colons-dashes-semicolons",
  title: "Colons, dashes and semicolons",
  skills: ["boundaries"],
  free: false,
  minutes: 5,
  trap: "You use a colon or semicolon without checking whether a full sentence stands on its left side.",
  rule: "Colon and dash: a full sentence must come before. Semicolon: a full sentence on both sides.",
  diagram: null,
  examples: [
    {
      title: "Semicolon: full sentence on both sides",
      problem: "Which is correct? (A) The museum closes at five; so visitors should arrive early. (B) The museum closes at five; visitors should arrive early.",
      steps: [
        { name: "Test the left side", text: "\"The museum closes at five\" is a full sentence." },
        { name: "Test the right side in (B)", text: "\"Visitors should arrive early\" is a full sentence." },
        { name: "Test the right side in (A)", text: "\"So visitors should arrive early\" begins with the joining word \"so\". A semicolon already does the joining, so the extra \"so\" is a mistake." },
        { name: "Answer", text: "(B) is correct: two full sentences with a semicolon between them." },
      ],
    },
    {
      title: "Colon: the sentence must be complete first",
      problem: "Which is correct? (A) She packed three things: a map, a compass, and water. (B) She packed: a map, a compass, and water.",
      steps: [
        { name: "Cover everything after the colon", text: "In (A) the left side is \"She packed three things\", a full sentence. In (B) the left side is \"She packed\", which is missing what she packed." },
        { name: "Apply the rule", text: "A colon needs a full sentence before it. What follows the colon explains or lists." },
        { name: "Answer", text: "(A) is correct. In (B) the colon interrupts the sentence before it is complete." },
      ],
    },
    {
      title: "Dashes come in pairs, like commas",
      problem: "Which is correct? (A) My brother, who lives in Denver is visiting. (B) My brother, who lives in Denver, is visiting. (C) My brother who lives in Denver, is visiting.",
      steps: [
        { name: "Find the extra piece", text: "\"Who lives in Denver\" is extra detail. Remove it and \"My brother is visiting\" is still a full sentence." },
        { name: "Wrap both ends", text: "Extra detail in the middle needs punctuation on both sides: two commas, two dashes, or two parentheses. Never just one." },
        { name: "Check each choice", text: "(A) has an opening comma but no closing one. (C) has a closing comma but no opening one. (B) has both." },
        { name: "Answer", text: "(B) is correct. The same pairing rule applies to dashes: either two or none." },
      ],
    },
  ],
  clues: [
    "The punctuation choices include a colon, semicolon, or dash.",
    "Cover the right side and ask: is what remains a full sentence? If not, a colon or dash cannot be there.",
    "A semicolon needs a full sentence on each side, and no joining word like \"and\" or \"so\" right after it.",
  ],
  authorship: CLAUDE_LESSON_AUTHORSHIP,
};
