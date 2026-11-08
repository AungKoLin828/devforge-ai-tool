export type LocalCommandRequest = {
  executable: string;
  args: string[];
  reason: string;
};

type AssistantCommandPlan = {
  message: string;
  commands: LocalCommandRequest[];
};

export function parseAssistantCommandPlan(
  reply: string,
): AssistantCommandPlan | undefined {
  const cleaned = reply
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object" || !("commands" in parsed))
    return undefined;

  const candidate = parsed as {
    commands?: unknown;
    message?: unknown;
  };
  if (
    !Array.isArray(candidate.commands) ||
    candidate.commands.length === 0 ||
    candidate.commands.length > 3
  ) {
    throw new Error("The AI returned an invalid local command request.");
  }
  const commands = candidate.commands.map((item): LocalCommandRequest => {
    if (!item || typeof item !== "object")
      throw new Error("The AI returned an invalid local command request.");
    const command = item as Record<string, unknown>;
    if (
      typeof command.executable !== "string" ||
      !Array.isArray(command.args) ||
      !command.args.every((arg) => typeof arg === "string") ||
      typeof command.reason !== "string"
    ) {
      throw new Error("The AI returned an invalid local command request.");
    }
    const executable = command.executable.toLowerCase();
    const args = command.args as string[];
    if (!isAllowedLocalCommand(executable, args)) {
      throw new Error(
        `The requested command is not allowed: ${[executable, ...args].join(" ")}`,
      );
    }
    return {
      executable,
      args,
      reason: command.reason.slice(0, 300),
    };
  });
  return {
    message:
      typeof candidate.message === "string"
        ? candidate.message.slice(0, 2000)
        : "",
    commands,
  };
}

function isAllowedLocalCommand(executable: string, args: string[]): boolean {
  const command = args.join("\0");
  if (executable === "winget") {
    return (
      process.platform === "win32" &&
      command === "install\0--id\0OpenJS.NodeJS.LTS\0--exact"
    );
  }
  if (["npm", "pnpm", "yarn", "bun"].includes(executable)) {
    if (
      new Set([
        "install",
        "ci",
        "run\0build",
        "run\0test",
        "run\0lint",
        "run\0typecheck",
        "run\0check",
      ]).has(command)
    ) {
      return true;
    }
    return (
      (executable === "npm" &&
        args[0] === "install" &&
        isPackageList(args.slice(1), isNpmPackageSpec)) ||
      (args[0] === "add" &&
        isPackageList(args.slice(1), isNpmPackageSpec))
    );
  }
  if (["py", "python", "python3"].includes(executable)) {
    if (args[0] === "-m" && args[1] === "pip" && args[2] === "install") {
      return (
        isPackageList(args.slice(3), isPythonPackageSpec) ||
        command === "-m\0pip\0install\0-r\0requirements.txt"
      );
    }
    return args[0] === "-m" && args[1] === "pytest" && args.length === 2;
  }
  if (executable === "pip" || executable === "pip3") {
    return args[0] === "install" && (
      isPackageList(args.slice(1), isPythonPackageSpec) ||
      command === "install\0-r\0requirements.txt"
    );
  }
  if (executable === "cargo") {
    return (
      command === "fetch" ||
      (args[0] === "add" &&
        isPackageList(args.slice(1), isCargoPackageSpec))
    );
  }
  if (executable === "go") {
    return (
      command === "mod\0download" ||
      (args[0] === "get" &&
        isPackageList(args.slice(1), isGoPackageSpec))
    );
  }
  if (executable === "dotnet") {
    return (
      command === "restore" ||
      (args[0] === "add" &&
        args[1] === "package" &&
        args.length === 3 &&
        isDotnetPackageSpec(args[2]))
    );
  }
  if (executable === "composer") {
    return (
      command === "install" ||
      (args[0] === "require" &&
        isPackageList(args.slice(1), isComposerPackageSpec))
    );
  }
  if (executable === "bundle") return command === "install";
  if (executable === "gem") {
    return (
      args[0] === "install" &&
      isPackageList(args.slice(1), isRubyPackageSpec)
    );
  }
  if (executable === "git") {
    return new Set([
      "status",
      "status\0--short",
      "diff\0--stat",
      "diff\0--check",
      "log\0-5\0--oneline",
    ]).has(command);
  }
  return false;
}

function isPackageList(
  packages: string[],
  isValidPackage: (name: string) => boolean,
): boolean {
  return packages.length > 0 && packages.length <= 5 &&
    packages.every(isValidPackage);
}

function isNpmPackageSpec(name: string): boolean {
  return /^(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*(?:@[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(
    name,
  );
}

function isPythonPackageSpec(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9,_-]+\])?(?:==[A-Za-z0-9.*+_-]+)?$/.test(
    name,
  );
}

function isCargoPackageSpec(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*(?:@[A-Za-z0-9.~-]+)?$/.test(name);
}

function isGoPackageSpec(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._/-]*(?:@[A-Za-z0-9._+-]+)?$/.test(name) &&
    !name.includes("..");
}

function isDotnetPackageSpec(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name);
}

function isComposerPackageSpec(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?:@[A-Za-z0-9.~-]+)?$/.test(
    name,
  );
}

function isRubyPackageSpec(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name);
}

export function isPackageInstallCommand(command: LocalCommandRequest): boolean {
  const { executable, args } = command;
  return (
    ["npm", "pnpm", "yarn", "bun"].includes(executable) &&
      ["install", "add"].includes(args[0]) ||
    ["py", "python", "python3"].includes(executable) &&
      args[0] === "-m" && args[1] === "pip" && args[2] === "install" ||
    ["pip", "pip3"].includes(executable) && args[0] === "install" ||
    executable === "cargo" &&
      (args[0] === "add" || args[0] === "fetch") ||
    executable === "go" &&
      (args[0] === "get" || args[0] === "mod" && args[1] === "download") ||
    executable === "dotnet" &&
      (args[0] === "add" || args[0] === "restore") ||
    executable === "composer" &&
      (args[0] === "require" || args[0] === "install") ||
    (executable === "gem" && args[0] === "install") ||
    (executable === "bundle" && args[0] === "install")
  );
}
