import { describe, it, expect } from "vitest";
import { difficultyColor, escapeHtml } from "./emailDigest";

describe("emailDigest utilities", () => {
  describe("difficultyColor", () => {
    it("should return green for Easy", () => {
      expect(difficultyColor("Easy")).toBe("#22c55e");
    });

    it("should return orange for Medium", () => {
      expect(difficultyColor("Medium")).toBe("#f97316");
    });

    it("should return red for Hard", () => {
      expect(difficultyColor("Hard")).toBe("#ef4444");
    });

    it("should return gray for unknown difficulty", () => {
      expect(difficultyColor("Unknown")).toBe("#6b7280");
    });
  });

  describe("escapeHtml", () => {
    it("should escape HTML characters", () => {
      const input = "<div>\"Hello\" & 'World'</div>";
      const expected = "&lt;div&gt;&quot;Hello&quot; &amp; 'World'&lt;/div&gt;";
      expect(escapeHtml(input)).toBe(expected);
    });

    it("should return original string if no special characters", () => {
      expect(escapeHtml("Hello World")).toBe("Hello World");
    });
  });
});
