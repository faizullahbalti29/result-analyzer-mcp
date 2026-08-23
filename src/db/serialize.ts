import { ObjectId } from "mongodb";

export function serializeMongoResult(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof ObjectId) {
    return value.toHexString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeMongoResult);
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      result[key] = serializeMongoResult(childValue);
    }

    return result;
  }

  return value;
}