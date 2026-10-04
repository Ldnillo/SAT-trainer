import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>SAT Trainer</h1>
      <p>
        Original SAT-style practice for every Reading and Writing and Math skill, tailored to the areas where you
        can gain the most points.
      </p>
      <ul>
        <li>Every answer updates your mastery of each of the 30 skills the digital SAT tests.</li>
        <li>Each practice set focuses on your weakest, most heavily tested skills, at the right difficulty.</li>
        <li>Your estimated section scores update after every set, so you can see your progress.</li>
      </ul>
      <p>
        <Link href="/signup" className="button">
          Start practicing
        </Link>{" "}
        or <Link href="/login">sign in</Link>
      </p>
    </main>
  );
}
