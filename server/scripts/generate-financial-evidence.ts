import fs from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {calculateOrder,financialHash,refundCumulative,type FinancialRules} from '../src/services/financialService.js'
const policy:FinancialRules={version:1,tax:{status:'APPROVED',mode:'NONE',rateBps:0,approvalReference:'PURE TEST FIXTURE: not a tax determination'},gatewayFee:{status:'APPROVED',rateBps:100,fixedMinor:1,approvalReference:'PURE TEST FIXTURE: hypothetical platform-borne fee'}}
const snapshot=calculateOrder([
  {id:'a1',sellerId:'test-seller-a',title:'Example A1',unitPriceMinor:10000,discountBps:1000,commissionBps:3000,planVersion:1},
  {id:'a2',sellerId:'test-seller-a',title:'Example A2',unitPriceMinor:5000,commissionBps:3000,planVersion:1},
  {id:'b1',sellerId:'test-seller-b',title:'Example B1',unitPriceMinor:10000,commissionBps:2000,planVersion:1}
],policy)
const total=snapshot.sellerPayableMinor+snapshot.platformRevenueMinor+snapshot.gatewayFeeMinor+snapshot.taxMinor
if(total!==snapshot.totalMinor)throw new Error('Reconciliation example does not balance')
const example={evidenceType:'PURE_CALCULATION_TEST_ONLY',productionPayment:false,currency:'INR',unit:'paise',snapshot,hash:financialHash(snapshot),identity:{customer:snapshot.totalMinor,seller:snapshot.sellerPayableMinor,platform:snapshot.platformRevenueMinor,fees:snapshot.gatewayFeeMinor,tax:snapshot.taxMinor,balanced:true},refundExample:{lineId:'a1',cumulative:refundCumulative(snapshot.lines[0],3000)}}
const folder=fileURLToPath(new URL('../../docs/evidence/phase-d/',import.meta.url));await fs.mkdir(folder,{recursive:true});await fs.writeFile(folder+'reconciliation.json',JSON.stringify(example,null,2)+'\n')
console.log('Wrote deterministic test-only reconciliation evidence; no database or payment service was contacted.')
