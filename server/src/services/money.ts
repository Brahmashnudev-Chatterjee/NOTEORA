// Money is stored as safe integer paise. BigInt is used for intermediate products.
export function integer(value: number, name='amount', signed=false): number {
  if (!Number.isSafeInteger(value) || (!signed && value < 0)) throw new Error(`Invalid ${name}`)
  return value
}
export function toMinor(value: string | number): number {
  const text=String(value)
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error('Money must have at most two decimal places')
  const [whole,part='']=text.split('.')
  return integer(Number(BigInt(whole)*100n+BigInt(part.padEnd(2,'0'))))
}
export function decimal(minor: number): string {
  integer(minor,'amount',true)
  const value=BigInt(minor),negative=value<0n,absolute=negative?-value:value
  return `${negative?'-':''}${absolute/100n}.${String(absolute%100n).padStart(2,'0')}`
}
export function sum(values:number[]):number { return integer(Number(values.reduce((n,v)=>n+BigInt(integer(v,'amount',true)),0n)),'sum',true) }
export function ratio(amount:number,numerator:number,denominator:number):number {
  integer(amount);integer(numerator);integer(denominator)
  if(!denominator)throw new Error('Invalid denominator')
  const product=BigInt(amount)*BigInt(numerator),divisor=BigInt(denominator)
  return integer(Number((product+divisor/2n)/divisor))
}
export function bps(value:number):number { integer(value,'rate');if(value>10000)throw new Error('Rate exceeds 100%');return value }
// Deterministic largest-remainder allocation; input ordering breaks equal ties.
export function allocate(total:number,weights:number[]):number[] {
  integer(total);weights.forEach(w=>integer(w));const denominator=sum(weights)
  if(!denominator){if(total)throw new Error('Cannot allocate to zero weights');return weights.map(()=>0)}
  const rows=weights.map((w,i)=>{const p=BigInt(total)*BigInt(w);return {i,value:Number(p/BigInt(denominator)),remainder:p%BigInt(denominator)}})
  let remaining=total-sum(rows.map(x=>x.value))
  for(const row of [...rows].sort((a,b)=>a.remainder===b.remainder?a.i-b.i:a.remainder>b.remainder?-1:1)){if(!remaining)break;row.value++;remaining--}
  return rows.map(x=>x.value)
}
