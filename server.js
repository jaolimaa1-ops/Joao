import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes, timingSafeEqual} from 'node:crypto';
const port=Number(process.env.PORT||3000), base=process.env.APP_URL||process.env.RENDER_EXTERNAL_URL||`http://localhost:${port}`;
const sessions=new Map();
const configured=()=>Boolean(process.env.ML_CLIENT_ID&&process.env.ML_CLIENT_SECRET&&process.env.ML_REDIRECT_URI);
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function token(body){const r=await fetch('https://api.mercadolibre.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Não foi possível autorizar a conta. Confira as configurações da aplicação.');return r.json();}
async function api(s,path){if(s.expiry<Date.now()+60000){const t=await token({grant_type:'refresh_token',client_id:process.env.ML_CLIENT_ID,client_secret:process.env.ML_CLIENT_SECRET,refresh_token:s.refresh});Object.assign(s,{access:t.access_token,refresh:t.refresh_token||s.refresh,expiry:Date.now()+t.expires_in*1000});}const r=await fetch(`https://api.mercadolibre.com${path}`,{headers:{Authorization:`Bearer ${s.access}`},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`Mercado Livre respondeu ${r.status}. Verifique as permissões da conta.`);return r.json();}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,base);const sid=req.headers.cookie?.match(/(?:^|;\s*)sid=([a-f0-9]+)/)?.[1];let s=sessions.get(sid);if(s&&s.created<Date.now()-86400000){sessions.delete(sid);s=undefined;}
 if(url.pathname==='/api/status')return send(res,200,{configured:configured(),connected:Boolean(s?.access)});
 if(url.pathname==='/auth/connect'){
  if(!configured())return send(res,503,{error:'Configure ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI no servidor.'});
  const id=randomBytes(32).toString('hex'),state=randomBytes(32).toString('hex');sessions.set(id,{state,created:Date.now()});res.setHeader('Set-Cookie',`sid=${id}; HttpOnly; SameSite=Lax; Path=/${base.startsWith('https:')?'; Secure':''}`);
  const auth=new URL('https://auth.mercadolivre.com.br/authorization');auth.search=new URLSearchParams({response_type:'code',client_id:process.env.ML_CLIENT_ID,redirect_uri:process.env.ML_REDIRECT_URI,state});res.writeHead(302,{Location:auth.href});return res.end();
 }
 if(url.pathname==='/auth/callback'){
  const state=url.searchParams.get('state')||'';if(!s?.state||state.length!==s.state.length||!timingSafeEqual(Buffer.from(state),Buffer.from(s.state)))return send(res,400,{error:'Autorização inválida. Inicie a conexão novamente.'});
  delete s.state;if(!url.searchParams.get('code'))return send(res,400,{error:'Autorização cancelada.'});
  const t=await token({grant_type:'authorization_code',client_id:process.env.ML_CLIENT_ID,client_secret:process.env.ML_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:process.env.ML_REDIRECT_URI});Object.assign(s,{access:t.access_token,refresh:t.refresh_token,expiry:Date.now()+t.expires_in*1000,user:t.user_id});res.writeHead(302,{Location:'/'});return res.end();
 }
 if(url.pathname==='/api/disconnect'&&req.method==='POST'){if(req.headers.origin!==new URL(base).origin)return send(res,403,{error:'Origem inválida'});sessions.delete(sid);res.setHeader('Set-Cookie','sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return send(res,200,{ok:true});}
 if(url.pathname==='/api/data'){
  if(!s?.access)return send(res,401,{error:'Conecte sua conta para consultar dados reais.'});
  const days=Number(url.searchParams.get('days')||30);if(![7,30,90].includes(days))return send(res,400,{error:'Período inválido'});
  const from=new Date(Date.now()-days*86400000).toISOString(),to=new Date().toISOString();
  const result={demo:false,days,from,to,errors:[],items:[],orders:[],claims:[],visits:null};
  const parts=await Promise.allSettled([api(s,'/users/me'),api(s,`/orders/search?seller=${s.user}&sort=date_desc&limit=50&order.date_created.from=${encodeURIComponent(from)}&order.date_created.to=${encodeURIComponent(to)}`),api(s,`/users/${s.user}/items/search?limit=50`),api(s,`/users/${s.user}/items_visits?date_from=${from.slice(0,10)}&date_to=${to.slice(0,10)}`),api(s,`/post-purchase/v1/claims/search?user_id=${s.user}&limit=50`)]);
  for(let i=0;i<parts.length;i++)if(parts[i].status==='rejected')result.errors.push(['Conta','Vendas','Anúncios','Visitas','Reclamações'][i]+': '+parts[i].reason.message);
  if(parts[0].status==='fulfilled')result.account=parts[0].value.nickname;
  if(parts[1].status==='fulfilled'){result.orders=parts[1].value.results;result.orderTotal=parts[1].value.paging?.total;}
  if(parts[2].status==='fulfilled'){const ids=parts[2].value.results||[];result.itemTotal=parts[2].value.paging?.total;const fetched=await Promise.allSettled(ids.map(id=>api(s,`/items/${encodeURIComponent(id)}`)));result.items=fetched.filter(v=>v.status==='fulfilled').map(v=>v.value);if(fetched.some(v=>v.status==='rejected'))result.errors.push('Alguns anúncios não puderam ser carregados.');}
  if(parts[3].status==='fulfilled')result.visits=parts[3].value.total_visits??null;
  if(parts[4].status==='fulfilled')result.claims=parts[4].value.data||parts[4].value.results||[];
  return send(res,200,result);
 }
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};if(!files[url.pathname])return send(res,404,{error:'Não encontrado'});
 res.writeHead(200,{'Content-Type':url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' https:; frame-ancestors 'none'; base-uri 'self'"});res.end(await readFile(new URL(`./public/${files[url.pathname]}`,import.meta.url)));
}catch(e){send(res,502,{error:e.message});}});
server.listen(port,()=>console.log(`Servidor iniciado na porta ${port}`));
