#!/usr/bin/env node
// Scans for PII (emails, phones, SSNs, cards). Credentials are covered by secretlint/gitleaks. Modes:
//   (default)  staged additions       -> pre-commit
//   --head     the commit at HEAD     -> post-commit (also checks author/message)
import { execFileSync } from "node:child_process";

const ALLOWED_EMAIL_DOMAINS = [
  "example.com",
  "example.org",
  "inkframe.studio",
  "users.noreply.github.com",
];
const ALLOWED_EMAILS = ["noreply@anthropic.com"];
const SKIP_PATHS = /(^|\/)(package-lock\.json|.*\.(png|jpe?g|webp|gif|ico|pdf|woff2?))$/i;

const RULES = [
  {
    name: "phone number",
    re: /(?<![\w.])(?:\+?\d{1,3}[\s.-])?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?![\w.])/,
  },
  { name: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/ },
  {
    name: "credit card number",
    re: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6011)(?:[ -]?\d{4}){2,3}\b/,
  },
];
const EMAIL_RE = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const headMode = process.argv.includes("--head");
const findings = [];

function scanLine(file, lineNo, line) {
  if (line.length > 2000 || /pii-ignore/.test(line)) return;
  for (const { name, re } of RULES) if (re.test(line)) findings.push({ file, lineNo, name });
  for (const m of line.matchAll(EMAIL_RE)) {
    const email = m[0].toLowerCase();
    const domain = m[1].toLowerCase();
    if (ALLOWED_EMAILS.includes(email)) continue;
    if (ALLOWED_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) continue;
    if (/\.(png|jpe?g|webp|svg|gif|css|js|ts|json)$/.test(domain)) continue; // e.g. logo@2x.png
    findings.push({ file, lineNo, name: `email address (${email})` });
  }
}

const diff = headMode
  ? git("show", "--format=", "--unified=0", "HEAD")
  : git("diff", "--cached", "--unified=0", "--diff-filter=ACMR");

let file = null;
let lineNo = 0;
for (const line of diff.split("\n")) {
  if (line.startsWith("+++ ")) {
    file = line.slice(6);
    if (line === "+++ /dev/null" || SKIP_PATHS.test(file)) file = null;
  } else if (line.startsWith("@@")) {
    lineNo = Number(/\+(\d+)/.exec(line)?.[1] ?? 0) - 1;
  } else if (line.startsWith("+") && file) {
    lineNo++;
    scanLine(file, lineNo, line.slice(1));
  }
}

if (headMode) {
  const meta = git("show", "-s", "--format=%ae%n%ce%n%B", "HEAD").split("\n");
  meta.forEach((l, i) => scanLine(i < 2 ? "commit author/committer" : "commit message", i + 1, l));
}

if (findings.length) {
  console.error(`\n✖ Possible PII detected${headMode ? " in the commit just created" : ""}:`);
  for (const f of findings) console.error(`  ${f.file}:${f.lineNo}  ${f.name}`);
  console.error(
    headMode
      ? "\nFix with `git commit --amend` (or `git reset --soft HEAD~1`) before pushing.\n"
      : "\nRemove it, or append `pii-ignore` on that line if it's a false positive.\n",
  );
  process.exit(1);
}
console.log(headMode ? "✔ post-commit PII check passed" : "✔ PII check passed");
