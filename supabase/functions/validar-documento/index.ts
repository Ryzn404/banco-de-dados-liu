// Edge Function: valida CPF ou CNPJ (numérico ou alfanumérico) e devolve o valor normalizado e formatado.
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
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(cpf[i]) * (len + 1 - i);
    return (soma * 10) % 11 % 10;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

// CNPJ alfanumérico (IN RFB 2.229/2024): valor de cada caractere = código ASCII - 48
// ("0".."9" -> 0..9, "A" -> 17 ... "Z" -> 42). Para CNPJs só com números o resultado é o mesmo de antes.
function validaCNPJ(cnpj: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const resto = [...base].reduce((soma, c, i) => soma + (c.charCodeAt(0) - 48) * pesos[i], 0) % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const dv1 = dv(cnpj.slice(0, 12));
  const dv2 = dv(cnpj.slice(0, 12) + dv1);
  return cnpj.endsWith(`${dv1}${dv2}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Exige usuário autenticado. A chave pública vem no cabeçalho "apikey" enviado pelo supabase-js.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return json({ error: "Não autenticado" }, 401);

  let documento = "";
  try {
    ({ documento = "" } = await req.json());
  } catch {
    return json({ error: "Corpo JSON inválido" }, 400);
  }

  const valor = String(documento).toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (/^\d{11}$/.test(valor)) {
    const valido = validaCPF(valor);
    return json({
      valido,
      tipo: "CPF",
      valor,
      formatado: valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"),
      mensagem: valido ? "CPF válido" : "CPF inválido",
    });
  }
  if (valor.length === 14) {
    const valido = validaCNPJ(valor);
    return json({
      valido,
      tipo: "CNPJ",
      valor,
      formatado: valor.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\w{2})$/, "$1.$2.$3/$4-$5"),
      mensagem: valido ? "CNPJ válido" : "CNPJ inválido",
    });
  }
  return json({ valido: false, tipo: null, valor, formatado: documento, mensagem: "Informe 11 dígitos (CPF) ou 14 caracteres (CNPJ)" });
});
