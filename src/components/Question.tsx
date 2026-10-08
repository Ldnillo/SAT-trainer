import type { QuestionContent } from "@/lib/sat/question";
import { GridInInput } from "./GridInInput";
import { MathText } from "./MathText";
import styles from "./Question.module.css";

/** Passages, table and question text. Never shows the answer. */
export function QuestionBody({ content }: { content: QuestionContent }) {
  return (
    <>
      {content.passages.map((p, i) => (
        <div key={i} className={styles.passage}>
          {p.label && <strong>{p.label}</strong>}
          <p>
            <MathText text={p.text} />
          </p>
        </div>
      ))}
      {content.table && (
        <table className={styles.table}>
          {content.table.title && (
            <caption>
              <MathText text={content.table.title} />
            </caption>
          )}
          <thead>
            <tr>
              {content.table.columns.map((c, i) => (
                <th key={i}>
                  <MathText text={c} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j}>
                    <MathText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className={styles.stem}>
        <MathText text={content.stem} />
      </p>
    </>
  );
}

/** Answer inputs: four radio choices, or a text box for student-produced response. */
export function AnswerInputs({ content }: { content: QuestionContent }) {
  if (content.choices.length === 0) {
    return (
      <label className={styles.spr}>
        Your answer
        <GridInInput name="answer" required autoFocus />
        <span className={styles.hint}>Enter a number, fraction (like 7/4) or decimal. Negative answers start with -.</span>
      </label>
    );
  }
  return (
    <fieldset className={styles.choices}>
      <legend className={styles.hidden}>Choices</legend>
      {content.choices.map((c) => (
        <label key={c.label} className={styles.choice}>
          <input type="radio" name="answer" value={c.label} required className={styles.radio} />
          <span className={styles.letter}>{c.label}</span>
          <span className={styles.choiceText}>
            <MathText text={c.text} />
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** After answering: the student's answer against the key, with explanations. With no answer, just the key and explanation. */
export function AnswerReview({ content, answer, correct }: { content: QuestionContent; answer: string | null; correct: boolean }) {
  if (answer === null) return <AnswerKey content={content} />;
  const rationale = content.distractorRationales.find((r) => r.label === answer.toUpperCase());
  return (
    <>
      {content.choices.length > 0 ? (
        <ul className={styles.choices}>
          {content.choices.map((c) => {
            const isKey = c.label === content.correctChoice;
            const isPicked = c.label === answer.toUpperCase();
            return (
              <li
                key={c.label}
                className={`${styles.choice} ${isKey ? styles.right : ""} ${isPicked && !isKey ? styles.wrong : ""}`}
              >
                <span className={styles.letter}>{c.label}</span>
                <span className={styles.choiceText}>
                  <MathText text={c.text} />
                </span>
                {(isKey || isPicked) && (
                  <span className={styles.tags}>
                    {isPicked && <span className="badge plain">Your answer</span>}
                    {isKey && <span className="badge ok plain">Correct answer</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.sprReview}>
          Your answer: <strong>{answer}</strong>
          <span className={styles.muted}> · Accepted answers: {content.acceptedAnswers.join(", ")}</span>
        </p>
      )}
      <div className={correct ? styles.feedbackRight : styles.feedbackWrong}>
        <strong className={styles.verdict}>
          <span aria-hidden className={styles.verdictIcon}>
            {correct ? "✓" : "✕"}
          </span>
          {correct ? "Correct." : "Not quite."}
        </strong>
        {!correct && rationale && (
          <p>
            <MathText text={rationale.text} />
          </p>
        )}
        <p>
          <MathText text={content.explanation} />
        </p>
      </div>
    </>
  );
}

/** The correct answer and explanation, for a question the student hasn't answered. */
function AnswerKey({ content }: { content: QuestionContent }) {
  return (
    <>
      {content.choices.length > 0 ? (
        <ul className={styles.choices}>
          {content.choices.map((c) => (
            <li key={c.label} className={`${styles.choice} ${c.label === content.correctChoice ? styles.right : ""}`}>
              <span className={styles.letter}>{c.label}</span>
              <span className={styles.choiceText}>
                <MathText text={c.text} />
              </span>
              {c.label === content.correctChoice && (
                <span className={styles.tags}>
                  <span className="badge ok plain">Correct answer</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.sprReview}>
          Accepted answers: <strong>{content.acceptedAnswers.join(", ")}</strong>
        </p>
      )}
      <div className={styles.feedbackKey}>
        <p>
          <MathText text={content.explanation} />
        </p>
      </div>
    </>
  );
}
