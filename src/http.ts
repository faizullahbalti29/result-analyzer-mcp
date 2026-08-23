import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  StreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";

import { registerSchemaTool } from "./tools/schema.js";
import { registerQueryTool } from "./tools/query.js";
import { validateAccessToken, getPublicUrl, isOAuthEnabled } from "./middleware/middleware.js";

type McpRequest = Parameters<
  StreamableHTTPServerTransport["handleRequest"]
>[0];

const app = express();

// -----------------------------------------
// Global CORS Middleware
// -----------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, DELETE, OPTIONS, HEAD"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, mcp-session-id, Accept, Origin, X-Requested-With"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "WWW-Authenticate, mcp-session-id"
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.json());

const PORT = Number(process.env.PORT ?? 3000);
const auth0Domain = (process.env.AUTH0_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");

// Store active MCP transports by session ID
const transports: Record<string, StreamableHTTPServerTransport> = {};

function createServer() {
  const server = new McpServer({
    name: "mongodb-readonly",
    version: "1.0.0",
  });

  registerSchemaTool(server);
  registerQueryTool(server);

  return server;
}

// -----------------------------------------------------------
// RFC 9728 Protected Resource Metadata endpoints
// -----------------------------------------------------------
function getProtectedResourceMetadata(req: Request) {
  const publicUrl = getPublicUrl(req);
  const resourceIdentifier = process.env.AUTH0_AUDIENCE || `${publicUrl}/mcp`;
  return {
    resource: resourceIdentifier,
    authorization_servers: [
      `https://${auth0Domain}`,
      `https://${auth0Domain}/`,
    ],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
    bearer_methods_supported: ["header"],
    resource_documentation: publicUrl,
  };
}

app.get("/.well-known/oauth-protected-resource", (req, res) => {
  res.json(getProtectedResourceMetadata(req));
});

app.get("/.well-known/oauth-protected-resource/mcp", (req, res) => {
  res.json(getProtectedResourceMetadata(req));
});

// -----------------------------------------------------------
// RFC 8414 Authorization Server Metadata Proxies (for Auth0)
// -----------------------------------------------------------
app.get("/.well-known/oauth-authorization-server", async (_req, res) => {
  try {
    const auth0Url = `https://${auth0Domain}/.well-known/oauth-authorization-server`;
    const response = await fetch(auth0Url);

    if (response.ok) {
      const metadata = await response.json();
      return res.json(metadata);
    }

    // Fallback to openid-configuration if oauth-authorization-server is not returned
    const fallbackResponse = await fetch(`https://${auth0Domain}/.well-known/openid-configuration`);
    if (fallbackResponse.ok) {
      const metadata = await fallbackResponse.json();
      return res.json(metadata);
    }

    res.status(response.status).json({ error: "Unable to fetch Auth0 OAuth metadata" });
  } catch (error) {
    console.error("OAuth metadata error:", error);
    res.status(500).json({ error: "server_error", error_description: "Unable to retrieve OAuth metadata" });
  }
});

app.get("/.well-known/openid-configuration", async (_req, res) => {
  try {
    const response = await fetch(`https://${auth0Domain}/.well-known/openid-configuration`);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Unable to fetch Auth0 OpenID metadata" });
    }
    const metadata = await response.json();
    res.json(metadata);
  } catch (error) {
    console.error("OpenID configuration error:", error);
    res.status(500).json({ error: "server_error", error_description: "Unable to retrieve OpenID configuration" });
  }
});

// -----------------------------------------
// POST /mcp (MCP JSON-RPC handler)
// -----------------------------------------
const handleMcpPost = async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    // -----------------------------------------
    // Existing MCP session
    // -----------------------------------------
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
      await transport.handleRequest(req as McpRequest, res, req.body);
      return;
    }

    // -----------------------------------------
    // New MCP session initialization
    // -----------------------------------------
    if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          console.log(`[MCP] Session initialized: ${newSessionId}`);
          transports[newSessionId] = transport;
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          console.log(`[MCP] Session closed: ${transport.sessionId}`);
          delete transports[transport.sessionId];
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req as McpRequest, res, req.body);
      return;
    }

    // -----------------------------------------
    // Invalid request
    // -----------------------------------------
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session ID provided",
      },
      id: null,
    });
  } catch (error) {
    console.error("MCP HTTP error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
};

// -----------------------------------------
// GET /mcp (SSE / stream handler)
// -----------------------------------------
const handleMcpGet = async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req as McpRequest, res);
  } catch (error) {
    console.error("MCP GET error:", error);

    if (!res.headersSent) {
      res.status(500).send("MCP GET error");
    }
  }
};

// -----------------------------------------
// DELETE /mcp (Session termination handler)
// -----------------------------------------
const handleMcpDelete = async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req as McpRequest, res);
  } catch (error) {
    console.error("MCP DELETE error:", error);

    if (!res.headersSent) {
      res.status(500).send("MCP DELETE error");
    }
  }
};

// Register Protected MCP endpoints
app.post("/mcp", validateAccessToken, handleMcpPost);
app.get("/mcp", validateAccessToken, handleMcpGet);
app.delete("/mcp", validateAccessToken, handleMcpDelete);

// Register aliases for root "/" if client connects directly to root
app.post("/", validateAccessToken, handleMcpPost);
app.get("/", (req, res, next) => {
  if (req.headers["mcp-session-id"]) {
    return validateAccessToken(req, res, () => handleMcpGet(req, res));
  }
  // Otherwise show service info
  res.json({
    name: "mongodb-readonly MCP Server",
    status: "online",
    oauth_discovery: `${getPublicUrl(req)}/.well-known/oauth-protected-resource`,
    mcp_endpoint: `${getPublicUrl(req)}/mcp`,
  });
});

// -----------------------------------------
// Health check (Public)
// -----------------------------------------
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "mongodb-readonly",
    auth: {
      enabled: isOAuthEnabled,
      provider: isOAuthEnabled ? "auth0" : "none",
      domain: isOAuthEnabled ? auth0Domain : undefined,
      audience: isOAuthEnabled ? process.env.AUTH0_AUDIENCE : undefined,
    },
  });
});

// -----------------------------------------
// Start server
// -----------------------------------------
app.listen(PORT, () => {
  const publicUrl = process.env.MCP_PUBLIC_URL || `http://localhost:${PORT}`;
  console.log(`=======================================================`);
  console.log(`  🚀 MCP Server running on port ${PORT}`);
  console.log(`  🔗 Local URL:     http://localhost:${PORT}`);
  console.log(`  🌐 Public URL:    ${publicUrl}`);
  console.log(`  🛡️ OAuth Status:  ${isOAuthEnabled ? "ENABLED (1)" : "DISABLED (0)"}`);
  if (isOAuthEnabled) {
    console.log(`  🛡️ Auth0 Domain:  ${auth0Domain}`);
    console.log(`  🎯 Audience:      ${process.env.AUTH0_AUDIENCE}`);
    console.log(`  📋 PRM Metadata:  ${publicUrl}/.well-known/oauth-protected-resource`);
  }
  console.log(`  📍 MCP Endpoint:  ${publicUrl}/mcp`);
  console.log(`=======================================================`);
});