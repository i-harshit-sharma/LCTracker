import { describe, it, expect } from "vitest";
import { serializeDates } from "./serialize";

describe("serializeDates", () => {
  it("should convert Date objects to ISO strings", () => {
    const date = new Date("2024-01-01T00:00:00Z");
    const input = {
      name: "Test",
      createdAt: date,
      nested: {
        updatedAt: date,
      },
    };

    const result = serializeDates(input);

    expect(result.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(result.nested.updatedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(result.name).toBe("Test");
  });

  it("should handle arrays of objects with dates", () => {
    const date = new Date("2024-01-01T00:00:00Z");
    const input = [
      { id: 1, date },
      { id: 2, date },
    ];

    const result = serializeDates(input);

    expect(result[0].date).toBe("2024-01-01T00:00:00.000Z");
    expect(result[1].date).toBe("2024-01-01T00:00:00.000Z");
  });

  it("should not modify non-date values", () => {
    const input = {
      number: 123,
      string: "hello",
      boolean: true,
      nullValue: null,
    };

    const result = serializeDates(input);

    expect(result).toEqual(input);
  });
});
