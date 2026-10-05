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

## Practice tools

- **Graphing calculator** (`src/lib/calculator/engine.ts`, `src/components/calculator`): a "Calculator" button on every math question, in practice sets and in the math modules of the practice test. It works like the Desmos calculator on the digital SAT: an expression list (`y = 2x + 1`, `x^2 + y^2 = 25`, `y < 3x`, `a = 4`, `f(x) = x^2`, `(2, 5)`, or plain arithmetic with the answer shown as a decimal and a fraction) next to a graph you drag and zoom. Tapping a curve reads off a point; grey dots mark intercepts, minimums and maximums, and intersections. Radians or degrees. It's NextScore's own code, using mathjs (Apache-2.0) for the arithmetic, so there's no license fee. The Desmos calculator itself needs a paid commercial Desmos API plan on a paid site; set `DESMOS_API_KEY` to use Desmos instead.
- **Flag for review**: a flag button on every practice question and on each question in practice test results (`question_flags` table, `src/lib/trainer/review.ts`). Flags stay until the student removes them. The in-test "Mark for review" checkbox is separate and only lasts for that module, as on the real test.
- **My mistakes** (`/review`): every question whose latest answer was wrong, from practice or practice tests, with the question, the student's answer and the explanation. "Retry" starts a practice set of up to 10 of them, oldest first; a question leaves the list once it's answered correctly. Flagged questions can be practiced the same way. Retry sets count toward mastery like any other set and need a pass or a free set.
- **Report a problem**: a button next to "Flag for review" on every practice question, on each question in practice test results and on the Review page. Students pick what's wrong (wrong answer key, unclear or two right answers, bad explanation, typo or display problem, something else) and can add a note; it saves without leaving the page, up to 20 reports per student per hour (`question_reports` table, `src/lib/trainer/reports.ts`). Not shown inside a timed test module, as on the real test.
- **Problem reports** (`/admin/reports`, staff only): reports grouped by question, newest first, with the question's file id (e.g. `transitions-001`), who reported it, their note, and the question with its answer and explanation. Fix the question in `content/questions/<skill>.json`, run `npm run import`, then "Mark fixed"; "Dismiss" when nothing is wrong. Staff are the accounts listed in `ADMIN_EMAILS`; they also see a "Problem reports" tab in Settings. Without `ADMIN_EMAILS`, every signed-in account counts as staff in development and none in production.

## Full-length practice test

`/test` runs a timed, adaptive mock exam laid out like the digital SAT (`src/lib/test`): Reading and Writing in two 32-minute modules of 27 questions, a suggested 10-minute break, then Math in two 35-minute modules of 22 questions. Our questions are all scored (the real test adds a few unscored pretest items).

- **Assembly** (`assemble.ts`): each module follows the section's domain counts. Module 1 mixes easy, medium and hard evenly; module 2 is built when module 1 is submitted, harder if the student got at least 60% right, easier otherwise. Questions the student hasn't seen come first and none repeats within a test. Reading and Writing is grouped by domain, each group easiest to hardest; Math runs easiest to hardest.
- **Timing**: a module's clock starts when the student opens it and is enforced on the server (answers after time plus 15 seconds are refused, and an expired module is submitted the next time the test is loaded). Within a module students can skip, flag and change answers; answers save as they go. No answer key reaches the browser until the test ends.
- **Scoring** (`scoring.ts`): an ability estimate from every answer in the section (one-parameter IRT, easy/medium/hard at -1/0/+1), mapped onto 200-800, so harder questions count for more and only the harder module 2 reaches the top. It is labelled an estimate, not an official score. Answered questions are also written to `attempts`, so tests update skill mastery.
- **Access**: needs a season pass (`testAccess` in `src/lib/billing/pass.ts`, checked in `startPracticeTest`). `FREE_PRACTICE_TESTS` (default 0) allows free tests before paying.

### Account security and privacy

- **Password reset** (`/forgot-password`, `src/lib/auth/reset.ts`): emails a one-time link that works for 60 minutes. Only a hash of the token is stored, the form gives the same answer whether or not the email has an account, and a reset signs the student out everywhere and emails a "password changed" notice.
- **Emails** (`src/lib/email`): sent through [Resend](https://resend.com) when `RESEND_API_KEY` and `EMAIL_FROM` are set. Without them, in development the email (with its link) is printed in the terminal running `npm run dev`; in production nothing is sent and an error is logged.
- **Rate limits** (`src/lib/auth/rate-limit.ts`): 10 wrong passwords per account per 15 minutes, 3 reset emails per address per hour, plus per-IP limits on sign-in, reset and sign-up. Counted in the `rate_limit_hits` table, so they hold across server instances.
- **Settings** (`/settings`): an Appearance tab to pick light, dark or "match my device" (also flipped by the sun/moon button in the header; saved in a `theme` cookie so pages render in the right colors from the first paint), and an Account tab (`/settings/account`, old `/account` links redirect) to sign out, change password (signs out other devices), download all of the student's data as JSON, and delete the account and everything stored with it.
- **Sign-up** asks students to confirm they are 13 or older and agree to the terms and privacy policy (under 18: with a parent or guardian), and stores when they did.
- **Legal pages**: `/privacy` and `/terms` (drafts; have a lawyer review them before launch). The support email, business name and governing state come from `SUPPORT_EMAIL`, `LEGAL_OPERATOR_NAME` and `LEGAL_GOVERNING_STATE`; until set, the pages show `[placeholders]`. The refund window (7 days) is `REFUND_DAYS` in `src/lib/site.ts`. Update `LEGAL_UPDATED` there whenever the wording changes.
- **Security headers** (`next.config.ts`): no framing, no MIME sniffing, HSTS, and reset links are never sent in the Referer header. `robots.txt` keeps search engines out of private pages.

### Before launch

1. Have a lawyer review `/privacy` and `/terms`, and confirm the refund policy and where data is stored.
2. Set `SUPPORT_EMAIL`, `LEGAL_OPERATOR_NAME` and `LEGAL_GOVERNING_STATE`, and `ADMIN_EMAILS` to the accounts that review problem reports.
3. Create a Resend account, verify the site's domain, and set `RESEND_API_KEY` and `EMAIL_FROM`. Try a password reset on the live site.
4. Set `APP_URL` to the site's address so links in emails always point to it.
5. Switch Stripe to live keys and a live webhook (see Setting up Stripe below).

## Season pass

Students get one free practice set (`FREE_PRACTICE_SETS`), then need a season pass to start new sets. A pass is a single Stripe Checkout payment, not a subscription: three plans, **$12 for 30 days, $21 for 60 days and $30 for 90 days**, shown as launch prices. The plans live in `PASS_PLANS` in `src/lib/billing/config.ts`; `SEASON_PASS_CURRENCY` is in `.env.local`. Buying again while a pass is active adds the days after the current pass ends. Dashboards and past results stay visible without a pass.

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
