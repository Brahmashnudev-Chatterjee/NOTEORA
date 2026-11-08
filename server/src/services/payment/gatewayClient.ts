import { getGatewayCredentials } from './paymentEnvironmentService.js'
export class GatewayClient {
  private async request(path:string,init:RequestInit={}) { const c=getGatewayCredentials(); if(!c.baseUrl||!c.apiKey||!c.apiSecret) throw new Error('UPI gateway is not configured'); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),15000); try { const res=await fetch(c.baseUrl+path,{...init,signal:controller.signal,headers:{'X-Api-Key':c.apiKey,'X-Api-Secret':c.apiSecret,'Content-Type':'application/json',...(init.headers||{})}}); const data=await res.json().catch(()=>({success:false,message:'Invalid gateway response'})); if(!res.ok||data.success===false) throw new Error(data.message||`Gateway HTTP ${res.status}`); return data } finally { clearTimeout(timer) } }
  createOrder(amount:number,clientOrderId:string){ return this.request('/api/v1/orders',{method:'POST',body:JSON.stringify({amount,client_order_id:clientOrderId})}) }
  getOrder(id:string){ return this.request(`/api/v1/orders/${encodeURIComponent(id)}`) }
  getAccounts(){ return this.request('/api/v1/accounts') }
}
export const gatewayClient=new GatewayClient()
