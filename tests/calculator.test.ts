import { describe, expect, it } from "vitest";
import { asFraction, compileLines, formatNumber, pointsOfInterest, type Line } from "../src/lib/calculator/engine";

function one(text: string, degrees = false): Line {
  return compileLines([text], { degrees })[0];
}

function value(text: string | string[], degrees = false): number {
  const lines = compileLines(Array.isArray(text) ? text : [text], { degrees });
  const last = lines[lines.length - 1];
  if (last.kind !== "value") throw new Error(`expected a value, got ${JSON.stringify(last)}`);
  return last.value;
}

function fn(text: string | string[]): (x: number) => number {
  const lines = compileLines(Array.isArray(text) ? text : [text]);
  const last = lines[lines.length - 1];
  if (last.kind !== "function") throw new Error(`expected a function, got ${JSON.stringify(last)}`);
  return last.f;
}

describe("calculator lines", () => {
  it("evaluates plain arithmetic the way students type it", () => {
    expect(value("3/8 + 1")).toBe(1.375);
    expect(value("2^10")).toBe(1024);
    expect(value("sqrt(16) + |−3|")).toBe(7);
    expect(value("√(49)")).toBe(7);
    expect(value("2π")).toBeCloseTo(6.2832, 4);
    expect(value("log(1000)")).toBeCloseTo(3);
    expect(value("ln(e^2)")).toBeCloseTo(2);
    expect(value("5!")).toBe(120);
  });

  it("switches trig between radians and degrees", () => {
    expect(value("sin(pi/2)")).toBeCloseTo(1);
    expect(value("sin(30)", true)).toBeCloseTo(0.5);
    expect(value("arctan(1)", true)).toBeCloseTo(45);
    expect(value("sin 30", true)).toBeCloseTo(0.5);
  });

  it("graphs y = ... and bare expressions in x, with implied multiplication", () => {
    expect(fn("y = 2x + 3")(4)).toBe(11);
    expect(fn("x^2 - 4")(3)).toBe(5);
    expect(fn("y = 3(x+1)")(1)).toBe(6);
    expect(fn("y = sinx")(0)).toBe(0);
    expect(fn("y=|x-2|")(0)).toBe(2);
    expect(Number.isNaN(fn("y = sqrt(x)")(-1))).toBe(true);
  });

  it("uses constants and functions defined on any line, in any order", () => {
    const lines = compileLines(["y = a x + b", "a = 2", "b = a + 1"]);
    expect(lines[1]).toEqual({ kind: "constant", name: "a", value: 2 });
    expect(lines[2]).toEqual({ kind: "constant", name: "b", value: 3 });
    expect(lines[0].kind === "function" && lines[0].f(1)).toBe(5);
    expect(value(["f(x) = x^2 + k", "k = 1", "f(3)"])).toBe(10);
    expect(fn(["f(x) = x^2", "y = f(x) + 1"])(2)).toBe(5);
    expect(fn("f(t) = 2t")(4)).toBe(8);
  });

  it("treats xy as x times y and draws other equations as curves", () => {
    const circle = one("x^2 + y^2 = 25");
    expect(circle.kind).toBe("relation");
    if (circle.kind === "relation") expect(circle.F(3, 4)).toBeCloseTo(0);
    const hyperbola = one("xy = 4");
    expect(hyperbola.kind === "relation" && hyperbola.F(2, 2)).toBeCloseTo(0);
    const vertical = one("x = 3");
    expect(vertical.kind === "relation" && vertical.F(3, 10)).toBe(0);
  });

  it("reads inequalities and points", () => {
    const region = one("y < 2x + 1");
    expect(region.kind === "relation" && region.op).toBe("<");
    expect(region.kind === "relation" && region.F(0, 0)).toBeLessThan(0);
    expect(one("y ≥ x").kind === "relation" && (one("y ≥ x") as { op: string }).op).toBe(">=");
    expect(one("(2, 5)")).toEqual({ kind: "point", x: 2, y: 5 });
    expect(one("(sqrt(4), -1)")).toEqual({ kind: "point", x: 2, y: -1 });
  });

  it("explains mistakes instead of crashing", () => {
    expect(one("y = 2k")).toEqual({ kind: "error", message: "Define k first, like k = 2." });
    expect(one("2x +").kind).toBe("error");
    expect(one("x + y").kind).toBe("error");
    expect(one("1 < x < 3").kind).toBe("error");
    expect(one("   ")).toEqual({ kind: "empty" });
  });
});

describe("points of interest", () => {
  it("finds intercepts, turning points and intersections", () => {
    const lines = compileLines(["y = x^2 - 4", "y = x + 2"]);
    const points = pointsOfInterest(lines, -10, 10, 20);
    const of = (kind: string) => points.filter((p) => p.kind === kind).map((p) => [p.x, p.y]);
    expect(of("x-intercept")).toEqual(expect.arrayContaining([[-2, 0], [2, 0]]));
    expect(of("minimum")).toEqual([[0, -4]]);
    expect(of("intersection")).toEqual(expect.arrayContaining([[-2, 0], [3, 5]]));
    expect(of("y-intercept")).toEqual(expect.arrayContaining([[0, -4], [0, 2]]));
  });

  it("doesn't mistake a jump for a zero", () => {
    const points = pointsOfInterest(compileLines(["y = 1/x"]), -5, 5, 10);
    expect(points.filter((p) => p.kind === "x-intercept")).toEqual([]);
  });
});

describe("number display", () => {
  it("rounds away floating-point noise and offers fractions", () => {
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(1 / 3)).toBe("0.3333333333");
    expect(asFraction(1.75)).toBe("7/4");
    expect(asFraction(-2 / 3)).toBe("-2/3");
    expect(asFraction(Math.PI)).toBeNull();
    expect(asFraction(4)).toBeNull();
  });
});
