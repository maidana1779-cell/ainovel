import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
test('Render probes Cloudflare status without blocking startup or consuming BIZ quota',()=>{
 assert.match(server,/server\.listen\(Number\(process\.env\.PORT\|\|3000\)/);
 assert.match(server,/void fetch\('https:\/\/alttulpick-api\.maidana1779\.workers\.dev\/health'/);
 assert.match(server,/signal:AbortSignal\.timeout\(4500\)/);
 assert.match(server,/\[edge-health\] status=/);
 assert.match(server,/\[edge-health\] unavailable/);
 const probe=server.slice(server.lastIndexOf('server.listen('));
 assert.doesNotMatch(probe,/await fetch|\/api\/best|\/api\/search|ADPICK_API_KEY/);
});
