import { describe, expect, it } from "vitest";
import { complete, completionCandidates } from "./complete";
import { FUNCTION_CODES } from "./parse";

/** The codes that stand alone, i.e. the first-token candidates that are not symbols. */
const STANDALONE = ["N", "W", "CLEAR"];
/** The codes that follow a symbol; ASK leads a line and CLEAR takes no symbol. */
const AFTER_SYMBOL = ["Q", "GP", "N", "W", "CF"];

/** One Tab press on the command bar as the user sees it. */
const tab = (input: string, entries: readonly string[] = [], cycle = 0) =>
  complete(input, completionCandidates(input, entries), cycle);

describe("complete", () => {
  it("replaces the trailing token with the first prefix match", () => {
    // A completed symbol carries the space that separates it from the function code.
    expect(complete("70", ["700.HK", "9988.HK"], 0)).toEqual({
      text: "700.HK ",
      matches: ["700.HK"],
    });
  });

  it("matches the prefix case-insensitively", () => {
    expect(complete("700 g", ["GP", "Q"], 0).text).toBe("700 GP");
    expect(complete("gp", ["GP"], 0).text).toBe("GP");
  });

  it("keeps the tokens before the one being completed", () => {
    expect(complete("9988.HK C", ["CF", "CLEAR"], 0).text).toBe("9988.HK CF");
  });

  it("reports every match as a completed line, in candidate order", () => {
    expect(complete("7", ["700.HK", "9988.HK", "705.HK"], 0).matches).toEqual([
      "700.HK",
      "705.HK",
    ]);
  });

  it("de-duplicates repeated candidates, keeping the first", () => {
    expect(complete("70", ["700.HK", "700.HK"], 0).matches).toEqual(["700.HK"]);
  });

  it.each([
    [0, "A"],
    [1, "AB"],
    [2, "ABC"],
    [3, "A"],
    [4, "AB"],
  ])("cycles forward: cycle %i completes to %s", (cycle, expected) => {
    expect(complete("A", ["A", "AB", "ABC"], cycle).text).toBe(expected);
  });

  it.each([
    [-1, "ABC"],
    [-2, "AB"],
    [-3, "A"],
    [-4, "ABC"],
  ])("cycles backward: cycle %i completes to %s", (cycle, expected) => {
    expect(complete("A", ["A", "AB", "ABC"], cycle).text).toBe(expected);
  });

  it("completes a new trailing token after a space", () => {
    expect(complete("700 ", ["Q", "GP"], 0).text).toBe("700 Q");
    expect(complete("700 ", ["Q", "GP"], 1).text).toBe("700 GP");
  });

  it("collapses the separators it rewrites", () => {
    expect(complete("700   G", ["GP"], 0).text).toBe("700 GP");
    expect(complete("  700 G", ["GP"], 0).text).toBe("700 GP");
  });

  it("leaves the input untouched when nothing matches", () => {
    expect(complete("XYZ", ["700.HK"], 0)).toEqual({ text: "XYZ", matches: [] });
    expect(complete("700 XYZ", ["GP"], 3)).toEqual({ text: "700 XYZ", matches: [] });
  });

  it("leaves the input untouched when there is nothing to complete", () => {
    expect(complete("", ["700.HK", "GP"], 0)).toEqual({ text: "", matches: [] });
    expect(complete("   ", ["700.HK", "GP"], 0)).toEqual({ text: "   ", matches: [] });
    expect(complete("70", [], 0)).toEqual({ text: "70", matches: [] });
  });

  it("does not mutate the candidate list", () => {
    const candidates = ["700.HK", "700.HK", "9988.HK"];
    complete("7", candidates, 1);
    expect(candidates).toEqual(["700.HK", "700.HK", "9988.HK"]);
  });
});

describe("completionCandidates", () => {
  it("offers the session's symbols first, then the codes that stand alone", () => {
    expect(completionCandidates("70", ["700 Q", "9988.HK GP 6M"])).toEqual([
      "700.HK",
      "9988.HK",
      ...STANDALONE,
    ]);
  });

  it("normalizes the symbols it reads out of the history", () => {
    expect(completionCandidates("0", ["0700 Q", "700.HK GP"])).toEqual(["700.HK", ...STANDALONE]);
  });

  it("de-duplicates a symbol used more than once, keeping the most recent position", () => {
    expect(completionCandidates("9", ["9988.HK GP", "700 Q", "9988 Q"])).toEqual([
      "9988.HK",
      "700.HK",
      ...STANDALONE,
    ]);
  });

  it("offers the codes that follow a symbol for a second token", () => {
    expect(completionCandidates("700 G", ["700 Q"])).toEqual(AFTER_SYMBOL);
    expect(completionCandidates("700.HK ", ["700 Q"])).toEqual(AFTER_SYMBOL);
  });

  it("never offers a symbol, ASK or CLEAR after a symbol", () => {
    const candidates = completionCandidates("700 ", ["700 Q", "9988 Q"]);
    expect(candidates).not.toContain("700.HK");
    expect(candidates).not.toContain("ASK");
    expect(candidates).not.toContain("CLEAR");
  });

  it("offers no candidates for the range token of a GP command", () => {
    expect(completionCandidates("700 GP 6", ["700 GP 6M"])).toEqual([]);
    expect(completionCandidates("700 GP ", ["700 GP 6M"])).toEqual([]);
  });

  it("picks up symbols written inside an ASK question", () => {
    expect(completionCandidates("7", ["ASK is 700.HK cheap?"])).toEqual([
      "700.HK",
      ...STANDALONE,
    ]);
  });

  it("covers every function code that is not ASK", () => {
    const offered = new Set([...completionCandidates("700 ", []), ...completionCandidates("N", [])]);
    expect([...offered].sort()).toEqual(
      (FUNCTION_CODES as readonly string[]).filter((code) => code !== "ASK").sort(),
    );
  });

  it("does not mutate the history entries", () => {
    const entries = ["700 Q", "9988.HK GP"];
    completionCandidates("7", entries);
    expect(entries).toEqual(["700 Q", "9988.HK GP"]);
  });
});

