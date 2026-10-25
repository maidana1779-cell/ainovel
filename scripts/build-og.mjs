// Public share-card PNG generated with built-in Node modules; no external CDN or asset dependency.
// The underlying service remains static, and no user data is included in the image.
import {deflateSync} from 'node:zlib';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const W=1200,H=630;
const data=new Uint8Array(W*H*3);
const colors={back:[234,242,255],white:[255,255,255],border:[213,228,250],blue:[36,104,232],ink:[25,43,70],muted:[88,110,141]};
const set=(x,y,c)=>{if(x<0||x>=W||y<0||y>=H)return;const i=(y*W+x)*3;data.set(c,i)};
const box=(x,y,w,h,c,r=0)=>{
 for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
  if(r){const dx=Math.max(x+r-xx-1,0,xx-(x+w-r));const dy=Math.max(y+r-yy-1,0,yy-(y+h-r));if(dx*dx+dy*dy>r*r)continue}
  set(xx,yy,c);
 }
};
const line=(x0,y0,x1,y1,c,width=9)=>{
 const dx=x1-x0,dy=y1-y0,steps=Math.max(Math.abs(dx),Math.abs(dy));
 for(let i=0;i<=steps;i++){const x=Math.round(x0+dx*i/steps),y=Math.round(y0+dy*i/steps);box(x-width/2|0,y-width/2|0,width,width,c,Math.floor(width/2))}
};
const letters={
 A:['01110','10001','10001','11111','10001','10001','10001'],
 B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],
 D:['11110','10001','10001','10001','10001','10001','11110'],
 E:['11111','10000','10000','11110','10000','10000','11111'],
 F:['11111','10000','10000','11110','10000','10000','10000'],
 G:['01111','10000','10000','10111','10001','10001','01110'],
 H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['11111','00100','00100','00100','00100','00100','11111'],
 J:['00111','00010','00010','00010','10010','10010','01100'],
 K:['10001','10010','10100','11000','10100','10010','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 M:['10001','11011','10101','10101','10001','10001','10001'],
 N:['10001','11001','10101','10011','10001','10001','10001'],
 O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','10001','11110','10000','10000','10000'],
 Q:['01110','10001','10001','10001','10101','10010','01101'],
 R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],
 V:['10001','10001','10001','10001','10001','01010','00100'],
 W:['10001','10001','10001','10101','10101','10101','01010'],
 X:['10001','10001','01010','00100','01010','10001','10001'],
 Y:['10001','10001','01010','00100','00100','00100','00100'],
 Z:['11111','00001','00010','00100','01000','10000','11111'],
 ' ':['00000','00000','00000','00000','00000','00000','00000'],
 '/':['00001','00001','00010','00100','01000','10000','10000'],
 '.':['00000','00000','00000','00000','00000','01100','01100']
};
const text=(str,x,y,scale,c)=>{
 for(const ch of str.toUpperCase()){
  const matrix=letters[ch]||letters[' '];
  for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(matrix[row][col]==='1')box(x+col*scale,y+row*scale,scale,scale,c,Math.max(1,Math.floor(scale/7)));
  x+=6*scale;
 }
};
box(0,0,W,H,colors.back);
box(63,58,1074,514,colors.border,45);
box(66,61,1068,508,colors.white,44);
box(112,118,124,124,colors.blue,30);
line(145,179,165,198,colors.white,14);
line(165,198,207,151,colors.white,14);
text('ALTTUL PICK',269,151,13,colors.ink);
box(123,317,930,4,colors.border,1);
text('FIND PRODUCTS EASILY',126,343,7,colors.ink);
text('CATEGORIES  /  SEARCH  /  PARTNER SHOPPING',127,439,4,colors.muted);
text('ALTTUL PICK  /  SHOP SMARTER',126,520,4,colors.blue);
const crc32=(input)=>{let c=0xffffffff;for(const b of input){c^=b;for(let j=0;j<8;j++)c=c&1?(c>>>1)^0xedb88320:c>>>1}return (c^0xffffffff)>>>0};
const chunk=(name,bytes)=>{const head=Buffer.from(name,'ascii'),out=Buffer.alloc(bytes.length+12);out.writeUInt32BE(bytes.length,0);head.copy(out,4);bytes.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,8+bytes.length)),8+bytes.length);return out};
const raw=Buffer.alloc((W*3+1)*H);
for(let y=0;y<H;y++){const p=y*(W*3+1);raw[p]=0;raw.set(data.subarray(y*W*3,(y+1)*W*3),p+1)}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=2;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
mkdirSync('public',{recursive:true});writeFileSync(join('public','share-preview.png'),png);
console.log('Generated public/share-preview.png',png.length,'bytes');
