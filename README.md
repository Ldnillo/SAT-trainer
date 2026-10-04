# SAT Trainer

A paid SAT practice site built on **original** SAT-style questions. This repository currently holds the question generator and question bank; the tailored practice trainer and season-pass payments come next.

> SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this product.

## Stack

- **Next.js 16 + TypeScript** (App Router) for the site, so the trainer and payments can live in the same app.
- **Claude API** (`@anthropic-ai/sdk`, model `claude-opus-5-5`) writes and checks questions.
- **Postgres via Drizzle ORM** for the question bank. With no `DATABASE_URL`, an embedded Postgres ([PGlite](https://pglite.dev)) in `.data/pglite` is used, so local development needs no database server.

## Quick start

```bash
npm install
cp .env.example .env.local      # add your ANTHROPIC_API_KEY
npm run generate -- --list-skills
npm run generate -- --skill transitions --difficulty medium --count 3
npm run bank -- stats
npm run dev                      # then open http://localhost:3000/bank
```

## How generation works

`npm run generate` (see `src/lib/generator/generate.ts`) runs this pipeline for one skill and difficulty:

1. **Write.** Claude gets a fixed system prompt (digital SAT style, originality rules, an original example) and a request naming the domain, skill, difficulty, format, a rotation of subject areas, and summaries of questions already in the bank to avoid. Output is constrained to the question schema (`src/lib/sat/question.ts`) with structured outputs.
2. **Check structure** (`src/lib/sat/validate.ts`): four distinct choices A-D, passage of 25-150 words, two passages for cross-text items, a table for quantitative evidence, a blank where the skill needs one, grid-in answers that fit the answer grid and agree in value, and no mention of the College Board.
3. **Check originality within the bank** (`src/lib/sat/similarity.ts`): near-duplicates of existing questions are rejected.
4. **Solve independently.** A second Claude call sees the question without the key, answers it, lists any problems (two defensible answers, factual errors, ambiguity) and estimates difficulty.
5. **Save** every question with a status:
   - `verified`: passed everything; the solver agreed with the key. Served to students.
   - `needs-review`: well-formed, but the solver disagreed, raised an issue, or the difficulty looked two levels off. Review at `/bank?status=review` and run `npm run bank -- approve <id>` or `reject <id>`.
   - `rejected`: failed structural or duplicate checks. Kept for the record, never served.

Each question stores its provenance (model requested and served, prompt version, batch id, timestamp, any public-domain source) so authorship can be shown if ever challenged.

### Rules the generator follows

From the sourcing research (`research/question-sourcing.md` in the project files): College Board questions can't be used in a paid product or with AI. The generator writes every passage and question from scratch, may quote only public-domain texts (pre-1929 or U.S. government works), never paraphrases real test items, and never calls a question "official".

## Content model

`src/lib/sat/taxonomy.ts` lists both sections, all 8 domains (with their approximate weights) and 30 skills, each with a stable id. Every question row has indexed `section`, `domain`, `skill`, `difficulty` (`easy` / `medium` / `hard`), `format` (`multiple-choice` / `student-produced-response`) and `status` columns, plus the question body as JSON.

The practice trainer should read questions through `findQuestions` in `src/lib/db/questions.ts`, which filters by section, domain, skills, difficulties and status (verified only by default), can exclude questions a student has already seen, and can return them in random order.

Math expressions are written in LaTeX inside `$...$`; the trainer UI should render them (for example with KaTeX). Figures are described in words or tables, since questions have no images yet.

## Commands

| Command | What it does |
| --- | --- |
| `npm run generate -- --skill <id> [--difficulty easy\|medium\|hard] [--count N] [--format mc\|spr]` | Generate questions for one skill (all three difficulties if none given). |
| `npm run generate -- --all --count N` | Generate N questions for every skill and difficulty. |
| `npm run bank -- stats \| show <id> \| approve <id> \| reject <id> \| export` | Inspect and curate the bank. |
| `npm test` | Unit and pipeline tests (no API calls; uses an in-memory database). |
| `npm run typecheck`, `npm run lint`, `npm run build` | Checks. |
| `npm run db:generate` | Create a migration after changing `src/lib/db/schema.ts`. Migrations run automatically on startup. |

## Cost

Each question costs one generation share plus one solver call on Claude Opus 5.5 at `high` effort. Set `SAT_GENERATOR_EFFORT=medium` to spend less, and compare the share of `verified` questions before switching for good.
