// Bounded anonymous best-product cache. Never store failed or malformed API replies.
export function createBestFeedCache({clock=()=>Date.now(),freshMs=180000,staleMs=900000,maxEntries=30}={}){
 const records=new Map(), pendingLoads=new Map();
 function valid(payload){
  return payload?.success===true&&(
   Array.isArray(payload.data)||Array.isArray(payload.data?.list));
 }
 function peek(key){
  const stored=records.get(key);
  if(!stored)return null;
  const age=Math.max(0,clock()-stored.at);
  if(age>=staleMs){records.delete(key);return null}
  return {payload:stored.payload,stale:age>=freshMs,ageSeconds:Math.floor(age/1000)};
 }
 function remember(key,payload){
  if(!valid(payload))return false;
  records.delete(key);
  records.set(key,{payload,at:clock()});
  if(records.size>maxEntries)records.delete(records.keys().next().value);
  return true;
 }
 function pending(key){return pendingLoads.get(key)||null}
 function load(key,fetcher){
  if(pendingLoads.has(key))return pendingLoads.get(key);
  const task=Promise.resolve().then(fetcher).then(payload=>{
   if(!remember(key,payload))throw Error('INVALID_BEST_FEED');
   return payload;
  }).finally(()=>pendingLoads.delete(key));
  pendingLoads.set(key,task);
  return task;
 }
 function stalePayload(record){
  return {...record.payload,filter_meta:{
   ...(record.payload.filter_meta||{}),cache_status:'stale',
   cache_age_seconds:record.ageSeconds}};
 }
 return {peek,pending,load,stalePayload};
}
