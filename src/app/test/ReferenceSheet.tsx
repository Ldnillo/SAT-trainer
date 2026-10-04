import { MathText } from "@/components/MathText";

/** Formulas a student may look up during Math, in our own words. */
const FORMULAS: [string, string][] = [
  ["Circle", "$A = \\pi r^2$, $C = 2\\pi r$"],
  ["Rectangle", "$A = \\ell w$"],
  ["Triangle", "$A = \\frac{1}{2}bh$"],
  ["Pythagorean theorem", "$c^2 = a^2 + b^2$"],
  ["Special right triangles", "$30^\\circ$-$60^\\circ$-$90^\\circ$: sides $x$, $x\\sqrt{3}$, $2x$. $45^\\circ$-$45^\\circ$-$90^\\circ$: sides $s$, $s$, $s\\sqrt{2}$"],
  ["Rectangular prism", "$V = \\ell wh$"],
  ["Cylinder", "$V = \\pi r^2 h$"],
  ["Sphere", "$V = \\frac{4}{3}\\pi r^3$"],
  ["Cone", "$V = \\frac{1}{3}\\pi r^2 h$"],
  ["Pyramid", "$V = \\frac{1}{3}\\ell wh$"],
];

export function ReferenceSheet() {
  return (
    <>
      <h3>Reference</h3>
      <table>
        <tbody>
          {FORMULAS.map(([name, formula]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td>
                <MathText text={formula} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        A circle has <MathText text="$360$" /> degrees of arc, or <MathText text="$2\pi$" /> radians. The angles of a
        triangle add up to <MathText text="$180^\circ$" />.
      </p>
    </>
  );
}
