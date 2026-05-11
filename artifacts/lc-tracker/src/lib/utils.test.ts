import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("should merge class names correctly", () => {
    expect(cn("base", "extra")).toBe("base extra");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", true && "is-true", false && "is-false")).toBe(
      "base is-true",
    );
  });

  it("should merge tailwind classes correctly", () => {
    expect(cn("p-4", "p-2")).toBe("p-2");
  });
});
