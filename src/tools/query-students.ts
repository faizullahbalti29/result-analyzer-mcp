import { z } from "zod";
import { getDatabase } from "../db.js";
import type { Filter } from "mongodb";

/**
 * MCP input schema
 */
export const queryStudentsSchema = {
  collection: z.enum(["nineth_students", "tenth_students"]),

  filters: z
    .object({
     institution: z
  .object({
    contains: z.string().optional(),

    containsAny: z
      .array(z.string())
      .min(1)
      .optional(),

    equals: z.string().optional(),

    startsWith: z.string().optional(),
  })
  .optional(),

      name: z
        .object({
          contains: z.string().optional(),
          equals: z.string().optional(),
          startsWith: z.string().optional(),
        })
        .optional(),

      roll_no: z
        .object({
          equals: z.string().optional(),
        })
        .optional(),

      status: z
        .object({
          equals: z.string().optional(),
        })
        .optional(),

      grade: z
        .object({
          equals: z.string().optional(),
        })
        .optional(),

      marks: z
        .object({
          equals: z.number().optional(),
          greaterThan: z.number().optional(),
          lessThan: z.number().optional(),
          greaterThanOrEqual: z.number().optional(),
          lessThanOrEqual: z.number().optional(),
        })
        .optional(),
    })
    .optional(),

  sort: z
    .object({
      field: z.enum(["marks", "name", "roll_no"]),
      direction: z.enum(["asc", "desc"]),
    })
    .optional(),

  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),
};

/**
 * Student document returned from MongoDB
 */
type Student = {
  roll_no: string;
  name: string;
  status: string;
  marks: number;
  grade: string;
  remarks: string | null;
  institution: string;
};

/**
 * Input type used by queryStudents()
 *
 * `| undefined` is intentional because
 * exactOptionalPropertyTypes is enabled in tsconfig.json.
 */
type QueryStudentsInput = {
  collection: "nineth_students" | "tenth_students";

  filters?:
    | {
        institution?:
           | {
      contains?: string | undefined;

      containsAny?:
        | string[]
        | undefined;

      equals?: string | undefined;

      startsWith?: string | undefined;
    }
  | undefined;

        name?:
          | {
              contains?: string | undefined;
              equals?: string | undefined;
              startsWith?: string | undefined;
            }
          | undefined;

        roll_no?:
          | {
              equals?: string | undefined;
            }
          | undefined;

        status?:
          | {
              equals?: string | undefined;
            }
          | undefined;

        grade?:
          | {
              equals?: string | undefined;
            }
          | undefined;

        marks?:
          | {
              equals?: number | undefined;
              greaterThan?: number | undefined;
              lessThan?: number | undefined;
              greaterThanOrEqual?: number | undefined;
              lessThanOrEqual?: number | undefined;
            }
          | undefined;
      }
    | undefined;

  sort?:
    | {
        field: "marks" | "name" | "roll_no";
        direction: "asc" | "desc";
      }
    | undefined;

  limit?: number | undefined;
};

/**
 * Query students from the allowed result collections.
 */
export async function queryStudents(
  input: QueryStudentsInput
): Promise<Student[]> {
  const db = await getDatabase();

  const filter: Filter<Student> = {};

  const filters = input.filters;

  /*
   * Institution filter
   */
if (filters?.institution) {
  const condition = filters.institution;

  if (condition.containsAny?.length) {
    filter.institution = {
      $regex: condition.containsAny
        .map((value) => escapeRegex(value.trim()))
        .join("|"),
      $options: "i",
    };
  } else if (condition.contains) {
    const values = condition.contains
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean);

   if (values.length === 1) {
  filter.institution = {
    $regex: escapeRegex(values[0]!),
    $options: "i",
  };
} else if (values.length > 1) {
      filter.institution = {
        $regex: values
          .map((value) => escapeRegex(value))
          .join("|"),
        $options: "i",
      };
    }
  } else if (condition.equals) {
    filter.institution = condition.equals;
  } else if (condition.startsWith) {
    filter.institution = {
      $regex: `^${escapeRegex(condition.startsWith)}`,
      $options: "i",
    };
  }
}

  /*
   * Name filter
   */
  if (filters?.name) {
    const condition = filters.name;

    if (condition.contains) {
      filter.name = {
        $regex: escapeRegex(condition.contains),
        $options: "i",
      };
    } else if (condition.equals) {
      filter.name = condition.equals;
    } else if (condition.startsWith) {
      filter.name = {
        $regex: `^${escapeRegex(condition.startsWith)}`,
        $options: "i",
      };
    }
  }

  /*
   * Roll number filter
   */
  if (filters?.roll_no?.equals) {
    filter.roll_no = filters.roll_no.equals;
  }

  /*
   * Status filter
   */
  if (filters?.status?.equals) {
    filter.status = filters.status.equals;
  }

  /*
   * Grade filter
   */
  if (filters?.grade?.equals) {
    filter.grade = filters.grade.equals;
  }

  /*
   * Marks filter
   */
  if (filters?.marks) {
    const condition = filters.marks;

    const marksFilter: Record<string, number> = {};

    if (condition.equals !== undefined) {
      marksFilter.$eq = condition.equals;
    }

    if (condition.greaterThan !== undefined) {
      marksFilter.$gt = condition.greaterThan;
    }

    if (condition.lessThan !== undefined) {
      marksFilter.$lt = condition.lessThan;
    }

    if (condition.greaterThanOrEqual !== undefined) {
      marksFilter.$gte = condition.greaterThanOrEqual;
    }

    if (condition.lessThanOrEqual !== undefined) {
      marksFilter.$lte = condition.lessThanOrEqual;
    }

    if (Object.keys(marksFilter).length > 0) {
      filter.marks = marksFilter;
    }
  }

  /*
   * MongoDB collection
   */
  const collection = db.collection<Student>(input.collection);

  /*
   * Create query cursor
   */
  const cursor = collection.find(filter);

  /*
   * Sorting
   */
  if (input.sort) {
    cursor.sort({
      [input.sort.field]:
        input.sort.direction === "asc" ? 1 : -1,
    });
  }

  /*
   * Limit results
   */
  cursor.limit(input.limit ?? 10);

  /*
   * Remove MongoDB _id from returned data
   */
  return cursor
    .project<Student>({
      _id: 0,
    })
    .toArray();
}

/**
 * Escape user/AI supplied text before using it
 * inside a MongoDB regular expression.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}