#!/usr/bin/env node
// Usage: node scripts/hash-password.mjs "my password"
import { createHash } from "node:crypto";
const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node scripts/hash-password.mjs "<password>"');
  process.exit(1);
}
console.log(createHash("sha256").update(pw).digest("hex"));
