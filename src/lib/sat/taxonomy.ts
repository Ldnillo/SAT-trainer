/**
 * Digital SAT content taxonomy: sections, domains, skills and difficulty levels.
 *
 * The structure follows the public digital SAT test specifications (domains,
 * skill names and approximate weights). Nothing here is copied question
 * content; the guidance text is our own description of each skill, used to
 * steer the generator. Ids are stable and are what the question bank stores,
 * so the practice trainer can query by skill and difficulty.
 */

export const SECTIONS = ["reading-writing", "math"] as const;
export type SectionId = (typeof SECTIONS)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_FORMATS = ["multiple-choice", "student-produced-response"] as const;
export type QuestionFormat = (typeof QUESTION_FORMATS)[number];

export interface Skill {
  id: string;
  name: string;
  /** What the skill tests, in our own words. Fed to the generator. */
  description: string;
  /** Extra instructions for writing questions in this skill. */
  guidance: string;
  /** Formats this skill can be written in. Reading and Writing is always multiple choice. */
  formats: readonly QuestionFormat[];
}

export interface Domain {
  id: string;
  section: SectionId;
  name: string;
  /** Approximate share of the section's questions (0-1). Useful for weighting practice. */
  weight: number;
  skills: readonly Skill[];
}

const MC = ["multiple-choice"] as const;
const MATH = ["multiple-choice", "student-produced-response"] as const;

