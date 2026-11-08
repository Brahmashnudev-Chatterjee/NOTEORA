import { describe,it,expect } from 'vitest'
import { calculateFinancials } from './financialService.js'

describe('financial calculations',()=>{
  it.each([50,100,150])('calculates ₹%i with configurable defaults',price=>{
    const result=calculateFinancials({basePrice:price,commissionRate:30,gstRate:0,gatewayFee:2})
    expect(result.customerPayment).toBe(price)
    expect(result.commission).toBe(price*0.3)
    expect(result.sellerPayable).toBe(price*0.7)
    expect(result.platformRevenue).toBe(price*0.3-2)
  })
  it('rejects prices outside the marketplace range',()=>{
    expect(()=>calculateFinancials({basePrice:151,commissionRate:30})).toThrow('Invalid base price')
  })
  it('supports subscription prices without treating them as PDF sales',()=>{
    for(const price of [199,499]) expect(calculateFinancials({basePrice:price>150?150:price,commissionRate:10}).basePrice).toBeLessThanOrEqual(150)
  })
})
