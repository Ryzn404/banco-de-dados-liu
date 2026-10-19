// Edge Function: indicadores do painel (executa com as permissões do usuário logado).
// As somas são feitas no banco (função SQL resumo_dashboard), sem o limite de 1000 linhas por consulta.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authorization = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data: { user } } = await supabase.auth.getUser(authorization.replace(/^Bearer\s+/i, ""));
  if (!user) return json({ error: "Não autenticado" }, 401);

  const { data, error } = await supabase.rpc("resumo_dashboard");
  if (error) return json({ error: error.message }, 500);

  return json({ ...data, geradoEm: new Date().toISOString() });
});
