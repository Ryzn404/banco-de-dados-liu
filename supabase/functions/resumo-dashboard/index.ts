// Edge Function: indicadores do painel (executa com as permissões do usuário logado).
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Não autenticado" }, 401);

  const [clientes, obras, notas] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    supabase.from("obras").select("id, data_inicio, previsao_termino"),
    supabase.from("notas_fiscais").select("valor_total, data_emissao"),
  ]);
  const erro = clientes.error ?? obras.error ?? notas.error;
  if (erro) return json({ error: erro.message }, 500);

  const hoje = new Date().toISOString().slice(0, 10);
  const listaObras = obras.data ?? [];
  const obrasAndamento = listaObras.filter((o) =>
    o.data_inicio <= hoje && (!o.previsao_termino || o.previsao_termino >= hoje)
  ).length;
  const obrasAtrasadasOuConcluidas = listaObras.filter((o) => o.previsao_termino && o.previsao_termino < hoje).length;
  const obrasFuturas = listaObras.filter((o) => o.data_inicio > hoje).length;

  const listaNotas = notas.data ?? [];
  const faturamentoTotal = listaNotas.reduce((s, n) => s + Number(n.valor_total), 0);

  // Faturamento dos últimos 6 meses (AAAA-MM)
  const porMes: Record<string, number> = {};
  const base = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    porMes[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
  }
  for (const n of listaNotas) {
    const mes = String(n.data_emissao).slice(0, 7);
    if (mes in porMes) porMes[mes] += Number(n.valor_total);
  }

  return json({
    totalClientes: clientes.count ?? 0,
    totalObras: listaObras.length,
    obrasAndamento,
    obrasPrazoVencido: obrasAtrasadasOuConcluidas,
    obrasFuturas,
    totalNotas: listaNotas.length,
    faturamentoTotal,
    faturamentoPorMes: Object.entries(porMes).map(([mes, valor]) => ({ mes, valor })),
    geradoEm: new Date().toISOString(),
  });
});
