import type { Lesson } from "../lessons";
import { CLAUDE_LESSON_AUTHORSHIP } from "../authorship";

export const modifiersLesson: Lesson = {
  slug: "modifiers-possessives",
  title: "Modifiers and possessives",
  skills: ["form-structure-and-sense"],
  free: false,
  minutes: 5,
  trap: "You pick the choice that sounds natural, but the opening phrase is describing the wrong person or thing.",
  rule: "The noun right after the comma must be the one doing the action in the opening phrase.",
  diagram: null,
  examples: [
    {
      title: "Who is doing the action?",
      problem: "Walking to school, ______. Which ending fits? (A) the rain began to fall (B) Maya felt the rain begin",
      steps: [
        { name: "Find the opening phrase", text: "\"Walking to school\" describes someone who is walking." },
        { name: "Ask who is walking", text: "Rain cannot walk to school. A person must be doing it." },
        { name: "Check the first noun after the comma", text: "(A) starts with \"the rain\". (B) starts with \"Maya\", who can walk." },
        { name: "Answer", text: "(B) is correct. In (A), the phrase wrongly seems to describe the rain." },
      ],
    },
    {
      title: "It's or its",
      problem: "The museum is proud of ______ new wing. Choose it's or its.",
      steps: [
        { name: "Try the swap test", text: "\"It's\" always means \"it is\" (or \"it has\"). Put \"it is\" in the blank." },
        { name: "Read the result", text: "\"The museum is proud of it is new wing\" makes no sense." },
        { name: "Pick the other form", text: "\"Its\" shows ownership, like \"his\" or \"her\". The wing belongs to the museum." },
        { name: "Answer", text: "\"Its\". Only use \"it's\" when you can say \"it is\" in the same spot." },
      ],
    },
    {
      title: "One owner or many?",
      problem: "The ______ lockers are in the hallway. Choose students' or student's, for lockers that belong to many students.",
      steps: [
        { name: "Ask who owns it", text: "The lockers belong to students. The question says many students." },
        { name: "Write the owner as a plural first", text: "Plural of student is \"students\" (add s)." },
        { name: "Add the ownership mark", text: "If the plural already ends in s, add only the apostrophe after it: \"students'\"." },
        { name: "Answer", text: "\"Students'\". Use \"student's\" only when exactly one student owns the lockers." },
      ],
    },
  ],
  clues: [
    "A sentence opens with an \"-ing\" or \"-ed\" phrase followed by a comma.",
    "The choices differ by who or what appears right after the comma.",
    "Choices like it's/its or student's/students' differ only in apostrophes.",
  ],
  authorship: CLAUDE_LESSON_AUTHORSHIP,
};
