import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../db/mongodb.js";
import { queryInputSchema } from "./query-schema.js";
import { serializeMongoResult } from "../db/serialize.js";
export function registerQueryTool(server: McpServer) {
  server.tool(
    "mongodb_query",
    "Execute a read-only MongoDB query against the student result database.",
    queryInputSchema,
    async (input) => {
      const db = await getDatabase();

      const collection = db.collection(input.collection);

      let result: unknown;

      switch (input.operation) {
        case "find": {
          let cursor = collection.find(input.filter ?? {});

          if (input.projection) {
            cursor = cursor.project(input.projection);
          }

          if (input.sort) {
            cursor = cursor.sort(input.sort);
          }

          if (input.skip !== undefined) {
            cursor = cursor.skip(input.skip);
          }

          if (input.limit !== undefined) {
            cursor = cursor.limit(input.limit);
          }

          result = await cursor.toArray();

          break;
        }

        case "findOne": {
          result = await collection.findOne(
            input.filter ?? {},
            input.projection
              ? { projection: input.projection }
              : undefined
          );

          break;
        }

        case "aggregate": {
          result = await collection
            .aggregate(input.pipeline ?? [])
            .toArray();

          break;
        }

        case "countDocuments": {
          result = await collection.countDocuments(
            input.filter ?? {}
          );

          break;
        }

        case "distinct": {
          if (!input.field) {
            throw new Error(
              "field is required for distinct operation"
            );
          }

          result = await collection.distinct(
            input.field,
            input.filter ?? {}
          );

          break;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
  serializeMongoResult(result),
  null,
  2
),
          },
        ],
      };
    }
  );
}