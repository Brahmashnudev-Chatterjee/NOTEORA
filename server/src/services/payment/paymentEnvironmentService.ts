export type GatewayEnvironment='live'|'sandbox'
export function getGatewayEnvironment():GatewayEnvironment { return process.env.UPI_GATEWAY_ENV?.toLowerCase()==='live'?'live':'sandbox' }
export function getGatewayCredentials() { const env=getGatewayEnvironment(); return { environment:env,baseUrl:(process.env.UPI_GATEWAY_URL||'').replace(/\/$/,''),apiKey:process.env[`UPI_GATEWAY_${env.toUpperCase()}_API_KEY`]||'',apiSecret:process.env[`UPI_GATEWAY_${env.toUpperCase()}_API_SECRET`]||'',webhookSecret:process.env[`UPI_GATEWAY_${env.toUpperCase()}_WEBHOOK_SECRET`]||'' } }
