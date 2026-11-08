import fs from 'node:fs'
import path from 'node:path'
const out = process.argv[2] || 'database/migration-fixtures'
fs.mkdirSync(out,{recursive:true})
const oid = n => n.toString(16).padStart(24,'0')
const date='2026-11-08T18:00:00.000Z'
const users=[
 {_id:{$oid:oid(1)},name:'Buyer Verification',email:'buyer.verify@noteora.test',password:'$2b$12$fixturePasswordHashOnly',role:'USER',verified:true,active:true,plan:'FREE',createdAt:{$date:date},updatedAt:{$date:date}},
 {_id:{$oid:oid(2)},name:'Seller One',email:'seller1.verify@noteora.test',password:'$2b$12$fixturePasswordHashOnly',role:'USER',verified:true,active:true,plan:'PRO',createdAt:{$date:date},updatedAt:{$date:date}},
 {_id:{$oid:oid(3)},name:'Seller Two',email:'seller2.verify@noteora.test',password:'$2b$12$fixturePasswordHashOnly',role:'USER',verified:true,active:true,plan:'ULTRA',createdAt:{$date:date},updatedAt:{$date:date}}
]
const categories=[{_id:{$oid:oid(11)},name:'Engineering',slug:'engineering',createdAt:{$date:date},updatedAt:{$date:date}}]
const materials=[
 {_id:{$oid:oid(21)},title:'Physics Notes',description:'Migration verification fixture',price:50,category:{$oid:oid(11)},seller:{$oid:oid(2)},status:'APPROVED',pdfPath:'private/physics.pdf',createdAt:{$date:date},updatedAt:{$date:date}},
 {_id:{$oid:oid(22)},title:'Signals Notes',description:'Migration verification fixture',price:150,category:{$oid:oid(11)},seller:{$oid:oid(3)},status:'APPROVED',pdfPath:'private/signals.pdf',createdAt:{$date:date},updatedAt:{$date:date}}
]
const orders=[
 {_id:{$oid:oid(31)},internalOrderId:'MIG-PAID-50',clientOrderId:'CLIENT-MIG-50',gatewayOrderId:'GW-MIG-50',user:{$oid:oid(1)},items:[{material:{$oid:oid(21)},title:'Physics Notes',unitPrice:50,seller:{$oid:oid(2)}}],subtotal:50,gst:0,discount:0,total:50,currency:'INR',environment:'sandbox',paymentStatus:'PAID',gatewayEventSequence:2,paidAt:{$date:date},createdAt:{$date:date},updatedAt:{$date:date}},
 {_id:{$oid:oid(32)},internalOrderId:'MIG-PAID-150',clientOrderId:'CLIENT-MIG-150',gatewayOrderId:'GW-MIG-150',user:{$oid:oid(1)},items:[{material:{$oid:oid(22)},title:'Signals Notes',unitPrice:150,seller:{$oid:oid(3)}}],subtotal:150,gst:0,discount:0,total:150,currency:'INR',environment:'sandbox',paymentStatus:'PAID',gatewayEventSequence:2,paidAt:{$date:date},createdAt:{$date:date},updatedAt:{$date:date}},
 {_id:{$oid:oid(33)},internalOrderId:'MIG-FAILED-100',clientOrderId:'CLIENT-MIG-100',gatewayOrderId:'GW-MIG-100',user:{$oid:oid(1)},items:[{material:{$oid:oid(21)},title:'Physics Notes',unitPrice:100,seller:{$oid:oid(2)}}],subtotal:100,gst:0,discount:0,total:100,currency:'INR',environment:'sandbox',paymentStatus:'FAILED',gatewayEventSequence:1,createdAt:{$date:date},updatedAt:{$date:date}}
]
const sellerledgers=[
 {_id:{$oid:oid(41)},seller:{$oid:oid(2)},order:{$oid:oid(31)},originalPrice:50,discount:0,gst:0,customerPayment:50,commission:10,gatewayCost:1,sellerPayable:39,refundAmount:0,platformRevenue:10,settlementStatus:'READY',createdAt:{$date:date},updatedAt:{$date:date}},
 {_id:{$oid:oid(42)},seller:{$oid:oid(3)},order:{$oid:oid(32)},originalPrice:150,discount:0,gst:0,customerPayment:150,commission:15,gatewayCost:2,sellerPayable:133,refundAmount:0,platformRevenue:15,settlementStatus:'READY',createdAt:{$date:date},updatedAt:{$date:date}}
]
const data={users,categories,materials,carts:[],orders,paymentwebhookevents:[
 {_id:{$oid:oid(51)},eventId:'evt-paid-50',event:'payment.paid',eventSequence:2,gatewayOrderId:'GW-MIG-50',environment:'sandbox',processedAt:{$date:date},createdAt:{$date:date},updatedAt:{$date:date}},
 {_id:{$oid:oid(52)},eventId:'evt-paid-150',event:'payment.paid',eventSequence:2,gatewayOrderId:'GW-MIG-150',environment:'sandbox',processedAt:{$date:date},createdAt:{$date:date},updatedAt:{$date:date}},
 {_id:{$oid:oid(53)},eventId:'evt-failed-100',event:'payment.failed',eventSequence:1,gatewayOrderId:'GW-MIG-100',environment:'sandbox',processedAt:{$date:date},createdAt:{$date:date},updatedAt:{$date:date}}
],reviews:[{_id:{$oid:oid(61)},material:{$oid:oid(21)},user:{$oid:oid(1)},order:{$oid:oid(31)},rating:5,comment:'Representative migration review',createdAt:{$date:date},updatedAt:{$date:date}}],sellerledgers,subscriptionplans:[{_id:{$oid:oid(71)},name:'PRO',price:199,activeListings:25,commissionRate:20,featured:true,features:['25 listings']},{_id:{$oid:oid(72)},name:'ULTRA',price:499,activeListings:100,commissionRate:10,featured:true,features:['100 listings']}],subscriptions:[{_id:{$oid:oid(81)},user:{$oid:oid(2)},plan:'PRO',active:true,expiresAt:{$date:'2027-01-01T00:00:00.000Z'},createdAt:{$date:date},updatedAt:{$date:date}}],notifications:[],adminaudits:[],supporttickets:[],usersessions:[{_id:{$oid:oid(91)},user:{$oid:oid(1)},ip:'127.0.0.1',userAgent:'migration-verification',loginAt:{$date:date},createdAt:{$date:date},updatedAt:{$date:date}}],activitylogs:[{_id:{$oid:oid(92)},user:{$oid:oid(1)},actorRole:'USER',action:'LOGIN',entity:'User',entityId:oid(1),createdAt:{$date:date}}],refunds:[{_id:{$oid:oid(101)},order:{$oid:oid(31)},requestedBy:{$oid:oid(1)},amount:50,reason:'Migration verification request',status:'REQUESTED',createdAt:{$date:date},updatedAt:{$date:date}}]}
for(const [name,rows] of Object.entries(data)) fs.writeFileSync(path.join(out,`${name}.json`),JSON.stringify(rows,null,2))
console.log(`Representative migration fixtures written to ${path.resolve(out)}`)
