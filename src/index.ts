import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  queryStudents,
  queryStudentsSchema,
} from "./tools/query-students.js";
import {
  analyzeResults,
  analyzeResultsSchema,
} from "./tools/analyze-results.js";
import {
  validateResults,
  validateResultsSchema,
} from "./tools/validate-results.js";
const server = new McpServer({
  name: "fbise-result-mcp",
  version: "1.0.0",
});

server.tool(
  "query_students",

  `
Query student result records from the FBiSE ninth and tenth class collections.

IMPORTANT:
The user must explicitly specify whether they are asking about 9th class
or 10th class results.

If the user's request does not specify a class, do NOT guess the class,
do NOT select a collection, and do NOT call this tool.

Instead, ask:
"Are you asking about 9th class or 10th class results?"

Class mapping:

- 9th class → nineth_students
- 10th class → tenth_students

Use this tool whenever the user asks to search, find, filter, rank,
or retrieve students from the result database.

Supported filters:

- institution
- student name
- roll number
- status
- grade
- marks

Institution and name "contains" filters are case-insensitive.

The institution "contains" field supports multiple OR values separated
by "|", for example:

"SKARDU | GILGIT | BALTISTAN"

Use marks descending when the user asks for:
- top students
- highest marks
- best students
- highest-scoring students
- ranking

Use marks ascending when the user asks for:
- lowest marks
- lowest-scoring students

Return only the records necessary to answer the user's request.
`,

  queryStudentsSchema,

  async (input) => {
    try {
      const students = await queryStudents(input);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(students, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Student query failed:", error);

      return {
        content: [
          {
            type: "text",
            text: "Failed to query students.",
          },
        ],
        isError: true,
      };
    }
  }
);
server.tool(
  "analyze_results",

  `
Analyze FBiSE ninth and tenth class student results.

IMPORTANT:
The user must explicitly specify whether they are asking about 9th class
or 10th class results.

If the class is not specified, do NOT guess.
Ask:
"Are you asking about 9th class or 10th class results?"

This tool performs SERVER-SIDE MongoDB aggregation and should be used
for counts, statistics, summaries, rankings, distributions, and
institution-level analysis.

Use this tool instead of query_students when the user asks:
- how many students
- how many passed/failed
- pass percentage
- average marks
- highest/lowest marks
- grade distribution
- status distribution
- institution statistics
- institution-wise pass counts
- institution-wise grade counts
- top students
- lowest students
- result summaries
- result analysis

The tool supports a Gilgit-Baltistan region filter.

IMPORTANT GB RULE:
When region is GB, the server automatically applies its predefined
Gilgit-Baltistan institution matching rules.

The GB rules include the server-defined inclusion keywords and exclusion
keywords. Claude must NOT create, modify, or guess the GB regex.

When region is GB, ONLY students whose institutions match the server's
GB filter are included in the analysis.

Use query_students when the user specifically wants individual student
records rather than statistics or analysis.
`,

  analyzeResultsSchema,

  async (input) => {
    try {

      const result = await analyzeResults(input);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Result analysis failed:", error);

      return {
        content: [
          {
            type: "text",
            text: "Failed to analyze results.",
          },
        ],
        isError: true,
      };
    }
  }
);
server.tool(
  "validate_results",

  `
Validate FBiSE student result data for database consistency.

IMPORTANT:
The user must explicitly specify whether they are asking about 9th class
or 10th class results.

If the class is not specified, do NOT guess.
Ask:
"Are you asking about 9th class or 10th class results?"

This tool is for detecting accidental or unexpected values in the database.

It checks:

- status
- grade
- remarks
- institution

Validation rules:

STATUS:
Only these statuses are valid:
PASS, FAIL, COMPT., ABSENT

GRADE:
Only these grades are valid:
A1, A, B, C, D, E, F

REMARKS:
The remarks field may contain either an allowed remark OR an allowed
subject code.

The server-defined ALLOWED_REMARKS and ALLOWED_SUBJECTS sets are the
source of truth.

INSTITUTION:
An institution is considered valid for consistency checking when its
name contains at least one server-defined INSTITUTION_KEYWORDS value.

IMPORTANT:
INSTITUTION_KEYWORDS is ONLY for institution data validation.

It is NOT a geographic filter.

GB REGION:
When region is GB, getGBFilter() is used ONLY to restrict the records
being checked to institutions belonging to Gilgit-Baltistan.

getGBFilter() and INSTITUTION_KEYWORDS have completely different purposes.

Use this tool when the user asks:

- Are there invalid statuses?
- Are there invalid grades?
- Are there invalid remarks?
- Are there invalid institutions?
- Check the database for invalid data.
- Audit result data.
- Check database consistency.

Return the invalid values and their counts.
`,

  validateResultsSchema,

  async (input) => {
    try {
      const result =
        await validateResults(input);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              result,
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error(
        "Result validation failed:",
        error
      );

      return {
        content: [
          {
            type: "text",
            text:
              "Failed to validate results.",
          },
        ],
        isError: true,
      };
    }
  }
);
const transport = new StdioServerTransport();

await server.connect(transport);