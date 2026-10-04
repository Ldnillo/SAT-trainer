/**
 * Inspect and curate the question bank.
 *
 *   npm run bank -- stats           # counts per skill, difficulty and status
 *   npm run bank -- show <id>       # print one question with its answer
 *   npm run bank -- approve <id>    # mark a needs-review question verified
 *   npm run bank -- reject <id>
 *   npm run bank -- export > bank.json
 */
import { openDb } from "../src/lib/db/client";
import { countQuestions, findQuestions, getQuestion, setQuestionStatus } from "../src/lib/db/questions";
import { allSkills, DIFFICULTIES } from "../src/lib/sat/taxonomy";

const [command, arg] = process.argv.slice(2);
const { db, close } = await openDb();

try {
  switch (command) {
    case "stats": {
      const counts = await countQuestions(db);
      const get = (skill: string, difficulty: string, status: string) =>
        counts.find((c) => c.skill === skill && c.difficulty === difficulty && c.status === status)?.count ?? 0;
      console.log(`${"skill".padEnd(36)} ${DIFFICULTIES.map((d) => d.padEnd(10)).join(" ")} (verified / needs review)`);
      for (const { skill } of allSkills()) {
        const cells = DIFFICULTIES.map((d) => `${get(skill.id, d, "verified")} / ${get(skill.id, d, "needs-review")}`.padEnd(10));
        console.log(`${skill.id.padEnd(36)} ${cells.join(" ")}`);
      }
      break;
    }
    case "show": {
      const q = arg && (await getQuestion(db, arg));
      if (!q) throw new Error(`No question ${arg}`);
      console.log(JSON.stringify(q, null, 2));
      break;
    }
    case "approve":
    case "reject": {
      if (!arg || !(await getQuestion(db, arg))) throw new Error(`No question ${arg}`);
      await setQuestionStatus(db, arg, command === "approve" ? "verified" : "rejected");
      console.log(`${arg} marked ${command === "approve" ? "verified" : "rejected"}.`);
      break;
    }
    case "export": {
      const rows = await findQuestions(db, { statuses: ["verified"], limit: 100000 });
      console.log(JSON.stringify(rows, null, 2));
      break;
    }
    default:
      console.log("Usage: npm run bank -- stats | show <id> | approve <id> | reject <id> | export");
  }
} finally {
  await close();
}
