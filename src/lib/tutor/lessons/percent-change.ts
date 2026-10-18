import type { Lesson } from "../lessons";
import { CLAUDE_LESSON_AUTHORSHIP } from "../authorship";

export const percentChangeLesson: Lesson = {
  slug: "percent-change",
  title: "Percent change",
  skills: ["percentages"],
  free: false,
  minutes: 5,
  trap: "You add or subtract percents (up 25% then down 25% is not back to the start) or take the percent of the wrong number.",
  rule: "Percent change is always measured from the start. Chain changes by multiplying.",
  diagram: null,
  examples: [
    {
      title: "Up then down",
      problem: "A jacket costs 80 dollars. Its price goes up 25%, then the new price goes down 25%. What is the final price in dollars?",
      steps: [
        { name: "Turn each change into a multiplier", text: "Up 25% means the new price is 100% + 25% = 125% of the old one, so multiply by 1.25. Down 25% means 100% - 25% = 75%, so multiply by 0.75." },
        { name: "Apply the first change", text: "80 times 1.25 equals 100." },
        { name: "Apply the second change to the new price", text: "100 times 0.75 equals 75. The second 25% is taken from 100, not from 80." },
        { name: "Answer", text: "The final price is 75 dollars, not 80. That is why the changes do not cancel." },
      ],
    },
    {
      title: "Working backward",
      problem: "After a 20% discount, a bag costs 48 dollars. What was the original price in dollars?",
      steps: [
        { name: "Write the multiplier", text: "A 20% discount leaves 100% - 20% = 80% of the original price, which is 0.80." },
        { name: "Write the equation", text: "Let $p$ be the original price. Then $0.80p = 48$." },
        { name: "Undo the times 0.80", text: "Divide both sides by 0.80. The left side becomes $p$ and the right side becomes $48 / 0.80 = 60$." },
        { name: "Answer", text: "The original price was 60 dollars. Multiplying 48 by 1.20 would give 57.60, which is wrong because the 20% came off the original price, not off 48." },
      ],
    },
    {
      title: "Finding the percent change",
      problem: "A town's population grows from 40 thousand to 52 thousand. What is the percent increase?",
      steps: [
        { name: "Find the change", text: "52 - 40 = 12 thousand." },
        { name: "Divide by the start", text: "The start is 40, so $12 / 40 = 0.3$." },
        { name: "Convert to a percent", text: "Move the decimal two places: 0.3 is 30%." },
        { name: "Answer", text: "The increase is 30%. Dividing by 52 instead would give about 23%, which is the wrong base." },
      ],
    },
  ],
  clues: [
    "Words like increase, decrease, discount, or \"percent of\" in a word problem.",
    "Two percent changes in a row: multiply the multipliers.",
    "Only the final value is given: work backward by dividing by the multiplier.",
  ],
  authorship: CLAUDE_LESSON_AUTHORSHIP,
};
