import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {curatedProducts} from '../curated-products.mjs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const begin=script?.indexOf('function merchantStyle(')??-1;
const end=script?.indexOf('function show(',begin)??-1;
assert.ok(begin>=0&&end>begin,'merchant badge functions exist');

function make(tag,klass,text){
  return {tag, className:klass||'', textContent:text, children:[],
    append(...elements){this.children.push(...elements);}};
}
const elements=[];
const document={
  createElement(tag){
    const element={tag,handlers:{},removeCalled:false,
      addEventListener(type,listener){this.handlers[type]=listener;},
      remove(){this.removeCalled=true;}
    };
    elements.push(element);return element;
  }
};
const {merchantBadge,merchantStyle} = new Function('make','document','URL',
  script.slice(begin,end)+'\nreturn {merchantBadge,merchantStyle};'
)(make,document,URL);

test('Adpick merchandise displays provider merchant icon beside company name',()=>{
  const badge=merchantBadge({cp_name:'올리브영',cp_icon:'https://cdn.adpick.co.kr/icons/oliveyoung.png'});
  assert.equal(badge.children.length,2);
  const [logo,name]=badge.children;
  assert.equal(name.textContent,'올리브영');
  assert.match(logo.className,/merchant-logo--olive/);
  assert.equal(logo.children[0].textContent,'OY');
  assert.equal(logo.children[1].src,'https://cdn.adpick.co.kr/icons/oliveyoung.png');
  assert.equal(logo.children[1].referrerPolicy,'no-referrer');
  assert.equal(logo.children[1].alt,'');
});
test('Broken or unavailable provider images fall back to short merchant names',()=>{
  const badge=merchantBadge({cp_name:'11번가',cp_icon:'http://untrusted.example/logo.png'});
  assert.equal(badge.children[0].children.length,1);
  assert.equal(badge.children[0].children[0].textContent,'11');
  const badge2=merchantBadge({cp_name:'SSG',cp_icon:'https://cdn.adpick.co.kr/ssg.png'});
  const img=badge2.children[0].children[1];
  img.handlers.error();
  assert.equal(img.removeCalled,true);
});
test('Toss handpicked water preserves manual Sharelink and official logo',()=>{
  const toss=curatedProducts().find(p=>p.cp_name==='토스쇼핑');
  assert.ok(toss);
  assert.equal(toss.commissionlink,'https://toss.shopping/_m/fEfXH2Dz');
  assert.equal(toss.cp_icon,'https://static.toss.im/icons/png/4x/icon-toss-logo.png');
  const badge=merchantBadge(toss);
  assert.match(badge.children[0].className,/merchant-logo--toss/);
  assert.equal(badge.children[0].children[1].src,toss.cp_icon);
});
test('Icons change only presentation and preserve classification/search code',()=>{
  assert.match(html,/box\.append\(merchantBadge\(p\)\)/);
  assert.match(html,/\/api\/search/);
  assert.match(html,/\/api\/best/);
  assert.doesNotThrow(()=>new Script(script));
});
