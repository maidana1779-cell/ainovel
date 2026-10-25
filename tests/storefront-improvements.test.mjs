import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
test('Mobile merchant filters do not overflow and summary is honest about one-vendor best feeds',()=>{
 assert.match(html,/\.product-toolbar \.toolbar-controls select\{width:100%;max-width:none;min-height:40px\}/);
 assert.match(script,/function merchantSummary\(items\)/);
 assert.match(script,/해당 목록은 한 판매처 중심/);
 assert.match(script,/merchantSummary\(initial\)/);
 assert.doesNotThrow(()=>new Script(script));
});
test('Above-the-fold product thumbnails load early and remaining ones are lazy',()=>{
 assert.match(script,/const prioritize=target===grid&&index<2/);
 assert.match(script,/img\.loading=prioritize\?"eager":"lazy"/);
 assert.match(script,/img\.fetchPriority="high"/);
});
