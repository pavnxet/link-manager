#!/usr/bin/env node
const base = process.env.WORKER_URL;
const secret = process.env.WEBHOOK_SECRET;
if (!base || !secret) {
  console.error("Set WORKER_URL and WEBHOOK_SECRET env vars.");
  process.exit(1);
}
const res = await fetch(`${base.replace(/\/$/, "")}/teardown?secret=${encodeURIComponent(secret)}`);
console.log(res.status, await res.text());
