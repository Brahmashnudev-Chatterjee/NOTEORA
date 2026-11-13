export function reportingBoundaries(now=new Date()){
  const local=new Date(now.getTime()+19800000),y=local.getUTCFullYear(),m=local.getUTCMonth(),d=local.getUTCDate()
  const ist=(year:number,month:number,day:number)=>new Date(Date.UTC(year,month,day)-19800000)
  return {daily:{from:ist(y,m,d),to:ist(y,m,d+1)},monthly:{from:ist(y,m,1),to:ist(y,m+1,1)},annual:{from:ist(y,0,1),to:ist(y+1,0,1)},seriesFrom:ist(y,m-11,1)}
}
