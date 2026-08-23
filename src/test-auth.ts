import "dotenv/config";

const BASE_URL = process.env.MCP_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
const AUTH0_DOMAIN = (process.env.AUTH0_DOMAIN ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const AUDIENCE = process.env.AUTH0_AUDIENCE;

async function runTests() {
  console.log(`\n🧪 Testing MCP Auth0 Integration on ${BASE_URL} ...\n`);

  let allPassed = true;

  // 1. Test Health Check
  try {
    console.log(`1. Testing /health endpoint...`);
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, data);
    if (res.status === 200 && data.status === "ok") {
      console.log(`   ✅ Health check passed\n`);
    } else {
      console.log(`   ❌ Health check failed\n`);
      allPassed = false;
    }
  } catch (err: any) {
    console.error(`   ❌ Failed to connect to server: ${err.message}\n`);
    allPassed = false;
  }

  // 2. Test RFC 9728 Protected Resource Metadata
  try {
    console.log(`2. Testing RFC 9728 /.well-known/oauth-protected-resource endpoint...`);
    const res = await fetch(`${BASE_URL}/.well-known/oauth-protected-resource`);
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Response:`, JSON.stringify(data, null, 2));
    if (
      res.status === 200 &&
      data.resource &&
      Array.isArray(data.authorization_servers) &&
      data.authorization_servers.length > 0
    ) {
      console.log(`   ✅ RFC 9728 discovery passed\n`);
    } else {
      console.log(`   ❌ RFC 9728 discovery failed\n`);
      allPassed = false;
    }
  } catch (err: any) {
    console.error(`   ❌ Failed RFC 9728 discovery: ${err.message}\n`);
    allPassed = false;
  }

  // 3. Test OAuth Authorization Server Metadata
  try {
    console.log(`3. Testing /.well-known/oauth-authorization-server endpoint...`);
    const res = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`);
    const data = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   Issuer:`, data.issuer);
    console.log(`   Authorization Endpoint:`, data.authorization_endpoint);
    console.log(`   Token Endpoint:`, data.token_endpoint);
    if (res.status === 200 && data.issuer && data.authorization_endpoint) {
      console.log(`   ✅ Authorization server discovery passed\n`);
    } else {
      console.log(`   ❌ Authorization server discovery failed\n`);
      allPassed = false;
    }
  } catch (err: any) {
    console.error(`   ❌ Failed Auth Server discovery: ${err.message}\n`);
    allPassed = false;
  }

  // 4. Test CORS Preflight
  try {
    console.log(`4. Testing CORS preflight OPTIONS /mcp ...`);
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: "OPTIONS",
      headers: {
        "Origin": "https://claude.ai",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type, mcp-session-id",
      },
    });
    console.log(`   Status: ${res.status}`);
    console.log(`   Access-Control-Allow-Origin:`, res.headers.get("access-control-allow-origin"));
    console.log(`   Access-Control-Expose-Headers:`, res.headers.get("access-control-expose-headers"));
    if (res.status === 204 && res.headers.get("access-control-allow-origin") === "*") {
      console.log(`   ✅ CORS preflight passed\n`);
    } else {
      console.log(`   ❌ CORS preflight failed\n`);
      allPassed = false;
    }
  } catch (err: any) {
    console.error(`   ❌ Failed CORS test: ${err.message}\n`);
    allPassed = false;
  }

  // 5. Test Unauthenticated Request (expect 401 with WWW-Authenticate header)
  try {
    console.log(`5. Testing Unauthenticated POST /mcp (expecting 401 + WWW-Authenticate header)...`);
    const res = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      }),
    });
    const wwwAuth = res.headers.get("www-authenticate");
    const body = await res.json();
    console.log(`   Status: ${res.status}`);
    console.log(`   WWW-Authenticate: ${wwwAuth}`);
    console.log(`   Body:`, body);
    if (res.status === 401 && wwwAuth && wwwAuth.includes("resource_metadata")) {
      console.log(`   ✅ Unauthenticated request correctly rejected with RFC 9728 WWW-Authenticate header\n`);
    } else {
      console.log(`   ❌ 401 / WWW-Authenticate header test failed\n`);
      allPassed = false;
    }
  } catch (err: any) {
    console.error(`   ❌ Failed unauthenticated test: ${err.message}\n`);
    allPassed = false;
  }

  // 6. Test Token Generation with Client Credentials (if Client ID & Secret present)
  if (CLIENT_ID && CLIENT_SECRET && AUTH0_DOMAIN) {
    try {
      console.log(`6. Testing Auth0 Token retrieval via Client Credentials & MCP request...`);
      const tokenRes = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          audience: AUDIENCE,
          grant_type: "client_credentials",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenRes.ok && tokenData.access_token) {
        console.log(`   Obtained Auth0 token (type: ${tokenData.token_type})`);

        // Send authenticated initialize request
        const authRes = await fetch(`${BASE_URL}/mcp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": `Bearer ${tokenData.access_token}`,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: {},
              clientInfo: { name: "test-client", version: "1.0.0" },
            },
            id: 1,
          }),
        });

        console.log(`   Authenticated POST /mcp status: ${authRes.status}`);
        const text = await authRes.text();
        console.log(`   MCP Stream Response Preview:`, text.slice(0, 120) + "...");

        if (authRes.status === 200 && (text.includes("endpoint") || text.includes("jsonrpc") || text.includes("event: message"))) {
          console.log(`   ✅ Authenticated MCP session initialized successfully!\n`);
        } else {
          console.log(`   ⚠️ Authenticated request response status: ${authRes.status}\n`);
        }
      } else {
        console.log(`   ℹ️ Auth0 Client Credentials token exchange response:`, tokenData);
        console.log(`   (Note: For Authorization Code grant with Claude, Claude handles user login via browser)\n`);
      }
    } catch (err: any) {
      console.warn(`   Auth0 token check note: ${err.message}\n`);
    }
  }

  console.log(allPassed ? `🎉 ALL CORE MCP AUTH CHECKS PASSED!` : `⚠️ SOME CHECKS FAILED.`);
}

runTests().catch(console.error);
