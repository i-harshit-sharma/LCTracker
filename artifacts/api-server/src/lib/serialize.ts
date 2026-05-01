/**
 * Recursively converts Date objects to ISO strings so that Zod schemas
 * expecting `z.string()` for timestamp fields don't throw type errors.
 *
 * JSON.parse(JSON.stringify(value)) is the simplest way to do this —
 * JSON.stringify naturally serializes Dates to ISO strings.
 */
export function serializeDates<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
