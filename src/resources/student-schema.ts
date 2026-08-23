import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { STUDENT_SCHEMA } from "../models/student-schema.js";
import { STUDENT_COLLECTIONS } from "../models/student-collections.js";

export const studentSchemaResource = {
  uri: "mongodb://student-schema",
  name: "Student Database Schema",
  description:
    "Schema and business rules for the student result collections.",
  mimeType: "application/json",
  text: JSON.stringify(
    {
      collections: STUDENT_COLLECTIONS,
      schema: STUDENT_SCHEMA,
    },
    null,
    2
  ),
};