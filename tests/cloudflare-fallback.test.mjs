import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
test('Cloudflare primary API with bounded Render fallback and no fabricated discounts',()=>{
 assert.ok(js);
 assert.doesNotThrow(()=>new Script(js));
 assert.match(js,/const API_ORIGIN='https:\/\/alttulpick-api\.maidana1779\.workers\.dev'/);
 assert.match(js,/const BACKUP_API_ORIGIN='https:\/\/alttulpick-preview\.onrender\.com'/);
 assert.match(js,/setTimeout\(\(\)=>primary\.abort\(\),7500\)/);
 assert.match(js,/setTimeout\(\(\)=>backup\.abort\(\),4500\)/);
 assert.match(js,/!\[502,503,504\]\.includes\(response\.status\)/);
 assert.match(js,/return await fetch\(BACKUP_API_ORIGIN\+path/);
 assert.match(js,/fetchProducts\(url\)/);
 assert.match(js,/fetchProducts\(endpoint\)/);
});
