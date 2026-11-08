export type FinancialInput={basePrice:number;commissionRate:number;gstRate?:number;gatewayFee?:number}
export function calculateFinancials(input:FinancialInput){
  if(!Number.isFinite(input.basePrice)||input.basePrice<0||input.basePrice>150)throw new Error('Invalid base price')
  const commissionRate=Math.min(100,Math.max(0,input.commissionRate));const gstRate=Math.min(100,Math.max(0,input.gstRate||0));const gatewayFee=Math.max(0,input.gatewayFee||0)
  const basePrice=Math.round(input.basePrice*100)/100
  const commission=Math.round(basePrice*commissionRate/100*100)/100
  const gst=Math.round(basePrice*gstRate/100*100)/100
  const customerPayment=Math.round((basePrice+gst)*100)/100
  const sellerPayable=Math.round((basePrice-commission)*100)/100
  const platformRevenue=Math.round((commission-gatewayFee-gst)*100)/100
  return {basePrice,discount:0,gst,customerPayment,commission,gatewayFee,sellerPayable,refundAmount:0,platformRevenue}
}
