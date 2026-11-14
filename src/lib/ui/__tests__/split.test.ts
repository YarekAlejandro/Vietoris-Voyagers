import { describe, expect, it } from "vitest";
import { nextSplitHeight, splitPercent } from "../split";

describe("nextSplitHeight", () => {
  it("mueve el divisor y conserva la suma", () => {
    const top = nextSplitHeight(200, 40, 400, 72, 96);
    expect(top).toBe(240);
    expect(400 - top).toBe(160);
  });

  it("respeta los mínimos de arriba y de abajo", () => {
    expect(nextSplitHeight(200, -500, 400, 72, 96)).toBe(72);
    expect(nextSplitHeight(200, 500, 400, 72, 96)).toBe(304);
  });

  it("reparte por mitades si no caben los dos mínimos", () => {
    expect(nextSplitHeight(50, 30, 120, 72, 96)).toBe(60);
    expect(nextSplitHeight(0, 0, 0, 72, 96)).toBe(0);
  });
});

describe("splitPercent", () => {
  it("expresa el alto superior en % del total", () => {
    expect(splitPercent(100, 400)).toBe(25);
    expect(splitPercent(0, 0)).toBe(50);
  });
});