describe("the command bar as the user sees it", () => {
  it("completes a symbol used earlier in the session", () => {
    expect(tab("70", ["700 Q"]).text).toBe("700.HK ");
    expect(tab("70", ["700 Q"]).matches).toEqual(["700.HK"]);
  });

  it("prefers the most recently used symbol", () => {
    // HistoryState.entries is newest first, so 705 Q is the most recent command here.
    const entries = ["705 Q", "9988 Q", "700 Q"];
    expect(tab("7", entries).matches).toEqual(["705.HK", "700.HK"]);
    expect(tab("7", entries).text).toBe("705.HK ");
    expect(tab("7", entries, 1).text).toBe("700.HK ");
  });

  it("completes a second token to a function code", () => {
    expect(tab("700 G", ["700 Q"]).text).toBe("700 GP");
    expect(tab("700.HK G", ["700 Q"]).text).toBe("700.HK GP");
    expect(tab("700.HK ", ["700 Q"]).matches).toEqual([
      "700.HK Q",
      "700.HK GP",
      "700.HK N",
      "700.HK W",
      "700.HK CF",
    ]);
  });

  it("completes a first token to a code that stands alone", () => {
    expect(tab("N", ["700 Q"]).text).toBe("N");
    expect(tab("W", ["700 Q"]).text).toBe("W");
    expect(tab("C", ["700 Q"]).text).toBe("CLEAR");
    expect(tab("c", ["700 Q"]).text).toBe("CLEAR");
  });

  it("never completes a first token to a code that needs a symbol", () => {
    for (const code of ["Q", "GP", "CF", "ASK"]) {
      expect(tab(code, ["700 Q"]).matches).toEqual([]);
      expect(tab(code, ["700 Q"]).text).toBe(code);
    }
  });

  it("ignores history tokens that are not symbols", () => {
    expect(tab("C", ["ASK compare Tencent and Alibaba"]).text).toBe("CLEAR");
    expect(tab("T", ["ASK compare Tencent and Alibaba"]).matches).toEqual([]);
  });

  it("does nothing on an empty bar or on a token nothing matches", () => {
    expect(tab("", ["700 Q"])).toEqual({ text: "", matches: [] });
    expect(tab("XYZ", ["700 Q"])).toEqual({ text: "XYZ", matches: [] });
    expect(tab("700 GP 6", ["700 GP 6M"])).toEqual({ text: "700 GP 6", matches: [] });
  });
});

describe("the space after a completed symbol", () => {
  it("adds one trailing space, so the next keystroke starts the function code", () => {
    expect(tab("9", ["9988 GP"]).text).toBe("9988.HK ");
    expect(tab("70", ["700 Q"]).text).toBe("700.HK ");
  });

  it("leaves a code that stands alone unspaced, because it is already a whole command", () => {
    for (const code of STANDALONE) {
      expect(tab(code, ["700 Q"]).text).toBe(code);
    }
    expect(tab("c", ["700 Q"]).text).toBe("CLEAR");
  });

  it("never spaces the second token", () => {
    expect(tab("9988.HK G", ["9988 GP"]).text).toBe("9988.HK GP");
    expect(tab("700 ", ["700 Q"]).text).toBe("700 Q");
  });

  it("keeps the space out of the candidate list that feeds data-completions", () => {
    expect(tab("9", ["9988 GP", "9989 GP"]).matches).toEqual(["9988.HK", "9989.HK"]);
    expect(tab("70", ["700 Q"]).matches).toEqual(["700.HK"]);
  });

  it("keeps cycling the same symbols with the space present", () => {
    // The space belongs to the completed text, so the cycle still reads the stem the user typed.
    const entries = ["705 Q", "700 Q"];
    expect(tab("70", entries, 0).text).toBe("705.HK ");
    expect(tab("70", entries, 1).text).toBe("700.HK ");
    expect(tab("70", entries, 2).text).toBe("705.HK ");
    expect(tab("70", entries, -1).text).toBe("700.HK ");
  });

  it("treats a completed symbol plus its space as ready for the code, not as a new cycle", () => {
    expect(completionCandidates("9988.HK ", ["9988 GP"])).toEqual(AFTER_SYMBOL);
  });
});
