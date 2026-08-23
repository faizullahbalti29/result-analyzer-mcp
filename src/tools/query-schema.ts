import { z } from "zod";

export const queryInputSchema = {
  collection: z.enum([
    "nineth_students",
    "tenth_students",
  ]),

  operation: z.enum([
    "find",
    "findOne",
    "aggregate",
    "countDocuments",
    "distinct",
  ]),

  filter: z.record(z.string(), z.unknown()).optional(),

  projection: z.record(z.string(), z.unknown()).optional(),

sort: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])).optional(),

  skip: z.number().int().min(0).optional(),

  limit: z.number().int().min(1).max(1000).optional(),

  pipeline: z.array(z.record(z.string(), z.unknown())).optional(),

  field: z.string().optional(),
};