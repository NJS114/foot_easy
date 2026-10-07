import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["scripts/dev-worker.mjs"], { stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)], {
    stdio: "inherit",
  }),
];
let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const child of children) child.once("exit", (code) => close(code || 0));
process.once("SIGINT", () => close());
process.once("SIGTERM", () => close());
