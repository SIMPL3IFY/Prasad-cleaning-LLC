// Security fix: the notify-* functions send customer emails, so only the Supabase Database
// Webhook may call them. The webhook sends WEBHOOK_SECRET in the x-webhook-secret header.
// Fails closed: if the secret isn't configured, every request is rejected.
export function isFromWebhook(req: Request): boolean {
  const secret = Deno.env.get("WEBHOOK_SECRET") ?? ""
  return secret.length > 0 && req.headers.get("x-webhook-secret") === secret
}

export const unauthorized = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
