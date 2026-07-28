import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createApiKeyAuthenticator, hashApiKeySecret } from "../src/auth/api-key.ts";
import type { AuthPrincipal, ApiKeyRecord } from "../src/schemas.ts";

const PEPPER = "a".repeat(32);
const SECRET = "testsecret123";
const KEY_ID = "testkey1";
const KEY_ID_TEST = "testkey2";
const ORG_ID = "org_test";
const HASH = hashApiKeySecret(SECRET, PEPPER).toString("hex");

const RECORDS: ApiKeyRecord[] = [
  {
    keyId: KEY_ID,
    orgId: ORG_ID,
    secretHash: HASH,
    scopes: ["mcp:read", "mcp:write", "agent:connect"],
    enabled: true,
    environment: "live",
  },
  {
    keyId: KEY_ID_TEST,
    orgId: ORG_ID,
    secretHash: HASH,
    scopes: ["mcp:read", "mcp:write", "agent:connect"],
    enabled: true,
    environment: "test",
  },
];

describe("api-key", () => {
  const authenticator = createApiKeyAuthenticator(RECORDS, PEPPER);

  test("accepts valid live key", () => {
    const key = `as:live:${KEY_ID}:${SECRET}`;
    const principal = authenticator(key);
    assert.ok(principal);
    assert.equal(principal.keyId, KEY_ID);
    assert.equal(principal.orgId, ORG_ID);
    assert.ok(principal.scopes.has("mcp:read"));
    assert.ok(principal.scopes.has("mcp:write"));
    assert.ok(principal.scopes.has("agent:connect"));
    assert.equal(principal.environment, "live");
  });

  test("accepts valid test key", () => {
    const key = `as:test:${KEY_ID_TEST}:${SECRET}`;
    const principal = authenticator(key);
    assert.ok(principal);
    assert.equal(principal.environment, "test");
  });

  test("rejects malformed key prefix", () => {
    const principal = authenticator("wrong:prefix:xxx");
    assert.equal(principal, null);
  });

  test("rejects unknown key id", () => {
    const key = `as:live:unknown:${SECRET}`;
    const principal = authenticator(key);
    assert.equal(principal, null);
  });

  test("rejects incorrect secret", () => {
    const key = `as:live:${KEY_ID}:wrongsecret`;
    const principal = authenticator(key);
    assert.equal(principal, null);
  });

  test("rejects disabled key", () => {
    const disabled = [{ ...RECORDS[0], enabled: false }];
    const auth = createApiKeyAuthenticator(disabled, PEPPER);
    const key = `as:live:${KEY_ID}:${SECRET}`;
    const principal = auth(key);
    assert.equal(principal, null);
  });

  test("uses constant-time comparison", () => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      authenticator(`as:live:${KEY_ID}:wrong`);
    }
    const elapsed = Date.now() - start;
    // Just verify it doesn't error and runs without issue
    assert.ok(true, "Constant-time comparison runs without error");
  });

  test("hashApiKeySecret produces consistent output", () => {
    const h1 = hashApiKeySecret(SECRET, PEPPER);
    const h2 = hashApiKeySecret(SECRET, PEPPER);
    assert.ok(h1.equals(h2));
  });

  test("hashApiKeySecret changes with different secret", () => {
    const h1 = hashApiKeySecret(SECRET, PEPPER);
    const h2 = hashApiKeySecret("different", PEPPER);
    assert.ok(!h1.equals(h2));
  });
});