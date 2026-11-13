#!/bin/sh
# Disposable, provider-free smoke verification of the exact E.2 images.
# No published ports, existing databases, preserved exports or production secrets.
set -eu
umask 077
run="noteora-e2-$(date +%s)-$$"
work=$(mktemp -d)
network="$run-net"
containers=""
cleanup() {
  for container in $containers; do docker rm -f -v "$container" >/dev/null 2>&1 || true; done
  docker network rm "$network" >/dev/null 2>&1 || true
  # Only files in this freshly created private temporary directory are removed.
  rm -f "$work/app.env" "$work/gateway.env" "$work/pg.env" "$work/container.log"
  rmdir "$work" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
secret() { od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; }
pg_secret=$(secret)
access_secret=$(secret)
refresh_secret=$(secret)
gateway_secret=$(secret)
encryption_secret=$(secret)
printf 'POSTGRES_PASSWORD=%s\nPOSTGRES_DB=noteora_e2_development\n' "$pg_secret" > "$work/pg.env"
printf 'NODE_ENV=development\nCLIENT_URL=http://localhost:5173\nJWT_ACCESS_SECRET=%s\nJWT_REFRESH_SECRET=%s\nMONGO_URI=mongodb://e2-mongo:27017/noteora_e2_development\nDATABASE_URL=postgresql://postgres:%s@e2-postgres:5432/noteora_e2_development?schema=marketplace\nREDIS_URL=redis://e2-redis:6379\n' "$access_secret" "$refresh_secret" "$pg_secret" > "$work/app.env"
printf 'NODE_ENV=development\nPORT=5100\nGATEWAY_CLIENT_URL=http://localhost:5173\nGATEWAY_JWT_SECRET=%s\nGATEWAY_WEBHOOK_ENCRYPTION_KEY=%s\nMARKETPLACE_AUTH_URL=http://marketplace-api:5000\nDATABASE_URL=postgresql://postgres:%s@e2-postgres:5432/noteora_e2_development?schema=gateway\nGATEWAY_REDIS_URL=redis://e2-redis:6379/1\n' "$gateway_secret" "$encryption_secret" "$pg_secret" > "$work/gateway.env"
docker network create "$network" >/dev/null
start() {
  name="$run-$1"; shift
  containers="$containers $name"
  docker run -d --name "$name" --network "$network" "$@" >/dev/null
}
wait_url() {
  container=$1; url=$2
  for attempt in $(seq 1 120); do
    if docker exec "$container" wget -q -O /dev/null "$url" 2>/dev/null; then return 0; fi
    sleep 2
  done
  echo 'FAIL: container endpoint did not become ready' >&2; return 1
}
start pg --network-alias e2-postgres --env-file "$work/pg.env" noteora-postgres:e2
start redis --network-alias e2-redis noteora-redis:e2
start mongo --network-alias e2-mongo noteora-mongo:e2
start api --network-alias marketplace-api --env-file "$work/app.env" --cap-drop ALL --security-opt no-new-privileges:true noteora-server:e2
start gateway --network-alias gateway-api --env-file "$work/gateway.env" --cap-drop ALL --security-opt no-new-privileges:true noteora-gateway:e2
wait_url "$run-api" http://127.0.0.1:5000/api/live
wait_url "$run-gateway" http://127.0.0.1:5100/api/live
test "$(docker exec "$run-api" id -u)" = 1000
test "$(docker exec "$run-gateway" id -u)" = 1000
docker exec "$run-api" sh -c 'test ! -e /usr/local/bin/npm && test ! -e /usr/local/bin/corepack'
docker exec "$run-gateway" sh -c 'test ! -e /usr/local/bin/npm && test ! -e /usr/local/bin/corepack'
echo 'PASS: API liveness, non-root UID and absent runtime package managers'
test "$(docker exec "$run-redis" redis-cli ping)" = PONG
docker exec "$run-mongo" mongosh --quiet --eval 'if(db.runCommand({ping:1}).ok!==1)quit(1)' >/dev/null
echo 'PASS: isolated Redis and MongoDB startup'
docker exec -i "$run-api" node --input-type=module <<'NODE'
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const headers={'Content-Type':'application/json',Origin:'http://localhost:5173','X-Noteora-CSRF':'1'};
const email='container-'+crypto.randomUUID()+'@example.com',password=crypto.randomBytes(20).toString('hex')+'Aa1!';
const post=(route,body)=>fetch('http://127.0.0.1:5000/api/v1/auth/'+route,{method:'POST',headers,body:JSON.stringify(body)});
const response=await post('register',{name:'Disposable container fixture',email,password,acceptedTerms:true});
if(response.status!==201)throw Error('Container registration status '+response.status);
const account=await response.json();
if(account.user.verified||account.verificationDelivery!=='submitted-to-adapter'||account.emailTransport!=='development')throw Error('Development adapter registration invariant failed');
const directory=await fs.stat('.dev-mail');
if((directory.mode&0o777)!==0o700)throw Error('Development mailbox directory is not private');
const files=await fs.readdir('.dev-mail');let token;
for(const file of files){
 const entry=await fs.stat('.dev-mail/'+file);
 if((entry.mode&0o777)!==0o600)throw Error('Development mail file is not private');
 const mail=JSON.parse(await fs.readFile('.dev-mail/'+file,'utf8'));
 if(mail.to===email)token=new URL(mail.text).hash.slice('#token='.length);
}
if(!token||(await post('verify',{token})).status!==200||(await post('verify',{token})).status!==400)throw Error('Container verification/reuse check failed');
if((await post('login',{email,password})).status!==200)throw Error('Container login failed');
console.log('PASS: container registration, private development mail, verification/reuse and login; no SMTP sent');
NODE
docker exec "$run-mongo" mongosh --nodb --quiet --eval "load('/js-yaml.js'); if(jsyaml.load('safe: true').safe!==true)quit(1)" >/dev/null
docker exec "$run-mongo" mongosh --quiet --eval 'db.getSiblingDB("e2_source").fixture.insertOne({n:1})' >/dev/null
docker exec "$run-mongo" mongodump --quiet --db=e2_source --archive=/tmp/e2-fixture.archive >/dev/null
docker exec "$run-mongo" mongorestore --quiet --archive=/tmp/e2-fixture.archive --nsFrom='e2_source.*' --nsTo='e2_restore.*' >/dev/null
docker exec "$run-mongo" mongosh --quiet --eval 'if(db.getSiblingDB("e2_restore").fixture.countDocuments({n:1})!==1)quit(1)' >/dev/null
echo 'PASS: patched runtime YAML parser and synthetic MongoDB dump/restore'
start marketplace-worker --env-file "$work/app.env" --cap-drop ALL --security-opt no-new-privileges:true noteora-server:e2 node dist/workers/index.js
start gateway-worker --env-file "$work/gateway.env" --cap-drop ALL --security-opt no-new-privileges:true noteora-gateway:e2 node dist/workerMain.js
for attempt in $(seq 1 120); do
  if docker exec "$run-marketplace-worker" test -s /tmp/noteora-marketplace-worker-health && docker exec "$run-gateway-worker" test -s /tmp/noteora-gateway-worker-health; then break; fi
  sleep 2
done
docker exec "$run-marketplace-worker" test -s /tmp/noteora-marketplace-worker-health
docker exec "$run-gateway-worker" test -s /tmp/noteora-gateway-worker-health
echo 'PASS: both worker heartbeats (Redis; gateway also checks PostgreSQL)'
start web --cap-drop ALL --security-opt no-new-privileges:true noteora-web:e2
wait_url "$run-web" http://127.0.0.1:8080/healthz
test "$(docker exec "$run-web" id -u)" = 101
docker exec "$run-web" wget -q -O /dev/null http://127.0.0.1:8080/api/live
docker exec "$run-web" wget -q -O /dev/null http://127.0.0.1:8080/gateway-api/live
echo 'PASS: non-root web health and marketplace/gateway proxy routes'
for container in $containers; do
  docker logs "$container" > "$work/container.log" 2>&1
  for token in "$pg_secret" "$access_secret" "$refresh_secret" "$gateway_secret" "$encryption_secret"; do
    if grep -Fq "$token" "$work/container.log"; then echo 'FAIL: fixture secret appeared in container logs' >&2; exit 1; fi
  done
done
echo 'PASS: generated deployment fixture secrets absent from collected container logs'
for suffix in api gateway marketplace-worker gateway-worker; do
  docker stop --time 30 "$run-$suffix" >/dev/null
  test "$(docker inspect --format '{{.State.ExitCode}}' "$run-$suffix")" = 0
done
echo 'PASS: APIs and workers stopped gracefully with exit code zero'
echo 'Disposable container smoke checks passed; cleanup follows. No migrations or providers invoked.'
