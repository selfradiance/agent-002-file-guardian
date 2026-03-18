import { createHash, createPrivateKey, generateKeyPairSync, randomUUID, sign } from "node:crypto";

// ---------------------------------------------------------------------------
// Ed25519 signing helpers (matches AgentGate's signing protocol)
// ---------------------------------------------------------------------------

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBase64(value: string): string {
  return Buffer.from(value, "base64url").toString("base64");
}

function buildSignedMessage(nonce: string, method: string, path: string, timestamp: string, body: unknown): Buffer {
  return createHash("sha256").update(`${nonce}${method}${path}${timestamp}${JSON.stringify(body)}`).digest();
}

function signRequest(
  publicKeyBase64: string,
  privateKeyBase64: string,
  nonce: string,
  method: string,
  path: string,
  timestamp: string,
  body: unknown,
): string {
  const publicKeyBytes = Buffer.from(publicKeyBase64, "base64");
  const privateKeyBytes = Buffer.from(privateKeyBase64, "base64");

  const privateKey = createPrivateKey({
    key: {
      kty: "OKP",
      crv: "Ed25519",
      x: toBase64Url(publicKeyBytes),
      d: toBase64Url(privateKeyBytes),
    },
    format: "jwk",
  });

  const signature = sign(null, buildSignedMessage(nonce, method, path, timestamp, body), privateKey);
  return signature.toString("base64");
}

// ---------------------------------------------------------------------------
// Keypair generation
// ---------------------------------------------------------------------------

export interface AgentKeys {
  publicKey: string;
  privateKey: string;
}

export function generateKeypair(): AgentKeys {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  const publicJwk = publicKey.export({ format: "jwk" });
  const privateJwk = privateKey.export({ format: "jwk" });

  if (!publicJwk.x || !privateJwk.d) {
    throw new Error("Failed to export Ed25519 keypair as JWK");
  }

  return {
    publicKey: base64UrlToBase64(publicJwk.x),
    privateKey: base64UrlToBase64(privateJwk.d),
  };
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 10_000; // 10 seconds

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json() as Record<string, unknown>;
  } catch {
    const text = await response.text().catch(() => "(empty)");
    return { error: "UNPARSEABLE_RESPONSE", message: text };
  }
}

async function signedPost(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: unknown,
  publicKey: string,
  privateKey: string,
): Promise<Record<string, unknown>> {
  const nonce = randomUUID();
  const timestamp = Date.now().toString();
  const signature = signRequest(publicKey, privateKey, nonce, "POST", path, timestamp, body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nonce": nonce,
        "x-agentgate-key": apiKey,
        "x-agentgate-timestamp": timestamp,
        "x-agentgate-signature": signature,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`AgentGate request timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new Error(`AgentGate ${path} failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function registerAgent(
  agentGateUrl: string,
  apiKey: string,
  keys: AgentKeys,
): Promise<string> {
  const data = await signedPost(
    agentGateUrl,
    apiKey,
    "/v1/identities",
    { publicKey: keys.publicKey },
    keys.publicKey,
    keys.privateKey,
  );

  const identityId = data.identityId;
  if (typeof identityId !== "string") {
    throw new Error(`No identityId returned: ${JSON.stringify(data)}`);
  }

  return identityId;
}

export async function postBond(
  agentGateUrl: string,
  apiKey: string,
  keys: AgentKeys,
  identityId: string,
  filePath: string,
  action: string,
): Promise<string> {
  const data = await signedPost(
    agentGateUrl,
    apiKey,
    "/v1/bonds/lock",
    {
      identityId,
      amountCents: 100,
      currency: "USD",
      ttlSeconds: 300,
      reason: `${action}: ${filePath}`,
    },
    keys.publicKey,
    keys.privateKey,
  );

  const bondId = data.bondId;
  if (typeof bondId !== "string") {
    throw new Error(`No bondId returned: ${JSON.stringify(data)}`);
  }

  return bondId;
}

export async function executeBondedAction(
  agentGateUrl: string,
  apiKey: string,
  keys: AgentKeys,
  identityId: string,
  bondId: string,
  filePath: string,
  action: string,
): Promise<string> {
  const data = await signedPost(
    agentGateUrl,
    apiKey,
    "/v1/actions/execute",
    {
      identityId,
      bondId,
      actionType: "file-guardian",
      payload: { filePath, action },
      exposure_cents: 80,
    },
    keys.publicKey,
    keys.privateKey,
  );

  const actionId = data.actionId;
  if (typeof actionId !== "string") {
    throw new Error(`No actionId returned: ${JSON.stringify(data)}`);
  }

  return actionId;
}

export async function resolveBond(
  agentGateUrl: string,
  apiKey: string,
  keys: AgentKeys,
  actionId: string,
  passed: boolean,
): Promise<void> {
  await signedPost(
    agentGateUrl,
    apiKey,
    `/v1/actions/${actionId}/resolve`,
    { outcome: passed ? "success" : "failed" },
    keys.publicKey,
    keys.privateKey,
  );
}
