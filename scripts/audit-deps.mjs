#!/usr/bin/env node
// Fails on known CVEs in production deps. Network failures only warn (offline commits stay possible).
import { spawnSync } from "node:child_process";

const level = process.env.AUDIT_LEVEL ?? "high";
const r = spawnSync("npm", ["audit", "--omit=dev", `--audit-level=${level}`], { encoding: "utf8" });
const out = `${r.stdout}${r.stderr}`;
if (r.status === 0) {
  console.log(`✔ npm audit: no ${level}+ vulnerabilities`);
} else if (
  /ENOTFOUND|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|audit endpoint returned an error/i.test(out)
) {
  console.warn("⚠ npm audit skipped: registry unreachable");
} else {
  console.error(out);
  console.error(
    `✖ Vulnerable dependencies (${level}+). Run \`npm audit fix\`; override with AUDIT_LEVEL=critical.`,
  );
  process.exit(1);
}
