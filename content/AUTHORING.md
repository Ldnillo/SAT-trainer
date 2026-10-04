# Writing questions for the bank

Every question in `content/questions/` follows these rules, whether a person or Claude writes it. When Claude writes a batch in the project, these rules are its instructions, and its authorship record says so.

## Originality

- Write every passage, question and answer choice from scratch. Never copy, paraphrase or "reskin" a College Board question (from Bluebook, the Question Bank, Khan Academy's official practice, a published prep book or a forum). If an idea feels like a remembered test item, drop it.
- Reading and Writing passages are original, or quote or adapt a public-domain work: one published at least 95 years ago (in 2026, 1930 or earlier). Quote accurately and record the work in `passageSource`. Never excerpt modern books, articles or poems.
- Facts about real science, history and people must be accurate. When in doubt, use a hypothetical study or a fictional researcher.
- Never mention the College Board or call a question "official".
- Any example questions shown to the writer must be our own, never College Board's.

## Format

Match the digital SAT: the skill descriptions and guidance in `src/lib/sat/taxonomy.ts`, passages of 25 to 150 words, four answer choices with exactly one correct, and grid-in answers that fit the answer grid. Every question has an explanation and, for multiple choice, a rationale for each wrong choice. `npm run check:questions` enforces the mechanical rules.

## Authorship record (required)

Each question carries an `authorship` object. `npm run import` and CI reject any question without it.

```json
"authorship": {
  "writer": { "name": "claude-opus-5-5", "date": "2026-10-04" },
  "inputs": {
    "instructions": "content/AUTHORING.md and the skill guidance in src/lib/sat/taxonomy.ts; request: ...",
    "examples": []
  },
  "passageSource": "original",
  "reviews": [
    { "reviewer": "Justine", "date": "2026-10-05", "edits": "none" }
  ]
}
```

- **writer**: the Claude model id (or a person's name) and the date it was written.
- **inputs**: the instructions or prompt used, and any example questions shown (list them, or `[]` for none).
- **passageSource**: `"original"`, or `{ "title": ..., "author": ..., "year": ... }` for an adapted public-domain work.
- **reviews**: who checked it and when, and what they changed (`"none"` if nothing). Add an entry each time someone reviews or edits the question.
