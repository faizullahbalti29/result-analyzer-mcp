import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerSchemaTool } from "./tools/schema.js";
import { registerQueryTool } from "./tools/query.js";

const server = new McpServer({
  name: "mongodb-readonly",
  version: "1.0.0",
});

registerSchemaTool(server);
registerQueryTool(server);

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server error:", error);
  process.exit(1);
});