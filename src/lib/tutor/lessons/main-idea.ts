import type { Lesson } from "../lessons";
import { CLAUDE_LESSON_AUTHORSHIP } from "../authorship";

export const mainIdeaLesson: Lesson = {
  slug: "main-idea-and-inference",
  title: "Main idea and inference traps",
  skills: ["central-ideas-and-details", "inferences"],
  free: false,
  minutes: 5,
  trap: "You pick an answer that is true or interesting but says more than the text says, or covers only one detail.",
  rule: "The right answer is only as strong as the text. Be suspicious of always, never, all, and only.",
  diagram: null,
  examples: [
    {
      title: "Main idea, not a detail",
      problem: "A text says: Researchers placed bees in two gardens. In the first, flowers were mixed. In the second, there was one flower type. The bees in the mixed garden made more honey. Which choice states the main idea?",
      steps: [
        { name: "Summarize in your own words", text: "The text compares two gardens and finds more honey where the flowers were varied." },
        { name: "Test each choice for coverage", text: "A choice about \"the first garden's flowers\" is a detail, not the whole point." },
        { name: "Reject extra claims", text: "A choice saying \"mixed gardens are always better for bees\" goes beyond one study. \"Always\" is a warning sign." },
        { name: "Answer", text: "Pick the choice that matches your summary: bees in a mixed garden made more honey than bees in a single-flower garden." },
      ],
    },
    {
      title: "Finish the logic, no more",
      problem: "Most plants in the greenhouse grew well, but the one next to the broken heater wilted. This suggests that ______. Which choice completes the text?",
      steps: [
        { name: "Collect the facts", text: "Fact 1: most plants grew well. Fact 2: the plant near the broken heater wilted." },
        { name: "Pick the smallest safe step", text: "The heater is the only difference mentioned, so the logical step is that the heater problem may have hurt that plant." },
        { name: "Check the strength", text: "\"The heater problem may have affected the plant\" is as strong as the evidence. \"Heat always kills plants\" is far stronger than one wilted plant can support." },
        { name: "Answer", text: "Pick the modest choice that uses only the facts in the text." },
      ],
    },
    {
      title: "The warning words",
      problem: "A text says that a survey of 200 students found most of them prefer morning classes. Which conclusion is supported?",
      steps: [
        { name: "Read exactly what is claimed", text: "\"Most of the 200 surveyed students\" prefer mornings. That says nothing about all students everywhere." },
        { name: "Circle the strong words", text: "A choice with \"all students\" or \"every school\" claims more than the survey shows." },
        { name: "Look for the matching size", text: "The correct choice says something like: \"Many of the surveyed students prefer morning classes.\"" },
        { name: "Answer", text: "The supported choice is the one no bigger than the evidence." },
      ],
    },
  ],
  clues: [
    "The question asks for the main idea or for what logically completes the text.",
    "A choice uses a strong word like always, never, all, only, or proves.",
    "A choice is true but only about one detail.",
  ],
  authorship: CLAUDE_LESSON_AUTHORSHIP,
};
