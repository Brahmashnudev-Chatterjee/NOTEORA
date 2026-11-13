import {describe,it,expect} from 'vitest'
import {encrypt,decrypt,signature,verifySignature,destination} from '../src/security.js'
describe('Webhook cryptographic and destination security',()=>{
  it('round-trips authenticated encryption with distinct nonces and rejects tampering',()=>{
    const a=encrypt('test-only-secret'),b=encrypt('test-only-secret');expect(a).not.toBe(b);expect(decrypt(a)).toBe('test-only-secret')
    const bytes=Buffer.from(a,'base64');bytes[15]^=1;expect(()=>decrypt(bytes.toString('base64'))).toThrow()
  })
  it('binds signature to timestamp and exact raw bytes with replay tolerance',()=>{
    const body='{"event":"gateway.test"}',ts=String(Math.floor(Date.now()/1000)),sig=signature('test-only',ts,body)
    expect(verifySignature('test-only',ts,body,sig)).toBe(true)
    expect(verifySignature('test-only',ts,body+' ',sig)).toBe(false)
    expect(verifySignature('test-only',ts,body,sig,Date.now()+400000)).toBe(false)
    expect(verifySignature('wrong',ts,body,sig)).toBe(false)
  })
  it('rejects private, mapped, metadata and link-local addresses',async()=>{
    for(const host of ['127.0.0.1','10.1.1.1','172.16.0.1','192.168.1.1','169.254.169.254','[::1]','[::ffff:127.0.0.1]','[fe80::1]'])await expect(destination('https://'+host+'/hook')).rejects.toThrow()
  })
  it('never permits the development HTTP bypass in production',async()=>{
    const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';process.env.GATEWAY_WEBHOOK_DEV_ORIGINS='http://127.0.0.1:12345'
    try{await expect(destination('http://127.0.0.1:12345/hook')).rejects.toThrow()}finally{process.env.NODE_ENV=previous;delete process.env.GATEWAY_WEBHOOK_DEV_ORIGINS}
  })
})
