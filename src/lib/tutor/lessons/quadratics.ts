import type { Lesson } from "../lessons";
import { CLAUDE_LESSON_AUTHORSHIP } from "../authorship";

export const quadraticsLesson: Lesson = {
  slug: "quadratics",
  title: "Quadratics: factoring and the vertex",
  skills: ["nonlinear-equations-and-systems", "nonlinear-functions"],
  free: false,
  minutes: 6,
  trap: "You try to factor while the equation still equals a number other than zero, or you read the vertex with the wrong sign.",
  rule: "Make one side zero, then factor. In vertex form, the x-part flips sign and the outside number is read as is.",
  diagram: null,
  examples: [
    {
      title: "Solve by factoring",
      problem: "What are the solutions of $x^2 + 3x = 10$?",
      steps: [
        { name: "Make one side zero", text: "Subtract 10 from both sides. This gives $x^2 + 3x - 10 = 0$." },
        { name: "Find the factor pair", text: "We need two numbers that multiply to -10 and add to 3. The numbers 5 and -2 work, because $5 \\cdot (-2) = -10$ and $5 + (-2) = 3$." },
        { name: "Write the factors", text: "The equation becomes $(x + 5)(x - 2) = 0$." },
        { name: "Use zero product", text: "If two things multiply to zero, one of them is zero. So $x + 5 = 0$ or $x - 2 = 0$." },
        { name: "Solve each", text: "Subtracting 5 gives $x = -5$. Adding 2 gives $x = 2$." },
        { name: "Check", text: "For $x = 2$: $4 + 6 = 10$. For $x = -5$: $25 - 15 = 10$. Both work." },
      ],
    },
    {
      title: "Read the vertex",
      problem: "The function is $f(x) = (x - 3)^2 + 4$. What is its minimum value, and where does it happen?",
      steps: [
        { name: "Find the squared part", text: "A square is never negative. $(x - 3)^2$ is smallest, namely 0, when $x - 3 = 0$." },
        { name: "Find x at the vertex", text: "Add 3 to both sides of $x - 3 = 0$. This gives $x = 3$. This is why the sign flips: the vertex is at x = 3, not x = -3." },
        { name: "Find the y-value", text: "When the squared part is 0, $f(x) = 0 + 4 = 4$. The outside number is read as is." },
        { name: "Answer", text: "The minimum value is 4, and it happens at $x = 3$. The vertex is (3, 4)." },
      ],
    },
    {
      title: "Sum of solutions",
      problem: "What is the sum of the solutions of $x^2 - 7x + 12 = 0$?",
      steps: [
        { name: "Find the factor pair", text: "We need two numbers that multiply to 12 and add to -7. The numbers -3 and -4 work." },
        { name: "Write the factors", text: "The equation becomes $(x - 3)(x - 4) = 0$." },
        { name: "Solve", text: "Setting each factor to zero gives $x = 3$ and $x = 4$." },
        { name: "Add", text: "$3 + 4 = 7$." },
        { name: "Spot the shortcut", text: "When the $x^2$ term has no number in front, the sum of the solutions is the middle number with its sign flipped: -(-7) = 7. Use this to double-check." },
      ],
    },
  ],
  clues: [
    "An equation with $x^2$ in it, asking for solutions, their sum, or how many there are.",
    "If it is not equal to zero, move everything to one side first.",
    "A function written as $(x - h)^2 + k$ asks about the vertex, minimum, or maximum.",
  ],
  authorship: CLAUDE_LESSON_AUTHORSHIP,
};
