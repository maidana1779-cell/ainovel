import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Cloudflare retains existing dashboard secrets while deploy diagnostics run',()=>{
 const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(wrangler.name,'alttulpick-api');
 assert.equal(wrangler.keep_vars,true);
 // Required-secret validation is temporarily omitted to distinguish blocked deployments from a missing runtime binding.
 assert.equal(wrangler.secrets?.required,undefined);
 assert.equal(wrangler.vars?.ADPICK_API_KEY,undefined);
});