export const DOMAINS: readonly Domain[] = [
  // ---------------------------------------------------------------- Reading and Writing
  {
    id: "craft-and-structure",
    section: "reading-writing",
    name: "Craft and Structure",
    weight: 0.28,
    skills: [
      {
        id: "words-in-context",
        name: "Words in Context",
        description:
          "Choose the word or phrase that most precisely and logically fits a blank in a short text, or determine what a word means as used in the text.",
        guidance:
          "Put a single blank (written as ______) in the passage, or underline-by-quotation one word and ask what it most nearly means. All four choices must be the same part of speech and plausible out of context; only one fits the text's precise meaning and tone. Harder items use less common vocabulary and subtler context clues.",
        formats: MC,
      },
      {
        id: "text-structure-and-purpose",
        name: "Text Structure and Purpose",
        description:
          "Identify the main purpose of a text, the function of a particular sentence, or how the text is organized.",
        guidance:
          "Ask about the overall purpose of the text or the function of one quoted or clearly identified sentence. Wrong choices should describe purposes that are partly true, too broad, too narrow or that misread the author's stance.",
        formats: MC,
      },
      {
        id: "cross-text-connections",
        name: "Cross-Text Connections",
        description:
          "Compare two short texts on a related topic and determine how the author of one would respond to a claim or finding in the other.",
        guidance:
          "Provide exactly two passages (Text 1 and Text 2), each 25 to 90 words, on the same topic but with different emphasis or a disagreement. Ask how the author of Text 2 would most likely respond to something specific in Text 1 (or vice versa).",
        formats: MC,
      },
    ],
  },
  {
    id: "information-and-ideas",
    section: "reading-writing",
    name: "Information and Ideas",
    weight: 0.26,
    skills: [
      {
        id: "central-ideas-and-details",
        name: "Central Ideas and Details",
        description: "Determine the main idea of a text or locate a key supporting detail.",
        guidance:
          "Ask for the main idea or for a detail the text states. Distractors should be details that appear in the text but are not central, or overstatements of the text.",
        formats: MC,
      },
      {
        id: "command-of-evidence-textual",
        name: "Command of Evidence: Textual",
        description:
          "Choose the quotation or finding that best supports, illustrates or weakens a claim described in the text.",
        guidance:
          "The passage states a claim or hypothesis (often a researcher's or a literary critic's). Each choice is a quotation from a work or a hypothetical finding; exactly one most directly supports (or weakens) the claim. If quoting literature, use only public-domain works (published before 1929) and quote them accurately.",
        formats: MC,
      },
      {
        id: "command-of-evidence-quantitative",
        name: "Command of Evidence: Quantitative",
        description:
          "Use data from a table to complete an example or support a claim made in the text.",
        guidance:
          "Include a small data table (2 to 5 rows, 2 to 4 columns) with invented but realistic data, and a passage that refers to it. Ask which choice uses data from the table to complete the text or support the claim. Wrong choices should be true of the table but irrelevant to the claim, or misread the table.",
        formats: MC,
      },
      {
        id: "inferences",
        name: "Inferences",
        description: "Choose the choice that most logically completes a text by drawing a reasonable inference.",
        guidance:
          "End the passage with a blank (______) that the reader must complete with the most logical conclusion. Only one choice follows from the reasoning in the text; others are unsupported, too strong or contradict the text.",
        formats: MC,
      },
    ],
  },
  {
    id: "standard-english-conventions",
    section: "reading-writing",
    name: "Standard English Conventions",
    weight: 0.26,
    skills: [
      {
        id: "boundaries",
        name: "Boundaries",
        description:
          "Edit text so that sentence and clause boundaries are punctuated correctly (commas, semicolons, colons, dashes, periods).",
        guidance:
          "Put one blank (______) in the passage where the four choices differ only in punctuation (and possibly the same words). Exactly one choice produces a grammatically correct sentence in standard written English.",
        formats: MC,
      },
      {
        id: "form-structure-and-sense",
        name: "Form, Structure, and Sense",
        description:
          "Edit text for subject-verb agreement, pronoun-antecedent agreement, verb tense and form, plurals and possessives, and modifier placement.",
        guidance:
          "Put one blank (______) in the passage. The four choices are forms of the same word or phrase (for example different verb tenses or possessive forms). Exactly one is grammatically correct in context.",
        formats: MC,
      },
    ],
  },
  {
    id: "expression-of-ideas",
    section: "reading-writing",
    name: "Expression of Ideas",
    weight: 0.2,
    skills: [
      {
        id: "rhetorical-synthesis",
        name: "Rhetorical Synthesis",
        description:
          "Use information from a student's bulleted notes to accomplish a stated rhetorical goal.",
        guidance:
          "The passage is a set of 4 to 6 bullet-point notes a student took on a topic (start each note with '• ' on its own line). The question states a specific goal (for example: emphasize a similarity, introduce the study to an unfamiliar audience). Every choice is accurate to the notes; only one accomplishes the stated goal.",
        formats: MC,
      },
      {
        id: "transitions",
        name: "Transitions",
        description: "Choose the transition word or phrase that most logically connects ideas in a text.",
        guidance:
          "Put a blank (______) at the start of a sentence where a transition belongs. The choices are transition words or phrases (for example: however, for instance, therefore, similarly). Exactly one expresses the correct logical relationship.",
        formats: MC,
      },
    ],
  },

  // ---------------------------------------------------------------- Math
  {
    id: "algebra",
    section: "math",
    name: "Algebra",
    weight: 0.35,
    skills: [
      {
        id: "linear-equations-one-variable",
        name: "Linear equations in one variable",
        description: "Create, solve and interpret linear equations in one variable.",
        guidance: "Include both pure equations and short word problems that require setting up the equation.",
        formats: MATH,
      },
      {
        id: "linear-equations-two-variables",
        name: "Linear equations in two variables",
        description: "Create, solve and interpret linear equations in two variables, including in context.",
        guidance: "Ask about solutions, intercepts or the meaning of a coefficient in a real-world context.",
        formats: MATH,
      },
      {
        id: "linear-functions",
        name: "Linear functions",
        description: "Create, evaluate and interpret linear functions and their graphs, slopes and intercepts.",
        guidance:
          "Describe any graph in words or with a small table of values instead of a picture. Ask about slope, intercepts, evaluating f(x) or interpreting parameters in context.",
        formats: MATH,
      },
      {
        id: "systems-of-linear-equations",
        name: "Systems of two linear equations in two variables",
        description: "Solve and interpret systems of two linear equations, including the number of solutions.",
        guidance: "Include questions about systems with no solution or infinitely many solutions at medium and hard levels.",
        formats: MATH,
      },
      {
        id: "linear-inequalities",
        name: "Linear inequalities in one or two variables",
        description: "Create, solve and interpret linear inequalities and systems of inequalities.",
        guidance: "Use contexts such as budgets or capacity limits, or ask which point satisfies a system.",
        formats: MATH,
      },
    ],
  },
  {
    id: "advanced-math",
    section: "math",
    name: "Advanced Math",
    weight: 0.35,
    skills: [
      {
        id: "equivalent-expressions",
        name: "Equivalent expressions",
        description:
          "Rewrite polynomial, rational, radical and exponential expressions in equivalent forms.",
        guidance: "Ask which expression is equivalent, or for a constant that makes two expressions equivalent.",
        formats: MATH,
      },
      {
        id: "nonlinear-equations-and-systems",
        name: "Nonlinear equations in one variable and systems in two variables",
        description:
          "Solve quadratic, absolute value, radical, rational and exponential equations, and systems with a nonlinear equation.",
        guidance: "Hard items may ask about the number of solutions or the sum of solutions.",
        formats: MATH,
      },
      {
        id: "nonlinear-functions",
        name: "Nonlinear functions",
        description:
          "Create, evaluate and interpret quadratic, exponential, polynomial and rational functions and their key features.",
        guidance:
          "Ask about vertices, zeros, growth or decay rates, or interpreting parameters in context. Describe graphs in words or tables rather than pictures.",
        formats: MATH,
      },
    ],
  },
  {
    id: "problem-solving-and-data-analysis",
    section: "math",
    name: "Problem-Solving and Data Analysis",
    weight: 0.15,
    skills: [
      {
        id: "ratios-rates-proportions-units",
        name: "Ratios, rates, proportional relationships, and units",
        description: "Solve problems with ratios, rates, proportions and unit conversions.",
        guidance: "Use realistic contexts and include unit conversions at medium and hard levels.",
        formats: MATH,
      },
      {
        id: "percentages",
        name: "Percentages",
        description: "Solve problems involving percentages, percent increase and decrease.",
        guidance: "Hard items may chain two percent changes or work backward from a final value.",
        formats: MATH,
      },
      {
        id: "one-variable-data",
        name: "One-variable data: distributions and measures of center and spread",
        description: "Interpret distributions and compute or compare mean, median, range and standard deviation.",
        guidance: "Present data as a list or a frequency table. Ask conceptual questions about spread at harder levels.",
        formats: MATH,
      },
      {
        id: "two-variable-data",
        name: "Two-variable data: models and scatterplots",
        description: "Interpret relationships in two-variable data and use linear, quadratic or exponential models.",
        guidance: "Describe scatterplots and lines of best fit in words or give the model equation directly.",
        formats: MATH,
      },
      {
        id: "probability",
        name: "Probability and conditional probability",
        description: "Compute probabilities and conditional probabilities, often from a two-way table.",
        guidance: "Provide a two-way table for conditional probability questions.",
        formats: MATH,
      },
      {
        id: "sample-statistics-margin-of-error",
        name: "Inference from sample statistics and margin of error",
        description: "Draw conclusions about a population from a random sample and interpret margins of error.",
        guidance: "Ask which conclusion is supported by a survey result with a stated margin of error.",
        formats: MC,
      },
      {
        id: "evaluating-statistical-claims",
        name: "Evaluating statistical claims: observational studies and experiments",
        description: "Judge what conclusions a study design supports, including causation and generalization.",
        guidance: "Describe a study and ask which conclusion is appropriate given random sampling or random assignment.",
        formats: MC,
      },
    ],
  },
  {
    id: "geometry-and-trigonometry",
    section: "math",
    name: "Geometry and Trigonometry",
    weight: 0.15,
    skills: [
      {
        id: "area-and-volume",
        name: "Area and volume",
        description: "Solve problems involving area, surface area and volume of shapes and solids.",
        guidance: "Describe every figure fully in words, since no images are shown.",
        formats: MATH,
      },
      {
        id: "lines-angles-triangles",
        name: "Lines, angles, and triangles",
        description:
          "Use properties of parallel lines, angle relationships, triangle angle sums, similarity and congruence.",
        guidance: "Describe every figure fully in words, naming points and which segments are parallel or equal.",
        formats: MATH,
      },
      {
        id: "right-triangles-trigonometry",
        name: "Right triangles and trigonometry",
        description: "Use the Pythagorean theorem, special right triangles, and sine, cosine and tangent.",
        guidance: "Describe the triangle in words, naming the right angle's vertex.",
        formats: MATH,
      },
      {
        id: "circles",
        name: "Circles",
        description:
          "Solve problems with arc length, sector area, central and inscribed angles, radians and circle equations in the xy-plane.",
        guidance: "Harder items may require completing the square to find a circle's center or radius.",
        formats: MATH,
      },
    ],
  },
];

export interface SkillRef {
  section: SectionId;
  domain: Domain;
  skill: Skill;
}

const SKILL_INDEX: ReadonlyMap<string, SkillRef> = new Map(
  DOMAINS.flatMap((domain) =>
    domain.skills.map((skill) => [skill.id, { section: domain.section, domain, skill }] as const),
  ),
);

export function getSkill(skillId: string): SkillRef {
  const ref = SKILL_INDEX.get(skillId);
  if (!ref) {
    throw new Error(`Unknown skill "${skillId}". Known skills: ${[...SKILL_INDEX.keys()].join(", ")}`);
  }
  return ref;
}

export function allSkills(): SkillRef[] {
  return [...SKILL_INDEX.values()];
}

export function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

export const SECTION_NAMES: Record<SectionId, string> = {
  "reading-writing": "Reading and Writing",
  math: "Math",
};
