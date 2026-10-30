import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const publicHTML=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const block=html.slice(html.indexOf('<section id="shopping-events"'),html.indexOf('<section class="hero"'));
const imageEntries=[
 {file:'11st-living.png',url:'https://bitl.bz/jKubOI',type:'png'},
 {file:'xiaomi-band-11.jpg',url:'https://bitl.bz/l0gfEs',type:'jpg'},
 {file:'intel-ultra-coupang.jpg',url:'https://bitl.bz/DfTQat',type:'jpg'}
];
test('Top of homepage has exactly three original-image affiliate slides and matching dots',()=>{
 assert.ok(block.length>0);
 assert.match(html,/<header[\s\S]*?<section id="shopping-events"[\s\S]*?<section class="hero"/);
 assert.equal((block.match(/data-campaign-slide="\d"/g)||[]).length,3);
 assert.equal((block.match(/data-campaign-dot="\d"/g)||[]).length,3);
 for(let n=0;n<imageEntries.length;n++){
  const a=imageEntries[n];
  assert.ok(block.includes('data-campaign-slide="'+n+'" href="'+a.url+'"'),a.file);
  assert.ok(block.includes('src="/events/'+a.file+'"'),a.file);
  assert.ok(block.includes('data-campaign-dot="'+n+'"'));
 }
 assert.doesNotMatch(block,/adidas-autumn\.avif|https:\/\/bitl\.bz\/Bmbhq2/);
 assert.match(block,/rel="sponsored nofollow noopener noreferrer"/);
 assert.equal(html,publicHTML,'Render and public HTML must match');
});
test('Slider uses original image composition without cutting off embedded merchant text',()=>{
 const css=html.slice(html.indexOf('All three supplied campaign creatives'),html.indexOf('</style>'));
 assert.match(css,/object-fit:contain/);
 assert.match(css,/aspect-ratio:16\/9/);
 assert.match(css,/@media\(max-width:730px\)/);
 assert.doesNotMatch(css,/object-fit:cover/);
 assert.doesNotThrow(()=>new Script(js));
 assert.match(js,/initShoppingCampaignSlider\(\)/);
 assert.match(js,/cards=\[\.\.\.node\.querySelectorAll\("\[data-campaign-slide\]"\)\]/);
 assert.match(js,/dots=\[\.\.\.node\.querySelectorAll\("\[data-campaign-dot\]"\)\]/);
});
test('Do not deploy broken banners: every original image must be in the public events folder',()=>{
 for(const {file,type} of imageEntries){
  const full=new URL('../public/events/'+file,import.meta.url);
  assert.ok(existsSync(full),'Original campaign artwork missing: '+file);
  const buf=readFileSync(full);
  assert.ok(buf.length>20000,file+': suspect tiny compressed thumbnail');
  if(type==='png')assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  else assert.equal(buf.subarray(0,3).toString('hex'),'ffd8ff');
 }
});
