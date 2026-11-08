import fs from 'node:fs'
import path from 'node:path'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/noteora'
const outputDir = process.argv[2] || (path.basename(process.cwd()) === 'server' ? path.resolve('../database/export') : path.resolve('database/export'))
const collections = ['users','categories','materials','carts','orders','paymentwebhookevents','reviews','sellerledgers','subscriptionplans','subscriptions','notifications','adminaudits','supporttickets','usersessions','activitylogs','refunds']

fs.mkdirSync(outputDir, { recursive: true })
const client = new MongoClient(uri)
await client.connect()
const db = client.db()
for (const collectionName of collections) {
  const rows = await db.collection(collectionName).find({}).toArray()
  fs.writeFileSync(path.join(outputDir, `${collectionName}.json`), JSON.stringify(rows, (_key, value) => value instanceof Date ? value.toISOString() : value, 2))
  console.log(`${collectionName}: ${rows.length}`)
}
await client.close()
console.log(`MongoDB export written to ${path.resolve(outputDir)}`)
console.log('Existing MongoDB records were not modified.')
