// Edge Function: valida CPF/CNPJ (dígitos verificadores) e devolve o valor formatado.
// POST { "documento": "123.456.789-09" }
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function validaCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

function validaCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const pesos = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(cnpj[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Exige usuário autenticado
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Não autenticado" }, 401);

  let documento = "";
  try {
    ({ documento = "" } = await req.json());
  } catch {
    return json({ error: "Corpo JSON inválido" }, 400);
  }

  const digitos = String(documento).replace(/\D/g, "");
  if (digitos.length === 11) {
    const valido = validaCPF(digitos);
    return json({
      valido,
      tipo: "CPF",
      formatado: digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
      mensagem: valido ? "CPF válido" : "CPF inválido",
    });
  }
  if (digitos.length === 14) {
    const valido = validaCNPJ(digitos);
    return json({
      valido,
      tipo: "CNPJ",
      formatado: digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"),
      mensagem: valido ? "CNPJ válido" : "CNPJ inválido",
    });
  }
  return json({ valido: false, tipo: null, formatado: documento, mensagem: "Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ)" });
});
