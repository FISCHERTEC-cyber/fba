import test from "node:test";
import assert from "node:assert/strict";

test("INTENTIONAL NEGATIVE GATE – DO NOT MERGE", () => {
  assert.fail("Expected CI failure: verify required GitHub Actions check verify blocks merging.");
});
