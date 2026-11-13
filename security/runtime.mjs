import fs from 'node:fs/promises'
function parseUrl(raw){try{return new URL(raw)}catch{throw new Error('Invalid deployment URL')}}
// Shared deployment policy. No provider, payment or database migration side effects.
export function origins(value, production = process.env.NODE_ENV === 'production') {
  if (!value?.trim()) throw new Error('Explicit frontend origins are required')
  return [...new Set(value.split(',').map(raw => {
    const text=raw.trim(),url=parseUrl(text)
    if(url.origin!==text||url.username||url.password||!['http:','https:'].includes(url.protocol)||production&&url.protocol!=='https:')throw new Error('Frontend origins must be exact HTTPS origins in production')
    return text
  }))]
}
export function validateDeployment(env, kind) {
  const production=env.NODE_ENV==='production'
  const allowed=origins(env[kind==='gateway'?'GATEWAY_CLIENT_URL':'CLIENT_URL']||(production?'':kind==='gateway'?'http://localhost:5173,http://localhost:5174':'http://localhost:5173'),production)
  const proxy=Number(env.TRUST_PROXY_HOPS||0)
  if(!Number.isInteger(proxy)||proxy<0||proxy>3)throw new Error('TRUST_PROXY_HOPS must be an explicit bounded hop count')
  if(production){
    for(const name of kind==='gateway'?['GATEWAY_JWT_SECRET','GATEWAY_WEBHOOK_ENCRYPTION_KEY']:['JWT_ACCESS_SECRET']){
      const secret=env[name];if(!secret||secret.length<32||/replace|change.?me|ci-only|test-only|unused/i.test(secret))throw new Error('Strong production secrets are required')
    }
    const pg=env.DATABASE_URL?parseUrl(env.DATABASE_URL):null
    if(!pg?.username||!pg.password||!['postgres:','postgresql:'].includes(pg.protocol)||pg.searchParams.get('sslmode')!=='require'||pg.searchParams.get('sslaccept')!=='strict')throw new Error('Production Prisma6 PostgreSQL needs credentials, sslmode=require and sslaccept=strict')
    const redis=env[kind==='gateway'?'GATEWAY_REDIS_URL':'REDIS_URL']
    if(redis){const url=parseUrl(redis);if(url.protocol!=='rediss:'||!url.password)throw new Error('Production Redis needs authenticated TLS')}
    else if(kind!=='gateway')throw new Error('Production Redis URL is required')
    if(kind!=='gateway'){
      // MongoDB replica-set seed lists are valid driver URIs but not WHATWG URLs.
      const mongo=/^(mongodb(?:\+srv)?):\/\/([^/?#]+)(?:\/[^?#]*)?(?:\?([^#]*))?$/.exec(env.MONGO_URI||'')
      const authority=mongo?.[2]||'',at=authority.lastIndexOf('@'),credentials=authority.slice(0,at),colon=credentials.indexOf(':')
      const options=[...new URLSearchParams(mongo?.[3]||'')].map(([k,v])=>[k.toLowerCase(),v.toLowerCase()])
      const unsafe=options.some(([k,v])=>(['tls','ssl'].includes(k)&&v!=='true')||(['tlsinsecure','tlsallowinvalidcertificates','tlsallowinvalidhostnames'].includes(k)&&v!=='false'))
      if(!mongo||at<0||colon<1||colon===credentials.length-1||unsafe||(mongo[1]!=='mongodb+srv'&&!options.some(([k,v])=>['tls','ssl'].includes(k)&&v==='true')))throw new Error('Production MongoDB needs authenticated TLS with certificate validation')
    }
    if(kind==='gateway'){const auth=env.MARKETPLACE_AUTH_URL?parseUrl(env.MARKETPLACE_AUTH_URL):null;if(auth?.protocol!=='https:'||auth.username||auth.password)throw new Error('Production administrator introspection requires HTTPS')}
  }
  return {allowed,proxy}
}
export function requireHttps(req,res,next){
  if(process.env.NODE_ENV==='production'&&!req.secure&&req.path!=='/api/live')return res.status(403).json({error:'HTTPS is required'})
  next()
}
export function corsOrigin(allowed){return (origin,callback)=>{
  if(!origin||(typeof allowed==='function'?allowed():allowed).includes(origin))callback(null,true)
  else callback(Object.assign(new Error('Origin is not permitted'),{status:403}))
}}
const sensitive=/password|authorization|cookie|token|secret|api.?key|credentials|encryption/i
export function redact(value){
  if(Array.isArray(value))return value.map(redact)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,sensitive.test(k)?'[REDACTED]':redact(v)]))
  if(typeof value==='string')return value.replace(/(?:postgres(?:ql)?|redis[s]?|mongodb(?:\+srv)?):\/\/[^\s]+/gi,'[REDACTED_CONNECTION]').replace(/Bearer\s+[^\s]+/gi,'Bearer [REDACTED]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[REDACTED_TOKEN]').replace(/nk_(?:test|live)_[a-f0-9]+/g,'[REDACTED_KEY]')
  return value
}
export function safeLog(event,details={}){console.error(JSON.stringify(redact({event,...details})))}
export function requestError(error){
  const code=error.name==='ZodError'||error.name==='CastError'?400:error.status||500
  const status=Number.isInteger(code)&&code>=400&&code<=599?code:500
  return {status,message:status>=500?'Internal service error':error.type||error instanceof SyntaxError?'Invalid request':error.status?redact(String(error.message)):'Invalid request'}
}
export async function gracefulStop(server,cleanup){
  const closed=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
  server.closeIdleConnections?.();await closed;await cleanup()
}
export function signals(cleanup){
  let stopping=false
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{
    if(stopping)return;stopping=true
    const timer=setTimeout(()=>{safeLog('SHUTDOWN_TIMEOUT');process.exit(1)},15000);timer.unref()
    try{await cleanup();clearTimeout(timer);process.exitCode=0}catch{safeLog('SHUTDOWN_FAILED');process.exitCode=1}
  })
}
export function redisOptions(raw){
  const url=parseUrl(raw)
  if(!['redis:','rediss:'].includes(url.protocol))throw new Error('Invalid Redis protocol')
  return {host:url.hostname,port:Number(url.port||6379),username:decodeURIComponent(url.username)||undefined,password:decodeURIComponent(url.password)||undefined,db:Number(url.pathname.slice(1)||0),maxRetriesPerRequest:null,...url.protocol==='rediss:'?{tls:{}}:{}}
}
export function workerHeartbeat(file,check){
  let busy=false,closed=false
  async function tick(){if(busy||closed)return;busy=true;try{if(await check())await fs.writeFile(file,String(Date.now()),{mode:0o600});else await fs.rm(file,{force:true})}catch{await fs.rm(file,{force:true}).catch(()=>{})}finally{busy=false}}
  const timer=setInterval(()=>void tick(),10000);void tick()
  return async()=>{closed=true;clearInterval(timer);while(busy)await new Promise(r=>setTimeout(r,10));await fs.rm(file,{force:true})}
}
