import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const check = (url, preview = 'false', target = 'production') => spawnSync(process.execPath, ['scripts/check-vercel.js'], { env: { ...process.env, VITE_API_URL: url, VITE_PREVIEW_ONLY: preview, VERCEL_ENV: target }, encoding: 'utf8' }).status;
test('Vercel accepts Supabase function URLs and rejects unsafe or unsupported URLs', () => {
  for (const url of ['https://example.com', 'https://example.supabase.co/functions/v1/motochain-api', 'https://example.supabase.co/functions/v1/motochain-api/']) assert.equal(check(url), 0, url);
  for (const url of ['', 'http://example.com', 'https://localhost', 'https://example.com/wrong', 'https://user:pass@example.com', 'https://example.com/?key=secret']) assert.notEqual(check(url), 0, url);
  assert.notEqual(check('', 'true', 'production'), 0);
  assert.equal(check('', 'true', 'preview'), 0);
});
