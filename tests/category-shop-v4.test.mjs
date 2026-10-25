import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);

test('Six retail category departments are image-led with actual shortcuts',()=>{
 const home=html.slice(html.indexOf('<section id="shop-categories"'),html.indexOf('<section id="categories"'));
 const buttons=[...home.matchAll(/<button type="button" class="department department--[^"]+" data-department="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(buttons,['간편식','세제','이어폰','화장품','의류','주방용품']);
 const shortcuts=[...home.matchAll(/class="hub-quick" data-department="([^"]+)" data-term="([^"]+)"/g)];
 assert.equal(shortcuts.length,6);
 for(const [,department,term] of shortcuts){
  assert.ok(buttons.includes(department),department);
  assert.ok(term.length>=2,term);
 }
 assert.match(home,/class="department-art"/);
 assert.match(html,/\.department-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(html,/\.department--beauty \.department-art/);
 assert.match(html,/@media\(max-width:730px\)/);
 assert.match(html,/\.department-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('Category pages include visible tabs, subcategories, hero and sidebar',()=>{
 assert.match(html,/class="category-heading"/);
 assert.match(html,/id="categories-buttons"/);
 assert.match(html,/id="subcatlist"/);
 assert.match(html,/id="side-links"/);
 assert.match(html,/id="category-intro-stamp"/);
 assert.match(html,/body\.category-active \.category-section\{/);
 assert.match(html,/\.subcat-list\{flex-wrap:nowrap;overflow-x:auto/);
 assert.doesNotThrow(()=>new Script(script));
});

test('Direct shortcuts, real Adpick search and URL state are wired together',()=>{
 assert.match(script,/getElementById\("hub-quicklinks"\)\.addEventListener\("click"/);
 assert.match(script,/changeDepartment\(btn\.dataset\.department,\{term:btn\.dataset\.term,scroll:true\}\)/);
 assert.match(script,/searchProducts\(selectedTerm,selectedTerm===q\?info\.name:selectedTerm\)/);
 assert.match(script,/history\.pushState\(\{category:q,item:selectedTerm\}/);
 assert.match(script,/history\.pushState\(\{category:currentDepartment,item:term\}/);
 assert.match(script,/term:params\.get\("item"\)\|\|category/);
 assert.match(script,/load\("\/api\/search\?q="\+encodeURIComponent\(q\)\+"&limit=30"\)/);
 assert.match(script,/btn\.setAttribute\("aria-pressed",String\(word===selected\)\)/);
});

test('Deep linked subcategory query is constrained to its department',()=>{
 const begin=script.indexOf('const subQueries=');
 const funcs=script.indexOf('function validatedDepartmentTerm(',begin);
 const stop=script.indexOf('function setDepartmentMode(',funcs);
 assert.ok(begin>=0&&funcs>begin&&stop>funcs);
 const subQueries=new Function(script.slice(begin,script.indexOf('const departmentInfo=',begin))+'return subQueries;')();
 const {validatedDepartmentTerm,departmentUrl}=new Function('subQueries',script.slice(funcs,stop)+'return {validatedDepartmentTerm,departmentUrl};')(subQueries);
 assert.equal(validatedDepartmentTerm('간편식','생수'),'생수');
 assert.equal(validatedDepartmentTerm('간편식','이어폰'),'간편식');
 assert.equal(validatedDepartmentTerm('세제','세탁세제'),'세탁세제');
 assert.equal(validatedDepartmentTerm('세제','malicious'),'세제');
 assert.equal(departmentUrl('간편식','생수'),'/?category='+encodeURIComponent('간편식')+'&item='+encodeURIComponent('생수'));
 assert.equal(departmentUrl('간편식','간편식'),'/?category='+encodeURIComponent('간편식'));
});
