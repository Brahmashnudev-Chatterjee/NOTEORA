import mongoose, {type ClientSession} from 'mongoose'
export async function atomic<T>(work:(session:ClientSession)=>Promise<T>):Promise<T>{
  for(let attempt=0;;attempt++){
    const session=await mongoose.startSession()
    try{
      let result:T
      await session.withTransaction(async()=>{result=await work(session)}, {readConcern:{level:'snapshot'},writeConcern:{w:'majority'}})
      return result!
    }catch(error:any){
      if(error.code===11000&&attempt<3)continue
      if(error.code===20||error.codeName==='IllegalOperation')throw Object.assign(new Error('Atomic financial and upload operations require a MongoDB replica set'),{status:503})
      throw error
    }finally{await session.endSession()}
  }
}
