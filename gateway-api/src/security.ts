import crypto from 'node:crypto'
import dns from 'node:dns/promises'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'

export const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex')
export const secret=()=>crypto.randomBytes(32).toString('hex')
const key=()=>{
  const value=process.env.GATEWAY_WEBHOOK_ENCRYPTION_KEY||(process.env.NODE_ENV==='test'?'ci-test-only-webhook-secret':'')
  if(value.length<32&&process.env.NODE_ENV!=='test')throw new Error('Configure a strong gateway encryption key')
  return crypto.createHash('sha256').update(value).digest()
}
export function encrypt(value:string){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv),encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64')}
export function decrypt(value:string){const b=Buffer.from(value,'base64'),cipher=crypto.createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8')}
export function signature(value:string,timestamp:string,body:string){return crypto.createHmac('sha256',value).update(timestamp+'.'+body).digest('hex')}
export function verifySignature(value:string,timestamp:string,body:string,provided:string,now=Date.now()){
  if(!/^\d+$/.test(timestamp)||Math.abs(now-Number(timestamp)*1000)>300000||!/^[a-f0-9]{64}$/.test(provided))return false
  return crypto.timingSafeEqual(Buffer.from(signature(value,timestamp,body),'hex'),Buffer.from(provided,'hex'))
}
function publicIP(ip:string){
  if(net.isIPv4(ip)){const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&b===51)||(a===203&&b===0)||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19)))}
  // Conservative IPv6: only global unicast; rejects mapped IPv4, loopback and link-local.
  return net.isIPv6(ip)&&/^[23][0-9a-f]{3}:/i.test(ip)&&!ip.startsWith('2001:db8:')
}
export async function destination(raw:string){
  const url=new URL(raw)
  if(url.username||url.password||url.hash||raw.length>2000)throw Object.assign(new Error('Invalid webhook destination'),{status:400})
  const dev=process.env.NODE_ENV!=='production'&&(process.env.GATEWAY_WEBHOOK_DEV_ORIGINS||'').split(',').includes(url.origin)
  if(url.protocol!=='https:'&&!(dev&&url.protocol==='http:'))throw Object.assign(new Error('HTTPS webhook URL required'),{status:400})
  const hostname=url.hostname.replace(/^\[|\]$/g,'')
  const addresses=net.isIP(hostname)?[{address:hostname,family:net.isIP(hostname)}]:await dns.lookup(hostname,{all:true})
  if(!addresses.length||(!dev&&addresses.some(a=>!publicIP(a.address))))throw Object.assign(new Error('Private or reserved webhook destination denied'),{status:400})
  return {url,address:addresses[0],dev}
}
// Resolve and pin each request's destination; never follow redirects or retain response bodies.
export async function sendWebhook(raw:string,body:string,headers:Record<string,string>):Promise<number>{
  const {url,address}=await destination(raw)
  return new Promise((resolve,reject)=>{
    const request=(url.protocol==='https:'?https:http).request(url,{method:'POST',headers:{...headers,'Content-Type':'application/json','Content-Length':String(Buffer.byteLength(body))},lookup:((_host:any,options:any,cb:any)=>options?.all?cb(null,[address]):cb(null,address.address,address.family)) as any},response=>{const status=response.statusCode||0;response.destroy();resolve(status)})
    request.setTimeout(10000,()=>request.destroy(new Error('Webhook timed out')));request.on('error',reject);request.end(body)
  })
}
