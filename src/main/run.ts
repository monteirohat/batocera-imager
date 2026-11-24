// Runs a system command and returns its output, with a readable error.

import { execFile } from "node:child_process";

export function run(file: string, args: string[], options: { timeoutMs?: number; input?: string } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      file,
      args,
      { timeout: options.timeoutMs ?? 30_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, encoding: "utf8" },
      (err, stdout, stderr) => {
        if (err) {
          const detail = (stderr || stdout || "").trim().split("\n").slice(-3).join(" ");
          reject(new Error(`${file.split(/[\\/]/).pop()} failed${detail ? `: ${detail}` : `: ${err.message}`}`));
        } else {
          resolve(stdout);
        }
      },
    );
    if (options.input !== undefined) child.stdin?.end(options.input);
  });
}
