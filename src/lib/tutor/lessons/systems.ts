import type { Lesson } from "../lessons";

export const systemsLesson: Lesson = {
  slug: "systems-of-equations",
  title: "Systems of equations",
  skills: ["systems-of-linear-equations"],
  free: true,
  minutes: 5,
  trap: "You find x, feel done, and pick the answer for x, but the question asked for something else, like $x + y$.",
  rule: "Circle what the question asks for first. Substitute when one letter is alone; eliminate when the letters line up.",
  diagram: "systems",
  examples: [
    {
      title: "Substitution: one letter is already alone",
      problem: "$y = 2x + 1$ and $3x + y = 11$. What is the value of $x + y$?",
      steps: [
        { name: "Circle what is asked", text: "The question wants $x + y$, not just $x$. Keep that in mind until the very end." },
        {
          name: "Swap the alone letter in",
          text: "The first equation says $y$ is the same thing as $2x + 1$. In the second equation, replace $y$ with $2x + 1$. This gives $3x + (2x + 1) = 11$.",
        },
        { name: "Combine like terms", text: "$3x$ and $2x$ are both x-terms, so they add to $5x$. The equation becomes $5x + 1 = 11$." },
        { name: "Undo the +1", text: "Subtract 1 from both sides. The left side becomes $5x$ and the right side becomes 10, so $5x = 10$." },
        { name: "Undo the times 5", text: "Divide both sides by 5. This gives $x = 2$." },
        { name: "Find the other letter", text: "Put $x = 2$ into $y = 2x + 1$. Since $2 \\cdot 2 = 4$ and $4 + 1 = 5$, we get $y = 5$." },
        { name: "Check in the other equation", text: "In $3x + y = 11$, we get $3 \\cdot 2 + 5 = 6 + 5 = 11$. It works." },
        { name: "Answer what was asked", text: "The question wanted $x + y$. That is $2 + 5 = 7$. The answer is 7, not 2." },
      ],
    },
    {
      title: "Elimination: the letters line up",
      problem: "$2x + 3y = 12$ and $2x - y = 4$. What is the value of $x$?",
      steps: [
        { name: "Circle what is asked", text: "This time the question wants only $x$." },
        {
          name: "Spot the match",
          text: "Both equations start with $2x$. If we subtract one equation from the other, the x-terms cancel. Subtracting is the same as changing every sign of the second equation and adding.",
        },
        { name: "Subtract the equations", text: "Left sides: $(2x + 3y) - (2x - y) = 4y$, because $2x - 2x = 0$ and $3y - (-y) = 4y$. Right sides: $12 - 4 = 8$. So $4y = 8$." },
        { name: "Solve for y", text: "Divide both sides by 4. This gives $y = 2$." },
        { name: "Put y back in", text: "Use $2x - y = 4$. Replace $y$ with 2 to get $2x - 2 = 4$." },
        { name: "Undo the -2", text: "Add 2 to both sides. This gives $2x = 6$." },
        { name: "Undo the times 2", text: "Divide both sides by 2. This gives $x = 3$, which is what the question asked for." },
      ],
    },
    {
      title: "No solution or infinitely many: compare the lines",
      problem: "$4x + 2y = 10$ and $2x + y = k$. For what value of $k$ does the system have infinitely many solutions?",
      steps: [
        { name: "Know the rule", text: "Infinitely many solutions means the two equations describe the same line." },
        { name: "Make one side match", text: "The first equation has $4x$ where the second has $2x$. Multiply every term of the second equation by 2. This gives $4x + 2y = 2k$." },
        { name: "Compare", text: "Now both equations begin with $4x + 2y$. They are the same line only if the right sides are equal too, so $2k = 10$." },
        { name: "Solve for k", text: "Divide both sides by 2. This gives $k = 5$." },
        { name: "Why other values fail", text: "If $k$ were any other number, the left sides would match but the right sides would not. That makes two parallel lines that never meet, so there would be no solution." },
      ],
    },
  ],
  clues: [
    "Two equations with the same two letters, and the question asks for a value, a sum, or how many solutions.",
    "One equation has a letter alone (like $y = 2x + 1$): use substitution.",
    "Both equations have a matching term, or can match after multiplying one by a number: use elimination.",
    "The question says \"no solution\" or \"infinitely many\": compare the equations, and look for matching left sides.",
  ],
  authorship: {
    writer: { name: "Claude Sonnet 5.5", date: "2026-10-07" },
    reviews: [{ by: "Claude Sonnet 5.5", date: "2026-10-07", note: "Worked each example by hand and checked every arithmetic step; self-review only." }],
  },
};
