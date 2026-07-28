import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.ts";
const VALID_PEPPER = "a".repeat(32);
const VALID_API_KEYS = JSON.stringify([{
        keyId: "test_key_1",
        orgId: "org_test",
        secretHash: "b".repeat(64),
        scopes: ["mcp:read", "mcp:write"],
        enabled: true,
        expiresAt: "2030-01-01T00:00:00.000Z",
        environment: "test"
    }]);
function baseEnv(overrides = {}) {
    return {
        RELAY_HOST: "127.0.0.1",
        RELAY_PORT: "8080",
        RELAY_PUBLIC_URL: "http://localhost:8080",
        RELAY_ENV: "test",
        RELAY_API_KEY_PEPPER: VALID_PEPPER,
        RELAY_API_KEYS_JSON: VALID_API_KEYS,
        ...overrides,
    };
}
describe("loadConfig", () => {
    let originalEnv;
    beforeEach(() => {
        originalEnv = { ...process.env };
    });
    afterEach(() => {
        process.env = originalEnv;
    });
    test("applies every documented default", () => {
        process.env = baseEnv();
        const cfg = loadConfig();
        assert.equal(cfg.host, "127.0.0.1");
        assert.equal(cfg.port, 8080);
        assert.equal(cfg.env, "test");
        assert.equal(cfg.toolTimeoutMs, 120000);
        assert.equal(cfg.registerTimeoutMs, 5000);
        assert.equal(cfg.heartbeatIntervalMs, 30000);
        assert.equal(cfg.agentStaleMs, 90000);
        assert.equal(cfg.maxBodyBytes, 262144);
        assert.equal(cfg.maxWsMessageBytes, 262144);
        assert.equal(cfg.maxInflightPerAgent, 16);
        assert.equal(cfg.maxInflightPerOrg, 64);
        assert.equal(cfg.rateLimitPerMinute, 120);
        assert.equal(cfg.shutdownGraceMs, 10000);
        assert.equal(cfg.logLevel, "info");
        assert.equal(cfg.trustProxy, false);
    });
    test("rejects missing key pepper", () => {
        process.env = baseEnv({ RELAY_API_KEY_PEPPER: undefined });
        assert.throws(() => loadConfig(), /apiKeyPepper/);
    });
    test("rejects missing api keys json", () => {
        process.env = baseEnv({ RELAY_API_KEYS_JSON: undefined });
        assert.throws(() => loadConfig(), /apiKeysJson/);
    });
    test("rejects plaintext api key records", () => {
        const plaintext = JSON.stringify([{
                keyId: "test",
                orgId: "org_test",
                secretHash: "not_a_hash",
                scopes: ["mcp:read"],
                enabled: true,
            }]);
        process.env = baseEnv({ RELAY_API_KEYS_JSON: plaintext });
        assert.throws(() => loadConfig(), /secretHash/);
    });
    test("rejects duplicate keyId values", () => {
        const dupes = JSON.stringify([
            { keyId: "same", orgId: "org_1", secretHash: "x".repeat(64), scopes: ["mcp:read"], enabled: true },
            { keyId: "same", orgId: "org_2", secretHash: "y".repeat(64), scopes: ["mcp:read"], enabled: true },
        ]);
        process.env = baseEnv({ RELAY_API_KEYS_JSON: dupes });
        assert.throws(() => loadConfig(), /Duplicate keyId/);
    });
    test("rejects stale timeout less than two heartbeat intervals", () => {
        process.env = baseEnv({
            RELAY_HEARTBEAT_INTERVAL_MS: "30000",
            RELAY_AGENT_STALE_MS: "50000",
        });
        assert.throws(() => loadConfig(), /RELAY_AGENT_STALE_MS must be greater than 2/);
    });
    test("rejects production public URL using HTTP", () => {
        process.env = baseEnv({
            RELAY_ENV: "production",
            RELAY_PUBLIC_URL: "http://example.com",
        });
        assert.throws(() => loadConfig(), /must use HTTPS in production/);
    });
    test("does not include secret values in validation errors", () => {
        process.env = baseEnv({ RELAY_API_KEY_PEPPER: "short" });
        try {
            loadConfig();
            assert.fail("should have thrown");
        }
        catch (e) {
            assert.ok(!e.message.includes("short"));
            assert.ok(!e.message.includes(VALID_PEPPER));
        }
    });
    test("accepts valid test configuration", () => {
        process.env = baseEnv();
        const cfg = loadConfig();
        assert.ok(cfg.apiKeyPepper);
        assert.ok(cfg.apiKeysJson);
        assert.equal(cfg.env, "test");
    });
});
//# sourceMappingURL=config.test.js.map