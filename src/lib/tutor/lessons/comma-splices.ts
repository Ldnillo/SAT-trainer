import type { Lesson } from "../lessons";
import { CLAUDE_LESSON_AUTHORSHIP } from "../authorship";

export const commaSplicesLesson: Lesson = {
  slug: "comma-splices",
  title: "Comma splices and run-ons",
  skills: ["boundaries"],
  free: false,
  minutes: 5,
  trap: "You think a comma is enough to join two complete sentences. It is not.",
  rule: "Can each side stand alone? Then a comma by itself cannot join them.",
  diagram: null,
  examples: [
    {
      title: "Two full sentences joined by a comma",
      problem: "Which version is correct? (A) The test was long, it was not hard. (B) The test was long, but it was not hard.",
      steps: [
        { name: "Split at the comma", text: "Left side: \"The test was long.\" Right side: \"It was not hard.\"" },
        { name: "Run the stand-alone test", text: "Each side has a subject and a verb and makes sense alone. Both are full sentences." },
        { name: "Know the joiners", text: "A comma can join two full sentences only when a joining word follows it: for, and, nor, but, or, yet, so. Remember them as FANBOYS." },
        { name: "Answer", text: "(B) adds \"but\" after the comma, so it is correct. (A) is a comma splice." },
      ],
    },
    {
      title: "\"However\" is not a joiner",
      problem: "Which version is correct? (A) The test was long, however, it was not hard. (B) The test was long; however, it was not hard.",
      steps: [
        { name: "Split at the first punctuation", text: "Left side: \"The test was long.\" Right side: \"However, it was not hard.\" Both sides are full sentences." },
        { name: "Check the joining word", text: "\"However\" is not one of the FANBOYS words. A comma before it still leaves two full sentences stuck together." },
        { name: "Use a stronger mark", text: "A semicolon can join two full sentences. A period would work too." },
        { name: "Answer", text: "(B) is correct. Watch for however, therefore, and moreover: they need a semicolon or a period before them." },
      ],
    },
    {
      title: "When one side cannot stand alone",
      problem: "Which version is correct? (A) Because the test was long. Students were tired. (B) Because the test was long, students were tired.",
      steps: [
        { name: "Test the first piece", text: "\"Because the test was long.\" It leaves you waiting for the rest of the thought, so it cannot stand alone." },
        { name: "Test the second piece", text: "\"Students were tired.\" This is a full sentence." },
        { name: "Attach the dependent piece", text: "A piece that cannot stand alone must be attached to a full sentence. A comma does that job when the dependent piece comes first." },
        { name: "Answer", text: "(B) is correct. (A) wrongly puts a period after a piece that cannot stand alone." },
      ],
    },
  ],
  clues: [
    "The choices are the same words with different punctuation: a comma, a semicolon, or a period.",
    "Cover the punctuation and test each side: can it stand alone?",
    "Full sentence + full sentence needs a period, a semicolon, or a comma plus FANBOYS.",
  ],
  authorship: CLAUDE_LESSON_AUTHORSHIP,
};
