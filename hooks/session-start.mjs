#!/usr/bin/env node
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, '..');

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const event = JSON.parse(input);
  const { notify } = await import(resolve(PLUGIN_ROOT, 'scripts/notify.mjs'));
  await notify('session.start', { sessionId: event.session_id, hookEvent: event.hook_event_name });
}
main().catch(() => process.exit(0));
