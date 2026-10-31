// Adpick /malls is independent from the physical-product search feed.
// Category names below are Alttulpick's navigation labels, not provider taxonomy.
const GROUPS=[
 ['온라인 강의',/인프런|inflearn|클래스101|class101|패스트캠퍼스|udemy|유데미|탈잉|콜로소/i],
 ['지식·전문서비스',/애드픽\s*지식|지식마켓|크몽|kmong/i],
 ['도서',/교보문고|yes\s*24|예스24|알라딘|리디북스|밀리의서재/i],
 ['여행·숙박·체험',/클룩|klook|kkday|케이케이데이|야놀자|여기어때|마이리얼트립|myrealtrip|호텔스닷컴|hotels\.com|트립닷컴|trip\.com|노랑풍선|아고다|agoda|익스피디아|와그/i],
 ['학생·유아동',/교복몰|보리보리|아가방|키즈몰/i],
 ['반려동물',/펫프렌즈|핏펫|펫몰/i],
 ['식품·건강',/풀무원|cj더마켓|오아시스|정관장|식품몰/i],
 ['뷰티',/클리오|올리브영|이니스프리|에뛰드|아모레/i],
 ['스포츠·레저',/아디다스|나이키|데카트론|뉴발란스/i],
 ['패션·잡화',/w컨셉|wconcept|더블유컨셉|h패션몰|shein|쉬인|포스티|무신사|29cm|필웨이|패션몰/i],
 ['가전·디지털',/lg전자|lge\.com|하이마트|리퍼연구소|삼성닷컴|전자랜드/i],
 ['리빙·인테리어',/오늘의집|세스코몰|한샘|이케아/i],
 ['종합쇼핑',/쿠팡|11번가|g마켓|gmarket|옥션|ssg|이마트몰|gs\s*shop|롯데온|알리익스프레스|aliexpress|알리바바|temu|테무|홈플러스|토스쇼핑/i]
];
export function mallCategory(name){
 const value=String(name||'').normalize('NFKC');
 return GROUPS.find(([,pattern])=>pattern.test(value))?.[0]||'기타 제휴몰';
}
export function safeMallUrl(value){
 if(typeof value!=='string'||value.length>2048)return '';
 try{
  const url=new URL(value);
  return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password?value:'';
 }catch{return ''}
}
export function normalizeMallsResponse(response){
 if(response?.success!==true||!Array.isArray(response.data))throw Error('MALLS_UPSTREAM_SHAPE');
 const seen=new Set(),data=[];
 for(const item of response.data.slice(0,300)){
  if(!item||typeof item!=='object')continue;
  const name=String(item.name||'').trim().slice(0,100);
  if(!name)continue;
  const cp_code=String(item.cp_code||'').trim().slice(0,80);
  const id=(cp_code||name).normalize('NFKC').toLowerCase();
  if(seen.has(id))continue;
  seen.add(id);
  data.push({cp_code,name,category:mallCategory(name),
   title:String(item.title||'').trim().slice(0,160),
   icon:safeMallUrl(item.icon),commissionlink:safeMallUrl(item.commissionlink)});
 }
 return {success:true,data,meta:{total:data.length,
  linked:data.filter(m=>!!m.commissionlink).length,
  source:'adpick_biz_malls',search_support:'not_verified'}};
}
