import { spawn } from "node:child_process";
import { validateCommand, safePath } from "./security.js";
export function runCommand(root: string, command: string, timeoutMs = 120000) {
  validateCommand(command);
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const [bin, ...args] = command.trim().split(/\s+/);
      const p = spawn(bin, args, {
        cwd: safePath(root, "."),
        shell: false,
        windowsHide: true,
      });
      let stdout = "",
        stderr = "";
      const t = setTimeout(() => {
        p.kill();
        reject(new Error("Command timeout"));
      }, timeoutMs);
      p.stdout.on("data", (d) => (stdout += d));
      p.stderr.on("data", (d) => (stderr += d));
      p.on("error", reject);
      p.on("close", (code) => {
        clearTimeout(t);
        resolve({ code, stdout, stderr });
      });
    },
  );
}
