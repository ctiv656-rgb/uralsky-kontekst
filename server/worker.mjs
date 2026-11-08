const DAY=24*60*60*1000;
const encoder=new TextEncoder();
// Apps Script's default string HMAC encoding differs for non-ASCII input.
// Sign an ASCII JSON representation; JSON.parse restores Cyrillic and emoji exactly.
export function serializeMessage(value){return JSON.stringify(value).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));}
export async function hmac(secret,value){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function validate(data){
  if(!data||typeof data!=='object')throw Error('Некорректная форма.');
  const limits={topic:500,team:100,author:100,telegram:100};const result={};
  for(const [name,max] of Object.entries(limits)){if(data[name]!==undefined&&typeof data[name]!=='string')throw Error('Некорректное поле.');result[name]=(data[name]||'').normalize('NFKC').trim();if(result[name].length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(result[name]))throw Error('Слишком длинное или некорректное поле.');}
  if(result.topic.length<1)throw Error('Напиши тему.');
  if(!/^[a-f0-9-]{36}$/i.test(data.requestId||''))throw Error('Обнови страницу и попробуй ещё раз.');
  if(data.website)throw Error('Не удалось отправить форму.');
  return {...result,id:data.requestId};
}
async function identity(request,env){const ip=request.headers.get('CF-Connecting-IP');if(!ip)throw Error('IP_UNAVAILABLE');return hmac(env.IP_SECRET,ip.trim().toLowerCase());}
async function deliver(env,id){const job=await env.DB.prepare('SELECT * FROM outbox WHERE id=?').bind(id).first();if(!job||job.state==='sent')return job;
  const timestamp=Date.now();const message=serializeMessage({timestamp,payload:JSON.parse(job.payload)});const signature=await hmac(env.BRIDGE_SECRET,message);
  const response=await fetch(env.SHEETS_BRIDGE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,signature}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('SHEET_UNAVAILABLE');const body=await response.json();if(!body.ok)throw Error('SHEET_REJECTED');
  await env.DB.prepare("UPDATE outbox SET state='sent',category=?,payload=NULL WHERE id=?").bind(body.category||'Неразобрано',id).run();return {state:'sent',category:body.category};
}
export async function handle(request,env){
  const origin=request.headers.get('Origin');const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if(origin===env.ALLOWED_ORIGIN){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Methods']='GET,POST,OPTIONS';headers['Access-Control-Allow-Headers']='Content-Type';}
  const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
  if(origin!==env.ALLOWED_ORIGIN)return json({error:'Доступ запрещён.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!env.DB||!env.IP_SECRET||!env.BRIDGE_SECRET||!env.SHEETS_BRIDGE_URL)return json({error:'Приём тем пока не подключён.'},503);
  let ipHash;try{ipHash=await identity(request,env);}catch{return json({error:'Не удалось проверить лимит. Попробуй позже.'},503);}
  const now=Date.now(),path=new URL(request.url).pathname;
  if(request.method==='GET'&&path==='/status'){const row=await env.DB.prepare('SELECT expires_at FROM limits WHERE ip_hash=?').bind(ipHash).first();return json({retryAt:row&&row.expires_at>now?row.expires_at:null});}
  if(request.method!=='POST'||path!=='/topics')return json({error:'Не найдено.'},404);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Неверный формат.'},415);
  if(Number(request.headers.get('Content-Length')||0)>8000)return json({error:'Слишком длинная форма.'},413);
  let payload;try{const raw=await request.text();if(raw.length>8000)return json({error:'Слишком длинная форма.'},413);payload=validate(JSON.parse(raw));}catch(e){return json({error:e.message||'Проверь форму.'},400);}
  const scoped=await hmac(env.IP_SECRET,ipHash+':'+payload.id);payload.id=scoped.slice(0,8)+'-'+scoped.slice(8,12)+'-'+scoped.slice(12,16)+'-'+scoped.slice(16,20)+'-'+scoped.slice(20,32);
  payload.createdAt=new Date(now).toISOString();
  try{
    // One atomic reservation and outbox insertion: simultaneous requests cannot bypass the limit.
    await env.DB.batch([
      env.DB.prepare('INSERT INTO limits(ip_hash,request_id,expires_at) VALUES(?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET request_id=excluded.request_id,expires_at=excluded.expires_at WHERE limits.expires_at<=?').bind(ipHash,payload.id,now+DAY,now),
      env.DB.prepare('INSERT INTO outbox(id,payload,created_at) SELECT ?,?,? FROM limits WHERE ip_hash=? AND request_id=? ON CONFLICT(id) DO NOTHING').bind(payload.id,JSON.stringify(payload),now,ipHash,payload.id)
    ]);
    const limit=await env.DB.prepare('SELECT request_id,expires_at FROM limits WHERE ip_hash=?').bind(ipHash).first();
    if(limit.request_id!==payload.id)return json({error:'Ты уже предложил тему. Следующую можно отправить через 24 часа после предыдущей.',retryAt:limit.expires_at},429,{'Retry-After':String(Math.ceil((limit.expires_at-now)/1000))});
    let job;try{job=await deliver(env,payload.id);}catch{job={state:'pending'};}
    return json({ok:true,id:payload.id,retryAt:limit.expires_at,synced:job.state==='sent',category:job.category||null},job.state==='sent'?200:202);
  }catch{return json({error:'Не удалось сохранить тему. Попробуй ещё раз.'},503);}
}
export default {fetch:handle,async scheduled(event,env,ctx){ctx.waitUntil((async()=>{const jobs=await env.DB.prepare("SELECT id FROM outbox WHERE state='pending' ORDER BY created_at LIMIT 25").all();for(const job of jobs.results){try{await deliver(env,job.id);}catch{/* Retain the payload for the next retry. */}}await env.DB.prepare('DELETE FROM limits WHERE expires_at<?').bind(Date.now()-3600000).run();})());}};
