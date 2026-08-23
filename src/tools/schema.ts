import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { STUDENT_SCHEMA } from "../models/student-schema.js";
import { STUDENT_COLLECTIONS } from "../models/student-collections.js";

export function registerSchemaTool(server: McpServer) {
  server.tool(
    "get_student_schema",
    "Returns the schema, collection information, and business rules for the student result database.",
    async () => {
      const schema = {
        collections: STUDENT_COLLECTIONS,
        schema: STUDENT_SCHEMA,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    }
  );
}