import * as assert from "assert";
import { AlembicUtils } from "../utils/alembicUtils";

suite("VS Code Alembic Utils Tests", () => {
  test("should get short hash correctly", () => {
    const fullHash = "abcd1234567890ef";
    const shortHash = AlembicUtils.getShortHash(fullHash);
    assert.strictEqual(shortHash, "abcd1234");
  });

  test("should get custom length short hash", () => {
    const fullHash = "abcd1234567890ef";
    const shortHash = AlembicUtils.getShortHash(fullHash, 4);
    assert.strictEqual(shortHash, "abcd");
  });

  test("should validate hash correctly", () => {
    assert.strictEqual(AlembicUtils.isValidHash("abcd1234"), true);
    assert.strictEqual(AlembicUtils.isValidHash("abcd123"), false);
    assert.strictEqual(AlembicUtils.isValidHash("invalid_hash"), false);
    assert.strictEqual(AlembicUtils.isValidHash(""), false);
  });

  test("should format message correctly", () => {
    const longMessage =
      "This is a very long migration message that should be truncated at some point";
    const formatted = AlembicUtils.formatMessage(longMessage, 20);
    assert.strictEqual(formatted, "This is a very lo...");
  });

  test("should handle empty message", () => {
    const formatted = AlembicUtils.formatMessage("");
    assert.strictEqual(formatted, "No description");
  });

  test("should sanitize message for filename", () => {
    const message = "Add User Table & Relations!";
    const sanitized = AlembicUtils.sanitizeMessage(message);
    assert.strictEqual(sanitized, "add_user_table__relations");
  });
});
