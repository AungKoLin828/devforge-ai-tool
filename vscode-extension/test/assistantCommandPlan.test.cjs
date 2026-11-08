const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isPackageInstallCommand,
  parseAssistantCommandPlan,
} = require("../out/commands/assistantCommandPlan.js");

test("parses an allowed command plan from a JSON code fence", () => {
  const plan = parseAssistantCommandPlan(
    '```json\n{"message":"Run the build","commands":[{"executable":"npm","args":["run","build"],"reason":"Verify the project"}]}\n```',
  );

  assert.deepEqual(plan, {
    message: "Run the build",
    commands: [
      {
        executable: "npm",
        args: ["run", "build"],
        reason: "Verify the project",
      },
    ],
  });
});

test("ignores replies that are not command plans", () => {
  assert.equal(parseAssistantCommandPlan("Here is an explanation."), undefined);
  assert.equal(parseAssistantCommandPlan('{"message":"Done"}'), undefined);
});

test("rejects commands outside the allowlist", () => {
  assert.throws(
    () =>
      parseAssistantCommandPlan(
        '{"commands":[{"executable":"cmd","args":["/c","whoami"],"reason":"Inspect"}]}',
      ),
    /requested command is not allowed/i,
  );
});

test("rejects malformed or oversized command plans", () => {
  assert.throws(
    () => parseAssistantCommandPlan('{"commands":[{"executable":"npm"}]}'),
    /invalid local command request/i,
  );

  const commands = Array.from({ length: 4 }, () => ({
    executable: "npm",
    args: ["run", "build"],
    reason: "Build",
  }));
  assert.throws(
    () => parseAssistantCommandPlan(JSON.stringify({ commands })),
    /invalid local command request/i,
  );
});

test("identifies package installation commands", () => {
  assert.equal(
    isPackageInstallCommand({
      executable: "npm",
      args: ["install", "typescript"],
      reason: "Add TypeScript",
    }),
    true,
  );
  assert.equal(
    isPackageInstallCommand({
      executable: "git",
      args: ["status"],
      reason: "Check changes",
    }),
    false,
  );
});
