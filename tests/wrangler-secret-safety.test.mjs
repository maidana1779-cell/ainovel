import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Cloudflare deployments retain dashboard variables and fail before silently removing the required Adpick secret',()=>{
 const wrangler=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
 assert.equal(wrangler.name,'alttulpick-api');
 assert.equal(wrangler.keep_vars,true);
 assert.deepEqual(wrangler.secrets.required,['ADPICK_API_KEY']);
 assert.equal(wrangler.vars?.ADPICK_API_KEY,undefined);
});
