#!/usr/bin/env node
// One-shot hot-patch: adds rpcWithRetry helper and rewrites /_internal/rpc handler
// in the deployed DeskRPG server.js so gateway restarts mid-RPC no longer bubble
// up as "네트워크 오류" in the NPC hire flow.
const fs = require("fs");
const path = process.argv[2];
if (!path) { console.error("usage: patch_deskrpg_rpc_retry.js <server.js>"); process.exit(1); }
let src = fs.readFileSync(path, "utf8");

if (src.includes("rpcWithRetry")) {
  console.log("already patched");
  process.exit(0);
}

const needleA = `  async function streamNpcResponse(socket, npcId, npcConfig, userId, message`;
const injectA = `  async function rpcWithRetry(channelId, method, params, maxAttempts = 3) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const gateway = await getOrConnectGateway(channelId);
      if (!gateway) {
        lastErr = Object.assign(new Error("Gateway not connected"), { __notConnected: true });
        if (attempt === maxAttempts) throw lastErr;
        await sleep(2000 + attempt * 1500);
        continue;
      }
      try {
        return await gateway._rpcRequest(method, params);
      } catch (err) {
        lastErr = err;
        const msg = String(err && err.message || "");
        const transient =
          msg === "Gateway not connected" ||
          msg.startsWith("RPC timeout") ||
          msg.includes("WebSocket is not open") ||
          msg.includes("closed before response");
        if (!transient || attempt === maxAttempts) throw err;
        console.warn(\`[gateway] RPC "\${method}" attempt \${attempt}/\${maxAttempts} failed (\${msg}); reconnecting + retrying\`);
        try { gateway.disconnect(); } catch {}
        channelGateways.delete(channelId);
        await sleep(2000 + attempt * 1500);
      }
    }
    throw lastErr;
  }

`;
if (!src.includes(needleA)) { console.error("anchor A not found"); process.exit(2); }
src = src.replace(needleA, injectA + needleA);

const needleB = `          const { channelId, method, params } = JSON.parse(body);
          const gateway = await getOrConnectGateway(channelId);
          if (!gateway) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Gateway not connected" }));
            return;
          }
          const result = await gateway._rpcRequest(method, params || {});`;
const replaceB = `          const { channelId, method, params } = JSON.parse(body);
          const result = await rpcWithRetry(channelId, method, params || {});`;
if (!src.includes(needleB)) { console.error("anchor B not found"); process.exit(3); }
src = src.replace(needleB, replaceB);

const needleC = `        } catch (err) {
          const status = getGatewayErrorStatus(err, 500);
          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(buildGatewayErrorPayload(err)));
        }
      });
      return;
    }

    // POST /_internal/emit`;
const replaceC = `        } catch (err) {
          if (err && err.__notConnected) {
            res.writeHead(503, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "Gateway not connected" }));
            return;
          }
          const status = getGatewayErrorStatus(err, 500);
          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify(buildGatewayErrorPayload(err)));
        }
      });
      return;
    }

    // POST /_internal/emit`;
if (!src.includes(needleC)) { console.error("anchor C not found"); process.exit(4); }
src = src.replace(needleC, replaceC);

fs.writeFileSync(path, src);
console.log("patched OK");
