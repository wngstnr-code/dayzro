import { arc } from "viem/chains";

/*
 * Same-origin relay to Arc's public RPC. Some browsers (Brave Shields) and blockers drop requests to
 * rpc.*.arc.io, so the app reads through here instead. It holds no state and no keys: it forwards
 * read-only JSON-RPC calls and fails over across Arc's public endpoints. Writes never pass through
 * here; wallets send transactions through their own nodes.
 */

const UPSTREAMS = [...new Set([process.env.NEXT_PUBLIC_RPC_URL, ...arc.rpcUrls.default.http].filter(Boolean))] as string[];

const ALLOWED = new Set([
    "eth_call",
    "eth_chainId",
    "net_version",
    "eth_blockNumber",
    "eth_getBalance",
    "eth_getCode",
    "eth_getStorageAt",
    "eth_getTransactionCount",
    "eth_getTransactionByHash",
    "eth_getTransactionReceipt",
    "eth_getBlockByNumber",
    "eth_getBlockByHash",
    "eth_estimateGas",
    "eth_gasPrice",
    "eth_maxPriorityFeePerGas",
    "eth_feeHistory",
]);

const MAX_BODY = 256 * 1024;
const MAX_BATCH = 100;
const TIMEOUT_MS = 8_000;

type RpcRequest = { jsonrpc?: string; id?: unknown; method?: unknown };

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function POST(request: Request) {
    const text = await request.text();
    if (text.length > MAX_BODY) return json(rpcError(null, -32600, "Request too large"), 413);

    let payload: RpcRequest | RpcRequest[];
    try {
        payload = JSON.parse(text);
    } catch {
        return json(rpcError(null, -32700, "Parse error"), 400);
    }

    const calls = Array.isArray(payload) ? payload : [payload];
    if (calls.length === 0 || calls.length > MAX_BATCH) return json(rpcError(null, -32600, "Invalid batch"), 400);
    const blocked = calls.find((c) => typeof c.method !== "string" || !ALLOWED.has(c.method));
    if (blocked) return json(rpcError(blocked.id, -32601, `Method not allowed: ${String(blocked.method)}`), 400);

    // First upstream that answers with valid JSON wins; 5xx, 429, timeouts and network errors fall through.
    for (const url of UPSTREAMS) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: text,
                signal: AbortSignal.timeout(TIMEOUT_MS),
                cache: "no-store",
            });
            if (!res.ok) continue;
            const body = await res.text();
            JSON.parse(body);
            return new Response(body, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
        } catch {
            // try the next endpoint
        }
    }
    return json(rpcError(Array.isArray(payload) ? null : payload.id, -32603, "All Arc RPC endpoints are unavailable"), 502);
}
