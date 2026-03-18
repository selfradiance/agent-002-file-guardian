import { describe, it, expect } from "vitest";
import {
  registerAgent,
  postBond,
  executeBondedAction,
  resolveBond,
  generateKeypair,
} from "./bonds";

const UNREACHABLE_URL = "http://127.0.0.1:1";
const FAKE_KEY = "testkey";

// ---------------------------------------------------------------------------
// Unit tests — always run (no server needed)
// ---------------------------------------------------------------------------

describe("bonds — unit tests (no server)", () => {
  it("registerAgent throws on network error", async () => {
    const keys = generateKeypair();
    await expect(
      registerAgent(UNREACHABLE_URL, FAKE_KEY, keys),
    ).rejects.toThrow();
  });

  it("postBond throws on network error", async () => {
    const keys = generateKeypair();
    await expect(
      postBond(UNREACHABLE_URL, FAKE_KEY, keys, "fake-id", "/tmp/file.txt", "modify"),
    ).rejects.toThrow();
  });

  it("executeBondedAction throws on network error", async () => {
    const keys = generateKeypair();
    await expect(
      executeBondedAction(UNREACHABLE_URL, FAKE_KEY, keys, "fake-id", "fake-bond", "/tmp/file.txt", "modify"),
    ).rejects.toThrow();
  });

  it("resolveBond throws on network error", async () => {
    const keys = generateKeypair();
    await expect(
      resolveBond(UNREACHABLE_URL, FAKE_KEY, keys, "fake-action", true),
    ).rejects.toThrow();
  });

  it("generateKeypair returns valid key pair", () => {
    const keys = generateKeypair();
    expect(typeof keys.publicKey).toBe("string");
    expect(typeof keys.privateKey).toBe("string");
    expect(keys.publicKey.length).toBeGreaterThan(0);
    expect(keys.privateKey.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — only run when AGENTGATE_URL is set
// ---------------------------------------------------------------------------

const AGENTGATE_URL = process.env.AGENTGATE_URL;
const AGENTGATE_KEY = process.env.AGENTGATE_REST_KEY;

describe.skipIf(!AGENTGATE_URL || !AGENTGATE_KEY)(
  "bonds — integration tests (requires running AgentGate)",
  () => {
    it("full lifecycle: register → bond → execute → resolve (release)", async () => {
      const keys = generateKeypair();
      const identityId = await registerAgent(AGENTGATE_URL!, AGENTGATE_KEY!, keys);
      expect(typeof identityId).toBe("string");
      expect(identityId.startsWith("id_")).toBe(true);

      const bondId = await postBond(AGENTGATE_URL!, AGENTGATE_KEY!, keys, identityId, "/tmp/test.txt", "modify");
      expect(typeof bondId).toBe("string");
      expect(bondId.startsWith("bond_")).toBe(true);

      const actionId = await executeBondedAction(AGENTGATE_URL!, AGENTGATE_KEY!, keys, identityId, bondId, "/tmp/test.txt", "modify");
      expect(typeof actionId).toBe("string");
      expect(actionId.startsWith("action_")).toBe(true);

      await expect(resolveBond(AGENTGATE_URL!, AGENTGATE_KEY!, keys, actionId, true)).resolves.toBeUndefined();
    });

    it("full lifecycle: register → bond → execute → resolve (slash)", async () => {
      const keys = generateKeypair();
      const identityId = await registerAgent(AGENTGATE_URL!, AGENTGATE_KEY!, keys);
      const bondId = await postBond(AGENTGATE_URL!, AGENTGATE_KEY!, keys, identityId, "/tmp/test.txt", "delete");
      const actionId = await executeBondedAction(AGENTGATE_URL!, AGENTGATE_KEY!, keys, identityId, bondId, "/tmp/test.txt", "delete");

      await expect(resolveBond(AGENTGATE_URL!, AGENTGATE_KEY!, keys, actionId, false)).resolves.toBeUndefined();
    });

    it("postBond throws with invalid identityId", async () => {
      const keys = generateKeypair();
      await expect(
        postBond(AGENTGATE_URL!, AGENTGATE_KEY!, keys, "nonexistent-id", "/tmp/file.txt", "modify"),
      ).rejects.toThrow();
    });
  },
);
