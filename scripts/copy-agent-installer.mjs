import { copyFile, mkdir } from "node:fs/promises";

const source = new URL("../agent/install.ps1", import.meta.url);
const target = new URL("../frontend/public/downloads/", import.meta.url);

await mkdir(target, { recursive: true });
await copyFile(
  source,
  new URL("install-codevia-agent.ps1", target),
);
