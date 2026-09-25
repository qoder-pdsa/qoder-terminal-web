import { describe, expect, it } from "vitest";
import { formatChange, formatHkTime, formatOhlc, roundDecimalString } from "./quoteFormat";

describe("roundDecimalString", () => {
  it("rounds half up on the exact digits, where toFixed would round down", () => {
    // 1.005 is 1.00499999... as a float, so (1.005).toFixed(2) === "1.00".
    expect(roundDecimalString("1.005", 2)).toBe("1.01");
    expect(roundDecimalString("2.675", 2)).toBe("2.68");
  });

  it("rounds down below the half", () => {
    expect(roundDecimalString("1.6393", 2)).toBe("1.64");
    expect(roundDecimalString("1.644", 2)).toBe("1.64");
    expect(roundDecimalString("1.649", 1)).toBe("1.6");
  });

  it("carries into the integer part", () => {
    expect(roundDecimalString("9.999", 2)).toBe("10.00");
    expect(roundDecimalString("0.999", 2)).toBe("1.00");
    expect(roundDecimalString("99.999", 2)).toBe("100.00");
  });

  it("pads a short fraction and passes an exact one through", () => {
    expect(roundDecimalString("1.6", 2)).toBe("1.60");
    expect(roundDecimalString("7", 2)).toBe("7.00");
    expect(roundDecimalString("0", 2)).toBe("0.00");
    expect(roundDecimalString("1.64", 2)).toBe("1.64");
    expect(roundDecimalString("0.0000", 2)).toBe("0.00");
  });
});

describe("formatChange", () => {
  it("marks a positive change up with a plus sign on both numbers", () => {
    expect(formatChange("7.0000", "1.6393")).toEqual({
      text: "▲ +7.0000 (+1.64%)",
      direction: "up",
    });
  });

  it("marks a negative change down and keeps the minus signs", () => {
    expect(formatChange("-7.0000", "-1.6393")).toEqual({
      text: "▼ -7.0000 (-1.64%)",
      direction: "down",
    });
  });

  it("marks a zero change flat with no sign on either number", () => {
    expect(formatChange("0.0000", "0.0000")).toEqual({
      text: "▬ 0.0000 (0.00%)",
      direction: "flat",
    });
    expect(formatChange("0", "0")).toEqual({ text: "▬ 0 (0.00%)", direction: "flat" });
  });

  it("treats a negative zero change as flat", () => {
    expect(formatChange("-0.0000", "-0.0000")).toEqual({
      text: "▬ 0.0000 (0.00%)",
      direction: "flat",
    });
  });

  it("passes the change digits through with no float artifacts", () => {
    expect(formatChange("0.1000", "0.1000").text).toBe("▲ +0.1000 (+0.10%)");
    expect(formatChange("-611.2500", "-1.2345").text).toBe("▼ -611.2500 (-1.23%)");
  });

  it("takes the direction from the change sign, not the percent sign", () => {
    expect(formatChange("-0.5000", "0.0000").direction).toBe("down");
    expect(formatChange("0.5000", "-0.0000").direction).toBe("up");
  });

  it("keeps the percent sign the contract sent instead of restating it", () => {
    expect(formatChange("7.0000", "-1.6393").text).toBe("▲ +7.0000 (-1.64%)");
  });

  it("accepts a leading plus on the change", () => {
    expect(formatChange("+7.0000", "1.6393")).toEqual({
      text: "▲ +7.0000 (+1.64%)",
      direction: "up",
    });
  });
});

describe("formatOhlc", () => {
  it("labels the three contract strings in O/H/L order", () => {
    expect(formatOhlc("431.6000", "436.2000", "430.8000")).toBe("O 431.6000  H 436.2000  L 430.8000");
  });

  it("passes the digits through with no rounding and no float artifacts", () => {
    expect(formatOhlc("348.8646", "349.8065", "348.7146")).toBe("O 348.8646  H 349.8065  L 348.7146");
    expect(formatOhlc("0.1000", "0.3000", "0.0700")).toBe("O 0.1000  H 0.3000  L 0.0700");
  });

  it("keeps a whole number as the contract sent it instead of appending decimals", () => {
    expect(formatOhlc("388", "390", "385")).toBe("O 388  H 390  L 385");
  });

  it("matches the shape the Q panel is verified against", () => {
    expect(formatOhlc("348.8646", "349.8065", "348.7146")).toMatch(
      /^O \d+\.\d{4}\s+H \d+\.\d{4}\s+L \d+\.\d{4}$/,
    );
  });

  it("shows the previous close three times before the session instead of a zero price", () => {
    // qoder-terminal-data falls back to prevClose when Longbridge leaves Open/High/Low nil,
    // so the panel must render that repeated value rather than blanking or zeroing the row.
    expect(formatOhlc("380.0000", "380.0000", "380.0000")).toBe("O 380.0000  H 380.0000  L 380.0000");
  });
});

describe("formatHkTime", () => {
  it("renders a UTC timestamp as HH:mm in Asia/Hong_Kong", () => {
    expect(formatHkTime("2026-09-18T01:23:45Z")).toBe("09:23 HKT");
    expect(formatHkTime("2026-09-18T00:00:00Z")).toBe("08:00 HKT");
    expect(formatHkTime("2026-09-18T13:05:00Z")).toBe("21:05 HKT");
  });

  it("pads single-digit hours and minutes", () => {
    expect(formatHkTime("2026-09-18T01:02:03Z")).toBe("09:02 HKT");
  });

  it("uses a 24-hour clock at midnight instead of 24:00", () => {
    // 16:30Z is 00:30 the next day in Hong Kong.
    expect(formatHkTime("2026-09-18T16:30:00Z")).toBe("00:30 HKT");
  });

  it("keeps an already-offset timestamp on the Hong Kong wall clock", () => {
    expect(formatHkTime("2026-09-18T09:23:45+08:00")).toBe("09:23 HKT");
    expect(formatHkTime("2026-09-18T01:23:45.500Z")).toBe("09:23 HKT");
  });
});
