# NextScore

A paid SAT practice site built on **original** SAT-style questions. This repository holds the question generator, the question bank, the tailored practice trainer and season pass payments.

> SAT® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this product.

## Stack

- **Next.js 16 + TypeScript** (App Router) for the site, so the trainer and payments can live in the same app.
- **Claude API** (`@anthropic-ai/sdk`, model `claude-opus-5-5`) writes and checks questions.
- **Postgres via Drizzle ORM** for the question bank. With no `DATABASE_URL`, an embedded Postgres ([PGlite](https://pglite.dev)) in `.data/pglite` is used, so local development needs no database server.

## Quick start

```bash
npm install
npm run import                   # load content/questions into the bank
npm run bank -- stats
npm run dev                      # then open http://localhost:3000 and sign up (or /bank to review questions)
```

## Two ways to add questions

1. **Question files (no API needed).** Questions live as JSON in `content/questions/<skill-id>.json`, one file per skill, reviewed in pull requests like code. Write them by hand, or ask Claude in the project to write a batch. `npm run import` validates them and loads them into the bank, matching each one by its stable id (`transitions-001`), so re-running it updates edited questions instead of duplicating them. `npm run check:questions` validates every file without a database and runs in CI.
2. **Automated generator (needs an Anthropic API key).** `npm run generate` writes and checks questions with the Claude API, described below. Use it when you want volume.

Both paths go through the same checks and end up in the same bank.

### Question file format

```json
{
  "skill": "transitions",
  "questions": [
    {
      "id": "transitions-001",
      "difficulty": "easy",
      "format": "multiple-choice",
      "content": { "passages": [], "table": null, "stem": "...", "choices": [], "correctChoice": "A", "acceptedAnswers": [], "explanation": "...", "distractorRationales": [] },
      "authorship": { "writer": {}, "inputs": {}, "passageSource": "original", "reviews": [] }
    }
  ]
}
```

`content` has the same shape as `QuestionContentSchema` in `src/lib/sat/question.ts`. The rules for writing questions, and the required `authorship` record, are in [`content/AUTHORING.md`](content/AUTHORING.md).

### Authorship record

Every question carries a record of who wrote it (model and date), what they worked from (instructions and any example questions, always our own), where any passage came from (`"original"` or a public-domain work's title, author and year), and who reviewed it and what they changed. The import rejects questions without it, and rejects passages from works that may still be under copyright and examples that look like official test material. The API generator fills it in automatically, recording its prompt and the solver check as the first review. `npm run bank -- approve <id> "Your name"` adds a review to a generated question; for question files, add the review to the file.

Ids are never reused or renumbered; to retire a question, delete it from the file and run `npm run bank -- reject <uuid> "Your name"` (the import lists such orphans).

## How generation works

`npm run generate` (see `src/lib/generator/generate.ts`) runs this pipeline for one skill and difficulty:

1. **Write.** Claude gets a fixed system prompt (digital SAT style, originality rules, an original example) and a request naming the domain, skill, difficulty, format, a rotation of subject areas, and summaries of questions already in the bank to avoid. Output is constrained to the question schema (`src/lib/sat/question.ts`) with structured outputs.
2. **Check structure** (`src/lib/sat/validate.ts`): four distinct choices A-D, passage of 25-150 words, two passages for cross-text items, a table for quantitative evidence, a blank where the skill needs one, grid-in answers that fit the answer grid and agree in value, and no mention of the College Board.
3. **Check originality within the bank** (`src/lib/sat/similarity.ts`): near-duplicates of existing questions are rejected.
4. **Solve independently.** A second Claude call sees the question without the key, answers it, lists any problems (two defensible answers, factual errors, ambiguity) and estimates difficulty.
5. **Save** every question with a status:
   - `verified`: passed everything; the solver agreed with the key. Served to students.
   - `needs-review`: well-formed, but the solver disagreed, raised an issue, or the difficulty looked two levels off. Review at `/bank?status=review` and run `npm run bank -- approve <id> "Your name"` or `reject <id> "Your name"`.
   - `rejected`: failed structural or duplicate checks. Kept for the record, never served.

Each question stores its provenance (model requested and served, prompt version, batch id, timestamp) and the authorship record described above.

### Rules the generator follows

From the sourcing research (`research/question-sourcing.md` in the project files): College Board questions can't be used in a paid product or with AI. The generator writes every passage and question from scratch, may quote only public-domain texts (pre-1929 or U.S. government works), never paraphrases real test items, and never calls a question "official".

## Content model

`src/lib/sat/taxonomy.ts` lists both sections, all 8 domains (with their approximate weights) and 30 skills, each with a stable id. Every question row has indexed `section`, `domain`, `skill`, `difficulty` (`easy` / `medium` / `hard`), `format` (`multiple-choice` / `student-produced-response`) and `status` columns, plus the question body as JSON.

The practice trainer should read questions through `findQuestions` in `src/lib/db/questions.ts`, which filters by section, domain, skills, difficulties and status (verified only by default), can exclude questions a student has already seen, and can return them in random order.

Math expressions are written in LaTeX inside `$...$`; the trainer UI should render them (for example with KaTeX). Figures are described in words or tables, since questions have no images yet.

## Practice trainer

Students sign up with a name, email and password (`/signup`), then practice from `/dashboard`.

- **Accounts** (`src/lib/auth`): passwords are hashed with scrypt; sign-in sets an httpOnly session cookie whose SHA-256 is stored in `auth_sessions` (30 days). No outside service or API key is needed. Season passes attach to the `users` table (see below).
- **Mastery** (`src/lib/trainer/mastery.ts`): every answer is stored in `attempts`. Each skill gets an ability rating, updated Elo-style after each answer (easy, medium and hard questions sit at -1, 0 and +1 on the same scale, so a correct hard answer counts for more). Ratings are recomputed from the attempts, so there is no derived state to drift. Levels shown to students: Not started, Needs work, Developing, Strong.
- **Targeted practice** (`src/lib/trainer/plan.ts`): a 10-question set draws skills at random weighted by priority, which is how much the skill counts on the test (its domain weight) times how much room the student has to improve, plus a bonus for skills with little evidence. Each question is picked at the difficulty that suits the student's rating, preferring questions they haven't seen, then ones they missed. Students can also practice one section or one skill. Only verified questions are served.
- **Score progress**: the dashboard shows an estimated 200-800 score per section (shown after 10 answers in that section), a chart of the estimates after each set, the five skills with the most to gain, every skill's level, and recent sets. The estimate maps the expected share of correct answers, weighted by domain, onto 200-800; the page says it is a guide, not a prediction of an official score.
- Math is rendered with KaTeX on the server (`src/components/MathText.tsx`).

## Season pass

Students get one free practice set (`FREE_PRACTICE_SETS`), then need a season pass to start new sets. A pass is a single Stripe Checkout payment, not a subscription: by default **$39 for 90 days** (`SEASON_PASS_PRICE_CENTS`, `SEASON_PASS_DAYS`, `SEASON_PASS_CURRENCY` in `.env.local`). Buying again while a pass is active adds the days after the current pass ends. Dashboards and past results stay visible without a pass.

- **Enforcement** is server-side in `startPractice` (`src/app/practice/actions.ts`) via `practiceAccess` (`src/lib/billing/pass.ts`); the dashboard and `/pass` show the same status.
- **Payments** (`src/lib/billing/stripe.ts`): `/pass` creates a Checkout session with the price inline, so nothing has to be set up in the Stripe dashboard first. The session carries the user id and pass length. A pass is recorded in `season_passes` when Stripe calls the webhook (`/api/stripe/webhook`, signature checked) or when the student lands back on `/pass`, whichever comes first; the checkout session id makes it happen only once. A full refund (`charge.refunded`) ends the pass.

### Setting up Stripe

1. Create a free account at [stripe.com](https://dashboard.stripe.com/register). Test mode works straight away, before any business details are filled in.
2. In test mode, copy the secret key (Developers > API keys, `sk_test_...`) into `STRIPE_SECRET_KEY` in `.env.local`.
3. Webhook, locally: install the [Stripe CLI](https://docs.stripe.com/stripe-cli), run `stripe listen --forward-to localhost:3000/api/stripe/webhook`, and put the `whsec_...` it prints in `STRIPE_WEBHOOK_SECRET`. In production: add an endpoint at `https://<your-site>/api/stripe/webhook` (Developers > Webhooks) for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `charge.refunded`, and use its signing secret.
4. Pay with test card `4242 4242 4242 4242`, any future date and any CVC.
5. To take real payments, activate the account in Stripe (business and bank details), then swap in the live `sk_live_...` key and a live webhook secret.

## Commands

| Command | What it does |
| --- | --- |
| `npm run import` | Load `content/questions/*.json` into the bank (add or update by id). |
| `npm run check:questions` | Validate the question files without a database. |
| `npm run generate -- --skill <id> [--difficulty easy\|medium\|hard] [--count N] [--format mc\|spr]` | Generate questions for one skill (all three difficulties if none given). |
| `npm run generate -- --all --count N` | Generate N questions for every skill and difficulty. |
| `npm run bank -- stats \| show <id> \| approve <id> "Name" \| reject <id> "Name" \| export` | Inspect and curate the bank. |
| `npm test` | Unit and pipeline tests (no API calls; uses an in-memory database). |
| `npm run typecheck`, `npm run lint`, `npm run build` | Checks. |
| `npm run db:generate` | Create a migration after changing `src/lib/db/schema.ts`. Migrations run automatically on startup. |

## Cost

Question files cost nothing to load. For the generator, each question costs one generation share plus one solver call on Claude Opus 5.5 at `high` effort. Set `SAT_GENERATOR_EFFORT=medium` to spend less, and compare the share of `verified` questions before switching for good.
