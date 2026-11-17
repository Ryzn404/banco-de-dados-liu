import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, LOGIN_DOMAIN, BUCKET, TIMEZONE } from "./config.js";
import { digits, alnum, maskDoc, maskPhone, maskMoney, moneyToNumber, numberToMoney, today, fmtDate, fmtBRL } from "./formatos.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PAGE_SIZE = 50; // linhas por página nas tabelas
const FETCH_SIZE = 1000; // linhas por consulta (o Supabase devolve no máximo 1000 por vez)
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const state = {
  clientes: [],
  obras: [],
  notas: [],
  dash: null,
  loaded: false,
  tab: "dashboard",
  search: { clientes: "", obras: "", notas: "" },
  filtro: { clientes: "ativos", obras: "todas", notas: "todas" },
  page: { clientes: 1, obras: 1, notas: 1 },
  explorerPath: [],
};
let channel = null;

// ---------------------------------------------------------------- utilidades
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const fmtSize = (b) => (b == null ? "" : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);
// R$1,9 mil (mesmo formato sem espaço do resto do app)
const fmtCompact = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0).replace(/^R\$\s/u, "R$");
const safeName = (n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]/g, "_");
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const telHref = (tel) => `tel:+55${digits(tel)}`;

// diferença em dias entre duas datas AAAA-MM-DD
const dias = (de, ate) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);

function applyMask(input, mask) {
  input.value = mask(input.value);
  input.addEventListener("input", () => (input.value = mask(input.value)));
}

function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 3500);
}

function confirmDialog(text, { title = "Confirmar", ok = "Excluir", danger = true, cancel = "Cancelar" } = {}) {
  return new Promise((resolve) => {
    const dlg = $("#confirm-dialog"), yes = $("#confirm-yes"), no = $("#confirm-no");
    $("#confirm-title").textContent = title;
    $("#confirm-text").textContent = text;
    yes.textContent = ok;
    yes.className = `btn ${danger ? "danger" : "primary"}`;
    no.textContent = cancel ?? "";
    no.hidden = !cancel;
    const done = (v) => { dlg.close(); yes.onclick = no.onclick = dlg.oncancel = null; resolve(v); };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
    dlg.oncancel = () => done(false); // tecla Esc
    dlg.showModal();
  });
}

// Mensagens amigáveis para os erros do banco
const MENSAGENS_CHECK = {
  clientes_cpf_cnpj_valido: "CPF/CNPJ inválido.",
  clientes_telefone_valido: "Telefone inválido: informe DDD + 8 ou 9 dígitos.",
  obras_datas_chk: "A previsão de término deve ser posterior à data de início.",
};
function friendlyError(error) {
  const msg = error?.message ?? String(error);
  switch (error?.code) {
    case "23505":
      if (msg.includes("cpf_cnpj")) return "Já existe um cliente com este CPF/CNPJ.";
      if (msg.includes("numero")) return "Já existe uma nota fiscal com este número.";
      return "Registro duplicado.";
    case "23514": return Object.entries(MENSAGENS_CHECK).find(([k]) => msg.includes(k))?.[1] ?? "Dados inválidos.";
    case "23503": return "Não é possível excluir: existem notas fiscais vinculadas.";
    case "42501": return "Sem permissão para esta operação.";
    default: return msg;
  }
}

// Executa insert/update/delete e confirma que alguma linha foi de fato afetada
async function mutate(query) {
  const { data, error } = await query.select("id");
  if (error) throw new Error(friendlyError(error));
  if (!data?.length) throw new Error("Nada foi alterado: sem permissão ou registro inexistente.");
  return data;
}

// ---------------------------------------------------------------- regras de exibição
const obraNome = (o) => o?.servicos?.split("\n")[0] || o?.endereco || "Obra sem descrição";
const clientesAtivos = () => state.clientes.filter((c) => !c.arquivado);
const clienteDe = (id) => state.clientes.find((c) => c.id === id);

function obraStatus(o) {
  const h = today();
  if (o.data_inicio > h) return { key: "agendada", label: "Agendada", cls: "info" };
  if (o.previsao_termino && o.previsao_termino < h) return { key: "vencido", label: "Prazo vencido", cls: "bad" };
  return { key: "andamento", label: "Em andamento", cls: "ok" };
}

function prazoTexto(o) {
  const h = today(), st = obraStatus(o);
  if (st.key === "agendada") return { txt: `começa em ${plural(dias(h, o.data_inicio), "dia", "dias")}` };
  if (!o.previsao_termino) return { txt: "sem previsão" };
  const n = dias(h, o.previsao_termino);
  if (n < 0) return { txt: `venceu há ${plural(-n, "dia", "dias")}`, bad: true };
  if (n === 0) return { txt: "termina hoje" };
  return { txt: `faltam ${plural(n, "dia", "dias")}` };
}

// ---------------------------------------------------------------- autenticação
const isAdmin = (session) => session?.user?.app_metadata?.role === "admin";

function loginError(msg) {
  const err = $("#login-error");
  err.textContent = msg;
  err.hidden = !msg;
}

async function login(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const usuario = String(f.get("usuario")).trim();
  const email = usuario.includes("@") ? usuario : `${usuario.toLowerCase()}@${LOGIN_DOMAIN}`;
  const btn = $("button[type=submit]", e.target);
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(f.get("senha")) });
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
  if (error) loginError(error.message === "Invalid login credentials" ? "Usuário ou senha inválidos." : error.message);
}

async function showApp(session) {
  if (!isAdmin(session)) {
    // O papel pode ter sido atribuído depois do login: renova o token para ler as permissões atuais
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !isAdmin(data.session)) {
      await supabase.auth.signOut();
      loginError(error ? `Não foi possível verificar as permissões: ${error.message}` : "Este usuário não tem permissão de acesso.");
      return;
    }
    session = data.session;
  }
  loginError("");
  $("#login-view").hidden = true;
  $("#app-view").hidden = false;
  const nome = session.user.user_metadata?.username ?? session.user.email;
  $$("[data-user-label]").forEach((el) => (el.textContent = nome));
  $$("[data-avatar]").forEach((el) => (el.textContent = nome.slice(0, 1)));
  switchTab(tabFromHash());
  renderAll();
  await loadAll();
  loadDashboard();
  subscribeRealtime();
}

function showLogin() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
  state.loaded = false;
  state.dash = null;
  $("#app-view").hidden = true;
  $("#login-view").hidden = false;
}

// ---------------------------------------------------------------- dados
// Busca todas as linhas em lotes, para nenhuma lista ser cortada no limite de 1000
async function fetchAll(table, columns, orderBy) {
  const rows = [];
  for (;;) {
    let q = supabase.from(table).select(columns, { count: "exact" });
    for (const [col, ascending] of orderBy) q = q.order(col, { ascending });
    const { data, error, count } = await q.order("id").range(rows.length, rows.length + FETCH_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (!data.length || rows.length >= count) return rows;
  }
}

async function loadAll() {
  try {
    [state.clientes, state.obras, state.notas] = await Promise.all([
      fetchAll("clientes", "*", [["nome", true]]),
      fetchAll("obras", "*, clientes(nome, endereco, telefone)", [["data_inicio", false]]),
      fetchAll("notas_fiscais", "*, clientes(nome), obras(servicos, endereco)", [["data_emissao", false]]),
    ]);
    state.loaded = true;
  } catch (e) {
    toast(friendlyError(e), "err");
  }
  renderAll();
}

// ---------------------------------------------------------------- blocos de tabela
const match = (q, ...vals) => !q || vals.some((v) => String(v ?? "").toLowerCase().includes(q));

const skeletonRows = (cols, n = 5) => Array.from({ length: n }, () =>
  `<tr aria-hidden="true">${Array.from({ length: cols }, (_, i) =>
    `<td class="${i === 0 ? "cell-main" : ""}"><span class="sk" style="width:${i === 0 ? 60 : 30 + ((i * 17) % 40)}%"></span></td>`).join("")}</tr>`).join("");

function emptyBlock({ ic, title, text, action }) {
  return `<div class="empty"><span class="ic-wrap">${icon(ic)}</span><strong>${esc(title)}</strong><p>${esc(text)}</p>${action ?? ""}</div>`;
}
const emptyRow = (cols, opts) => `<tr class="empty-row"><td class="empty-cell" colspan="${cols}">${emptyBlock(opts)}</td></tr>`;
const clearBtn = (entity) => `<button class="btn" data-clear="${entity}">Limpar busca e filtros</button>`;
const newBtn = (entity, label) => `<button class="btn primary" data-new="${entity}">${icon("plus")}${label}</button>`;

function renderChips(entity, items) {
  $(`[data-chips="${entity}"]`).innerHTML = items.map((it) =>
    `<button class="chip" data-filter="${entity}" data-value="${it.key}" aria-pressed="${state.filtro[entity] === it.key}">${it.label}<span class="n">${it.n}</span></button>`).join("");
}

function rowActions(entity, r) {
  const tel = entity === "clientes" ? r.telefone : entity === "obras" ? r.clientes?.telefone : null;
  const call = tel ? `<a class="act call" href="${telHref(tel)}">${icon("phone")}<span class="lbl">Ligar</span></a>` : "";
  const arch = entity === "clientes"
    ? `<button class="act arch desk-only" data-archive="${r.arquivado ? "0" : "1"}" data-id="${r.id}" title="${r.arquivado ? "Desarquivar" : "Arquivar"}">${icon(r.arquivado ? "unarchive" : "archive")}<span class="lbl">${r.arquivado ? "Desarquivar" : "Arquivar"}</span></button>`
    : "";
  // No celular, arquivar e excluir ficam no "Mais", longe do polegar
  return `<div class="row-actions">${call}
    <button class="act" data-files="${entity}" data-id="${r.id}" title="Arquivos">${icon("arquivos")}<span class="lbl">Arquivos</span></button>
    <button class="act" data-edit="${entity}" data-id="${r.id}" title="Editar">${icon("edit")}<span class="lbl">Editar</span></button>
    ${arch}
    <button class="act del desk-only" data-del="${entity}" data-id="${r.id}" title="Excluir">${icon("trash")}<span class="lbl">Excluir</span></button>
    <button class="act mobile-only" data-mais="${entity}" data-id="${r.id}">${icon("more")}<span class="lbl">Mais</span></button></div>`;
}

// Recorta a página atual e desenha o paginador da tabela
function paginate(entity, rows) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, state.page[entity]), pages);
  state.page[entity] = page;
  const start = (page - 1) * PAGE_SIZE;
  const pager = $(`[data-pager="${entity}"]`);
  pager.hidden = rows.length <= PAGE_SIZE;
  pager.innerHTML = `
    <span class="info">${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} de ${rows.length}</span>
    <button class="btn" data-page="${entity}" data-dir="-1" ${page === 1 ? "disabled" : ""}>Anterior</button>
    <button class="btn" data-page="${entity}" data-dir="1" ${page === pages ? "disabled" : ""}>Próxima</button>`;
  return rows.slice(start, start + PAGE_SIZE);
}

// ---------------------------------------------------------------- clientes
function renderClientes() {
  const ativos = clientesAtivos(), arquivados = state.clientes.filter((c) => c.arquivado);
  renderChips("clientes", [
    { key: "ativos", label: "Ativos", n: ativos.length },
    { key: "arquivados", label: "Arquivados", n: arquivados.length },
    { key: "todos", label: "Todos", n: state.clientes.length },
  ]);
  $('[data-summary="clientes"]').textContent = state.loaded ? `${plural(ativos.length, "cliente ativo", "clientes ativos")}${arquivados.length ? ` · ${arquivados.length} arquivado(s)` : ""}` : "Carregando…";
  const tb = $("#tb-clientes");
  tb.closest("table").setAttribute("aria-busy", String(!state.loaded));
  if (!state.loaded) { tb.innerHTML = skeletonRows(5); return; }

  const base = { ativos, arquivados, todos: state.clientes }[state.filtro.clientes];
  const q = state.search.clientes;
  const rows = paginate("clientes", base.filter((c) => match(q, c.nome, c.cpf_cnpj, maskDoc(c.cpf_cnpj), c.telefone, maskPhone(c.telefone), c.endereco)));
  if (!rows.length) {
    tb.innerHTML = !state.clientes.length
      ? emptyRow(5, { ic: "clientes", title: "Nenhum cliente ainda", text: "Cadastre o primeiro cliente para começar a lançar obras e notas fiscais.", action: newBtn("clientes", "Novo cliente") })
      : emptyRow(5, { ic: "search", title: q ? `Nada encontrado para “${q}”` : "Nenhum cliente neste filtro", text: "Confira a busca ou veja todos os clientes.", action: clearBtn("clientes") });
    return;
  }
  tb.innerHTML = rows.map((c) => `
    <tr data-row="${c.id}" class="${c.arquivado ? "archived" : ""}">
      <td class="cell-main"><div class="cell-title">${esc(c.nome)} ${c.arquivado ? `<span class="badge">Arquivado</span>` : ""}</div></td>
      <td data-label="CPF/CNPJ" class="nowrap">${esc(maskDoc(c.cpf_cnpj))}</td>
      <td data-label="Telefone">${c.telefone ? `<a class="tel" href="${telHref(c.telefone)}">${esc(maskPhone(c.telefone))}</a>` : `<span class="muted">—</span>`}</td>
      <td data-label="Endereço"><span class="clip" title="${esc(c.endereco)}">${esc(c.endereco) || "—"}</span></td>
      <td class="col-actions">${rowActions("clientes", c)}</td>
    </tr>`).join("");
}

// ---------------------------------------------------------------- obras
function renderObras() {
  const conta = { todas: state.obras.length, andamento: 0, vencido: 0, agendada: 0 };
  state.obras.forEach((o) => conta[obraStatus(o).key]++);
  renderChips("obras", [
    { key: "todas", label: "Todas", n: conta.todas },
    { key: "andamento", label: "Em andamento", n: conta.andamento },
    { key: "vencido", label: "Prazo vencido", n: conta.vencido },
    { key: "agendada", label: "Agendadas", n: conta.agendada },
  ]);
  $('[data-summary="obras"]').textContent = state.loaded
    ? `${plural(conta.andamento, "obra em andamento", "obras em andamento")}${conta.vencido ? ` · ${conta.vencido} com prazo vencido` : ""}`
    : "Carregando…";
  const tb = $("#tb-obras");
  tb.closest("table").setAttribute("aria-busy", String(!state.loaded));
  if (!state.loaded) { tb.innerHTML = skeletonRows(6); return; }

  const q = state.search.obras, f = state.filtro.obras;
  const rows = paginate("obras", state.obras.filter((o) => (f === "todas" || obraStatus(o).key === f) && match(q, o.clientes?.nome, o.endereco, o.servicos)));
  if (!rows.length) {
    tb.innerHTML = !state.obras.length
      ? emptyRow(6, { ic: "obras", title: "Nenhuma obra ainda", text: "Cadastre uma obra para acompanhar prazos e vincular notas fiscais.", action: newBtn("obras", "Nova obra") })
      : emptyRow(6, { ic: "search", title: q ? `Nada encontrado para “${q}”` : "Nenhuma obra neste filtro", text: "Confira a busca ou veja todas as obras.", action: clearBtn("obras") });
    return;
  }
  tb.innerHTML = rows.map((o) => {
    const st = obraStatus(o), pz = prazoTexto(o);
    return `
    <tr data-row="${o.id}">
      <td class="cell-main"><div class="cell-title">${esc(obraNome(o))}</div><div class="cell-sub">${esc(o.clientes?.nome)}</div></td>
      <td data-label="Endereço"><span class="clip" title="${esc(o.endereco)}">${esc(o.endereco) || "—"}</span></td>
      <td data-label="Início" class="nowrap">${fmtDate(o.data_inicio)}</td>
      <td data-label="Previsão"><div><div class="nowrap">${fmtDate(o.previsao_termino)}</div><div class="cell-sub ${pz.bad ? "bad-text" : ""}">${pz.txt}</div></div></td>
      <td data-label="Situação"><span class="badge ${st.cls}">${st.label}</span></td>
      <td class="col-actions">${rowActions("obras", o)}</td>
    </tr>`;
  }).join("");
}

// ---------------------------------------------------------------- notas fiscais
function periodoNota(n, f) {
  const mes = today().slice(0, 7);
  if (f === "mes") return n.data_emissao.slice(0, 7) === mes;
  if (f === "trimestre") {
    const [a, m] = mes.split("-").map(Number);
    const ini = new Date(Date.UTC(a, m - 3, 1)).toISOString().slice(0, 7);
    return n.data_emissao.slice(0, 7) >= ini;
  }
  return true;
}

function renderNotas() {
  renderChips("notas", [
    { key: "todas", label: "Todas", n: state.notas.length },
    { key: "mes", label: "Este mês", n: state.notas.filter((n) => periodoNota(n, "mes")).length },
    { key: "trimestre", label: "Últimos 3 meses", n: state.notas.filter((n) => periodoNota(n, "trimestre")).length },
  ]);
  const q = state.search.notas, f = state.filtro.notas;
  const filtradas = state.notas.filter((n) => periodoNota(n, f) && match(q, n.numero, n.clientes?.nome, n.obras?.servicos, n.obras?.endereco));
  const soma = filtradas.reduce((s, n) => s + Number(n.valor_total), 0);
  $('[data-summary="notas"]').textContent = state.loaded ? `${plural(filtradas.length, "nota", "notas")} · ${fmtBRL(soma)}` : "Carregando…";
  const tb = $("#tb-notas");
  tb.closest("table").setAttribute("aria-busy", String(!state.loaded));
  if (!state.loaded) { tb.innerHTML = skeletonRows(6); return; }

  const rows = paginate("notas", filtradas);
  if (!rows.length) {
    tb.innerHTML = !state.notas.length
      ? emptyRow(6, { ic: "notas", title: "Nenhuma nota fiscal ainda", text: "Lance a primeira nota para acompanhar o faturamento no painel.", action: newBtn("notas", "Nova nota fiscal") })
      : emptyRow(6, { ic: "search", title: q ? `Nada encontrado para “${q}”` : "Nenhuma nota neste período", text: "Confira a busca ou veja todas as notas.", action: clearBtn("notas") });
    return;
  }
  tb.innerHTML = rows.map((n) => `
    <tr data-row="${n.id}">
      <td class="cell-main"><div class="cell-title">NF ${esc(n.numero)}</div></td>
      <td data-label="Emissão" class="nowrap">${fmtDate(n.data_emissao)}</td>
      <td data-label="Cliente">${esc(n.clientes?.nome)}</td>
      <td data-label="Obra"><span class="clip">${esc(n.obras ? obraNome(n.obras) : "—")}</span></td>
      <td data-label="Valor" class="num"><strong>${fmtBRL(n.valor_total)}</strong></td>
      <td class="col-actions">${rowActions("notas", n)}</td>
    </tr>`).join("");
}

// ---------------------------------------------------------------- painel (Edge Function + listas)
async function loadDashboard() {
  const { data, error } = await supabase.functions.invoke("resumo-dashboard", { method: "GET" });
  if (error) return toast(`Painel: ${error.message}`, "err");
  state.dash = data;
  renderPainel();
}

function kpi(label, value, foot = "", tone = "") {
  return `<div class="kpi"><span class="label">${label}</span><span class="value">${value}</span><span class="foot ${tone}">${foot}</span></div>`;
}

function renderPainel() {
  const hoje = new Date();
  $("#painel-sub").textContent = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "long" })
    .format(hoje).replace(/^./, (c) => c.toUpperCase());

  const d = state.dash;
  if (!d) {
    $("#kpis").innerHTML = Array.from({ length: 4 }, () => `<div class="kpi" aria-hidden="true"><span class="sk" style="width:50%"></span><span class="sk" style="width:70%;height:26px"></span><span class="sk" style="width:40%"></span></div>`).join("");
    $("#chart").innerHTML = `<span class="sk" style="height:160px"></span>`;
  } else {
    const meses = d.faturamentoPorMes;
    const atual = meses.at(-1), anterior = meses.at(-2);
    const nomeMes = (m) => MESES[Number(m.mes.slice(5)) - 1];
    $("#kpis").innerHTML = [
      kpi(`Faturado em ${nomeMes(atual)}`, fmtBRL(atual.valor), anterior ? `${fmtBRL(anterior.valor)} em ${nomeMes(anterior)}` : ""),
      kpi("Faturamento total", fmtBRL(d.faturamentoTotal), plural(d.totalNotas, "nota fiscal", "notas fiscais")),
      kpi("Obras em andamento", d.obrasAndamento, d.obrasPrazoVencido ? `${d.obrasPrazoVencido} com prazo vencido` : "Nenhum prazo vencido", d.obrasPrazoVencido ? "bad" : "ok"),
      kpi("Clientes ativos", d.totalClientes, plural(d.totalObras, "obra cadastrada", "obras cadastradas")),
    ].join("");

    const max = Math.max(1, ...meses.map((m) => Number(m.valor)));
    const curto = (m) => `${nomeMes(m).slice(0, 3)}`;
    $("#chart-range").textContent = `${curto(meses[0])} – ${curto(atual)} ${atual.mes.slice(0, 4)}`;
    $("#chart").setAttribute("role", "img");
    $("#chart").setAttribute("aria-label", `Faturamento por mês: ${meses.map((m) => `${nomeMes(m)} ${fmtBRL(m.valor)}`).join("; ")}`);
    $("#chart").innerHTML = `
      <div class="bars">${meses.map((m, i) => {
        const now = i === meses.length - 1;
        return `<div class="bar-col ${now ? "now" : ""}" title="${nomeMes(m)}: ${fmtBRL(m.valor)}">
          <span class="bar-val">${Number(m.valor) ? fmtCompact(m.valor) : ""}</span>
          <span class="bar ${now ? "now" : ""}" style="height:${(Number(m.valor) / max) * 82}%"></span></div>`;
      }).join("")}</div>
      <div class="bar-axis">${meses.map((m, i) => `<span class="${i === meses.length - 1 ? "now" : ""}">${curto(m)}</span>`).join("")}</div>`;
  }

  // Obras que pedem atenção: prazo vencido primeiro, depois as mais próximas do fim
  const box = $("#painel-obras");
  if (!state.loaded) box.innerHTML = `<ul class="mini">${Array.from({ length: 3 }, () => `<li><span class="sk" style="width:70%"></span></li>`).join("")}</ul>`;
  else {
    const ativas = state.obras.filter((o) => obraStatus(o).key !== "agendada")
      .sort((a, b) => (a.previsao_termino ?? "9999") .localeCompare(b.previsao_termino ?? "9999")).slice(0, 6);
    box.innerHTML = ativas.length
      ? `<div class="compact-wrap"><table class="data compact"><thead><tr><th>Obra</th><th>Cliente</th><th>Previsão</th><th>Situação</th></tr></thead><tbody>${ativas.map((o) => {
          const st = obraStatus(o), pz = prazoTexto(o);
          return `<tr data-row="${o.id}">
            <td class="cell-main"><div class="cell-title">${esc(obraNome(o))}</div><div class="cell-sub mobile-only-block">${esc(o.clientes?.nome)}</div></td>
            <td class="col-cliente">${esc(o.clientes?.nome)}</td>
            <td class="col-prev"><div class="nowrap prev-date">${fmtDate(o.previsao_termino)}</div><div class="cell-sub ${pz.bad ? "bad-text" : ""}">${pz.txt}</div></td>
            <td class="col-sit"><span class="badge ${st.cls}">${st.label}</span></td></tr>`;
        }).join("")}</tbody></table></div>`
      : emptyBlock({ ic: "obras", title: "Nenhuma obra em andamento", text: "As obras aparecem aqui assim que começam.", action: newBtn("obras", "Nova obra") });
  }

  const notasBox = $("#painel-notas");
  if (!state.loaded) notasBox.innerHTML = `<ul class="mini">${Array.from({ length: 3 }, () => `<li><span class="sk" style="width:60%"></span></li>`).join("")}</ul>`;
  else {
    const recentes = state.notas.slice(0, 5);
    notasBox.innerHTML = recentes.length
      ? `<ul class="mini">${recentes.map((n) => `<li><div class="grow"><div class="t">NF ${esc(n.numero)}</div><div class="s">${esc(n.clientes?.nome)}${n.obras ? ` · ${esc(obraNome(n.obras))}` : ""}</div></div>
          <span class="when">${fmtDate(n.data_emissao)}</span><span class="v">${fmtBRL(n.valor_total)}</span></li>`).join("")}</ul>`
      : emptyBlock({ ic: "notas", title: "Nenhuma nota fiscal ainda", text: "Lance a primeira nota para ver o faturamento aqui.", action: newBtn("notas", "Nova nota fiscal") });
  }
}

function renderCounts() {
  const set = (k, n) => $$(`[data-count="${k}"]`).forEach((el) => (el.textContent = state.loaded ? n : ""));
  set("clientes", clientesAtivos().length);
  set("obras", state.obras.length);
  set("notas", state.notas.length);
}

function renderAll() { renderClientes(); renderObras(); renderNotas(); renderPainel(); renderCounts(); }

// ---------------------------------------------------------------- formulários
// Clientes arquivados não aparecem nas opções, exceto o que já está selecionado
const clienteOptions = (sel) => state.clientes.filter((c) => !c.arquivado || c.id === sel)
  .map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.nome)}</option>`).join("");
const obraOptions = (clienteId, sel) => `<option value="">Sem obra vinculada</option>` + state.obras
  .filter((o) => o.cliente_id === clienteId)
  .map((o) => `<option value="${o.id}" ${o.id === sel ? "selected" : ""}>${esc(obraNome(o))} (${fmtDate(o.data_inicio)})</option>`).join("");

const forms = {
  clientes: {
    title: (r) => (r ? "Editar cliente" : "Novo cliente"),
    fields: (r = {}) => `
      <label class="field full">Nome<input name="nome" required autocomplete="off" value="${esc(r.nome)}" /></label>
      <label class="field">CPF/CNPJ<input name="cpf_cnpj" required maxlength="18" autocapitalize="characters" autocomplete="off" value="${esc(maskDoc(r.cpf_cnpj))}" placeholder="000.000.000-00" /></label>
      <label class="field">Telefone<input name="telefone" type="tel" inputmode="numeric" maxlength="15" value="${esc(maskPhone(r.telefone))}" placeholder="(71)9 2222-2222" /></label>
      <label class="field full">Endereço<input name="endereco" autocomplete="street-address" value="${esc(r.endereco)}" /></label>`,
    bind(form) {
      applyMask($("[name=cpf_cnpj]", form), maskDoc);
      applyMask($("[name=telefone]", form), maskPhone);
    },
    async payload(f) {
      const doc = alnum(f.get("cpf_cnpj"));
      if (doc.length !== 11 && doc.length !== 14) throw new Error("O CPF tem 11 dígitos e o CNPJ, 14 caracteres.");
      const tel = digits(f.get("telefone"));
      if (tel && tel.length !== 10 && tel.length !== 11) throw new Error("O telefone precisa de DDD + 8 ou 9 dígitos.");
      // Edge Function valida CPF/CNPJ e devolve o valor sem pontuação (o banco valida de novo)
      const { data, error } = await supabase.functions.invoke("validar-documento", { body: { documento: doc } });
      if (error) throw new Error(`Não foi possível validar o documento: ${error.message}`);
      if (!data.valido) throw new Error(`${data.mensagem}. Confira os números.`);
      return { nome: f.get("nome").trim(), cpf_cnpj: data.valor, telefone: tel || null, endereco: f.get("endereco").trim() || null };
    },
  },
  obras: {
    title: (r) => (r ? "Editar obra" : "Nova obra"),
    fields: (r = {}) => {
      const cid = r.cliente_id ?? clientesAtivos()[0]?.id;
      const cli = clienteDe(cid);
      const mesmo = !r.id || (cli && r.endereco === cli.endereco);
      return `
      <label class="field full">Cliente<select name="cliente_id" required>${clienteOptions(cid)}</select></label>
      <label class="check full"><input type="checkbox" name="mesmo_endereco" ${mesmo ? "checked" : ""} /> Mesmo endereço do cliente</label>
      <label class="field full">Endereço da obra<input name="endereco" value="${esc(mesmo ? cli?.endereco : r.endereco)}" ${mesmo ? "readonly" : ""} /></label>
      <label class="field">Data de início<input type="date" name="data_inicio" required value="${esc(r.data_inicio ?? today())}" /></label>
      <label class="field">Previsão de término<input type="date" name="previsao_termino" value="${esc(r.previsao_termino)}" /></label>
      <label class="field full">Serviços<textarea name="servicos" rows="3" placeholder="Ex.: reforma de cozinha, elétrica e pintura">${esc(r.servicos)}</textarea><span class="hint">A primeira linha vira o nome da obra nas listas.</span></label>`;
    },
    bind(form) {
      const sel = $("[name=cliente_id]", form), chk = $("[name=mesmo_endereco]", form), end = $("[name=endereco]", form);
      const sync = () => {
        end.readOnly = chk.checked;
        if (chk.checked) end.value = clienteDe(sel.value)?.endereco ?? "";
      };
      sel.onchange = chk.onchange = sync;
    },
    async payload(f) {
      const ini = f.get("data_inicio"), fim = f.get("previsao_termino") || null;
      if (fim && fim < ini) throw new Error("A previsão de término deve ser depois da data de início.");
      const cli = clienteDe(f.get("cliente_id"));
      return {
        cliente_id: f.get("cliente_id"),
        endereco: f.get("mesmo_endereco") ? cli?.endereco ?? null : f.get("endereco").trim() || null,
        data_inicio: ini, previsao_termino: fim, servicos: f.get("servicos").trim() || null,
      };
    },
  },
  notas: {
    title: (r) => (r ? "Editar nota fiscal" : "Nova nota fiscal"),
    fields: (r = {}) => {
      const cid = r.cliente_id ?? clientesAtivos()[0]?.id;
      return `
      <label class="field">Número da nota<input name="numero" required autocomplete="off" value="${esc(r.numero)}" /></label>
      <label class="field">Data de emissão<input type="date" name="data_emissao" required value="${esc(r.data_emissao ?? today())}" /></label>
      <label class="field full">Cliente<select name="cliente_id" required>${clienteOptions(cid)}</select></label>
      <label class="field full">Obra<select name="obra_id">${obraOptions(cid, r.obra_id)}</select></label>
      <label class="field full">Valor total<input name="valor_total" inputmode="numeric" required value="${esc(numberToMoney(r.valor_total))}" placeholder="R$0,00" /></label>`;
    },
    bind(form) {
      const sel = $("[name=cliente_id]", form);
      sel.onchange = () => ($("[name=obra_id]", form).innerHTML = obraOptions(sel.value));
      applyMask($("[name=valor_total]", form), maskMoney);
    },
    async payload(f) {
      if (!digits(f.get("valor_total"))) throw new Error("Informe o valor total da nota.");
      return {
        numero: f.get("numero").trim(), data_emissao: f.get("data_emissao"), cliente_id: f.get("cliente_id"),
        obra_id: f.get("obra_id") || null, valor_total: moneyToNumber(f.get("valor_total")),
      };
    },
  },
};
const tableOf = { clientes: "clientes", obras: "obras", notas: "notas_fiscais" };
const folderOf = { clientes: "clientes", obras: "obras", notas: "notas-fiscais" };
let editing = null;

function openForm(entity, id = null) {
  if (!id && entity !== "clientes" && !clientesAtivos().length) return toast("Cadastre um cliente primeiro.", "err");
  const record = id ? state[entity].find((r) => r.id === id) : null;
  const def = forms[entity];
  editing = { entity, id };
  $("#form-title").textContent = def.title(record);
  $("#form-fields").innerHTML = def.fields(record ?? undefined);
  $("#form-error").hidden = true;
  $("#form-submit").textContent = id ? "Salvar alterações" : "Salvar";
  def.bind?.($("#entity-form"));
  $("#form-dialog").showModal();
}

async function submitForm(e) {
  e.preventDefault();
  const { entity, id } = editing;
  const btn = $("#form-submit"), err = $("#form-error");
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  err.hidden = true;
  try {
    const payload = await forms[entity].payload(new FormData(e.target));
    const q = supabase.from(tableOf[entity]);
    await mutate(id ? q.update(payload).eq("id", id) : q.insert(payload));
    $("#form-dialog").close();
    toast(id ? "Alterações salvas" : "Cadastro salvo");
    await loadAll();
    loadDashboard();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
  }
}

async function setArquivado(id, arquivar) {
  try {
    await mutate(supabase.from("clientes").update({ arquivado: arquivar }).eq("id", id));
  } catch (ex) {
    return toast(ex.message, "err");
  }
  toast(arquivar ? "Cliente arquivado" : "Cliente reativado");
  await loadAll();
  loadDashboard();
}

async function removeFolder(prefix) {
  const { data } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  const paths = (data ?? []).filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

const bloqueio = (text) => confirmDialog(text, { title: "Exclusão bloqueada", ok: "Entendi", danger: false, cancel: null });

async function deleteRecord(entity, id) {
  // Notas fiscais precisam ser guardadas: cliente ou obra com notas não pode ser excluído
  if (entity === "clientes") {
    const cli = clienteDe(id);
    const qtd = state.notas.filter((n) => n.cliente_id === id).length;
    if (qtd && cli?.arquivado) return bloqueio(`Este cliente tem ${plural(qtd, "nota fiscal", "notas fiscais")} e não pode ser excluído. Ele já está arquivado.`);
    if (qtd) {
      const arquivar = await confirmDialog(
        `Este cliente tem ${plural(qtd, "nota fiscal", "notas fiscais")} e não pode ser excluído, porque notas fiscais precisam ser guardadas. ` +
        "Deseja arquivá-lo? Ele sai da lista, mas todo o histórico continua salvo.",
        { title: "Exclusão bloqueada", ok: "Arquivar", danger: false },
      );
      if (arquivar) await setArquivado(id, true);
      return;
    }
  }
  if (entity === "obras") {
    const qtd = state.notas.filter((n) => n.obra_id === id).length;
    if (qtd) return bloqueio(`Esta obra tem ${plural(qtd, "nota fiscal vinculada", "notas fiscais vinculadas")} e não pode ser excluída.`);
  }

  const msg = entity === "clientes"
    ? "Excluir este cliente? As obras e os arquivos dele também serão excluídos. Não dá para desfazer."
    : "Excluir este registro e os arquivos dele? Não dá para desfazer.";
  if (!(await confirmDialog(msg, { title: "Excluir" }))) return;
  const folders = [`${folderOf[entity]}/${id}`];
  if (entity === "clientes") state.obras.filter((o) => o.cliente_id === id).forEach((o) => folders.push(`obras/${o.id}`));
  try {
    await mutate(supabase.from(tableOf[entity]).delete().eq("id", id));
  } catch (ex) {
    return toast(ex.message, "err");
  }
  await Promise.all(folders.map(removeFolder));
  toast("Excluído");
  await loadAll();
  loadDashboard();
}

// ---------------------------------------------------------------- storage (por pastas)
let filesFolder = null;
const ROOT_FOLDERS = [["clientes", "Clientes"], ["obras", "Obras"], ["notas-fiscais", "Notas fiscais"], ["geral", "Geral"]];
const nomeArquivo = (name) => name.replace(/^\d+_/, "");
const ehImagem = (name) => /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i.test(name);

function entityLabel(folder, id) {
  if (folder === "clientes") return clienteDe(id)?.nome;
  if (folder === "obras") { const o = state.obras.find((x) => x.id === id); return o && `${obraNome(o)} · ${o.clientes?.nome ?? ""}`; }
  if (folder === "notas-fiscais") { const n = state.notas.find((x) => x.id === id); return n && `NF ${n.numero}`; }
}

async function listFiles(prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) { toast(error.message, "err"); return []; }
  return data.filter((f) => f.name !== ".emptyFolderPlaceholder");
}

const fileItem = (prefix, f) => {
  const quando = f.created_at ? fmtDate(f.created_at.slice(0, 10)) : "";
  return `
  <li>
    <span class="fi">${icon(ehImagem(f.name) ? "image" : "file")}</span>
    <span class="name"><b title="${esc(nomeArquivo(f.name))}">${esc(nomeArquivo(f.name))}</b><span>${[fmtSize(f.metadata?.size), quando].filter(Boolean).join(" · ")}</span></span>
    <button class="icon-btn" data-download="${esc(prefix)}/${esc(f.name)}" title="Baixar" aria-label="Baixar ${esc(nomeArquivo(f.name))}">${icon("download")}</button>
    <button class="icon-btn" data-remove="${esc(prefix)}/${esc(f.name)}" title="Excluir" aria-label="Excluir ${esc(nomeArquivo(f.name))}">${icon("trash")}</button>
  </li>`;
};

async function openFiles(entity, id) {
  const folder = folderOf[entity];
  filesFolder = `${folder}/${id}`;
  $("#files-title").textContent = entityLabel(folder, id) ?? "Arquivos";
  $("#files-path").textContent = `Pasta ${ROOT_FOLDERS.find((r) => r[0] === folder)?.[1] ?? folder}`;
  $("#files-list").innerHTML = `<li class="empty-row"><span class="sk" style="width:60%"></span></li>`;
  $("#files-dialog").showModal();
  await renderFiles();
}

async function renderFiles() {
  const files = (await listFiles(filesFolder)).filter((f) => f.id);
  $("#files-list").innerHTML = files.length
    ? files.map((f) => fileItem(filesFolder, f)).join("")
    : `<li class="empty-row">Nenhum arquivo ainda. Tire uma foto ou envie um documento.</li>`;
}

async function upload(prefix, fileList) {
  for (const file of fileList) {
    const { error } = await supabase.storage.from(BUCKET).upload(`${prefix}/${Date.now()}_${safeName(file.name)}`, file);
    if (error) toast(`${file.name}: ${error.message}`, "err");
    else toast(`Enviado: ${file.name}`);
  }
}

async function download(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60, { download: nomeArquivo(path.split("/").pop()) });
  if (error) return toast(error.message, "err");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.click();
}

async function removeFile(path) {
  if (!(await confirmDialog(`Excluir o arquivo "${nomeArquivo(path.split("/").pop())}"? Não dá para desfazer.`, { title: "Excluir arquivo" }))) return false;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) { toast(error.message, "err"); return false; }
  toast("Arquivo excluído");
  return true;
}

// ---------------------------------------------------------------- busca geral (Ctrl K)
function buscaGrupos(termo) {
  const q = termo.trim().toLowerCase();
  if (!q) return [];
  const qd = digits(q);
  const clientes = state.clientes
    .filter((c) => match(q, c.nome, c.endereco, maskDoc(c.cpf_cnpj), maskPhone(c.telefone)) || (qd.length >= 3 && (c.cpf_cnpj.includes(qd) || (c.telefone ?? "").includes(qd))))
    .slice(0, 5).map((c) => ({ entity: "clientes", id: c.id, termo: c.nome, t: c.nome, s: [maskDoc(c.cpf_cnpj), maskPhone(c.telefone)].filter(Boolean).join(" · "), ic: "clientes" }));
  const obras = state.obras
    .filter((o) => match(q, o.servicos, o.endereco, o.clientes?.nome))
    .slice(0, 5).map((o) => ({ entity: "obras", id: o.id, termo: obraNome(o), t: obraNome(o), s: `${o.clientes?.nome ?? ""} · ${obraStatus(o).label}`, ic: "obras" }));
  const notas = state.notas
    .filter((n) => match(q, n.numero, n.clientes?.nome))
    .slice(0, 5).map((n) => ({ entity: "notas", id: n.id, termo: n.numero, t: `NF ${n.numero}`, s: `${n.clientes?.nome ?? ""} · ${fmtBRL(n.valor_total)}`, ic: "notas" }));
  return [["Clientes", clientes], ["Obras", obras], ["Notas fiscais", notas]].filter(([, l]) => l.length);
}

function renderBusca() {
  const termo = $("#busca-input").value;
  const grupos = buscaGrupos(termo);
  $("#busca-res").innerHTML = !termo.trim()
    ? `<p class="busca-hint">Digite um nome, CPF/CNPJ, telefone, endereço ou número de nota.</p>`
    : grupos.length
      ? grupos.map(([titulo, itens]) => `<div class="grp">${titulo}</div>` + itens.map((h) =>
          `<button class="hit" data-hit="${h.entity}" data-id="${h.id}" data-termo="${esc(h.termo)}"><span class="fi">${icon(h.ic)}</span><span class="grow"><span class="t">${esc(h.t)}</span><span class="s">${esc(h.s)}</span></span>${icon("chevron")}</button>`).join("")).join("")
      : `<p class="busca-hint">Nada encontrado para “${esc(termo.trim())}”.</p>`;
}

function openBusca() {
  if ($("#app-view").hidden) return;
  $("#busca-input").value = "";
  renderBusca();
  $("#busca-dialog").showModal();
  $("#busca-input").focus();
}

// Abre a seção do resultado já filtrada por ele
function abrirResultado(entity, id, termo) {
  $("#busca-dialog").close();
  state.search[entity] = termo.toLowerCase();
  state.filtro[entity] = entity === "clientes" ? "todos" : "todas";
  state.page[entity] = 1;
  $(`[data-search="${entity}"]`).value = termo;
  goTab(entity);
  renderAll();
  $(`#tb-${entity} [data-row="${id}"]`)?.classList.add("flash");
}

// "Mais" no celular: arquivar e excluir longe do polegar
function openAcoes(entity, id) {
  const r = state[entity].find((x) => x.id === id);
  if (!r) return;
  $("#acoes-sub").textContent = entity === "clientes" ? r.nome : entity === "obras" ? obraNome(r) : `NF ${r.numero}`;
  const arch = entity === "clientes"
    ? `<button class="acao" data-archive="${r.arquivado ? "0" : "1"}" data-id="${r.id}">${icon(r.arquivado ? "unarchive" : "archive")}${r.arquivado ? "Desarquivar cliente" : "Arquivar cliente"}</button>`
    : "";
  $("#acoes-list").innerHTML = `${arch}<button class="acao del" data-del="${entity}" data-id="${r.id}">${icon("trash")}Excluir</button>`;
  $("#acoes-dialog").showModal();
}

// Escolher a obra antes de anexar uma foto ou documento
function openPick() {
  const ordem = { vencido: 0, andamento: 1, agendada: 2 };
  const obras = [...state.obras].sort((a, b) => ordem[obraStatus(a).key] - ordem[obraStatus(b).key]);
  if (!obras.length) return toast("Cadastre uma obra primeiro.", "err");
  $("#pick-list").innerHTML = obras.map((o) => {
    const st = obraStatus(o);
    return `<li><button data-pick="${o.id}"><span class="grow"><span class="t">${esc(obraNome(o))}</span><span class="s">${esc(o.clientes?.nome)}</span></span><span class="badge ${st.cls}">${st.label}</span></button></li>`;
  }).join("");
  $("#pick-dialog").showModal();
}

// Explorador de pastas
async function renderExplorer() {
  const path = state.explorerPath;
  const prefix = path.join("/");
  const nomes = path.map((p, i) => (i === 1 ? entityLabel(path[0], p) ?? p : ROOT_FOLDERS.find((r) => r[0] === p)?.[1] ?? p));
  $("#crumbs").innerHTML = [`<button data-crumb="0" ${path.length ? "" : 'aria-current="page"'}>Todas as pastas</button>`]
    .concat(nomes.map((n, i) => `${icon("chevron").replace('class="ic"', 'class="ic sep"')}<button data-crumb="${i + 1}" ${i === nomes.length - 1 ? 'aria-current="page"' : ""}>${esc(n)}</button>`)).join("");

  const folderRow = (key, label, sub) => `<li class="folder-row"><button class="open" data-open="${esc(key)}"><span class="fi folder">${icon("arquivos")}</span><span class="name"><b>${esc(label)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</span>${icon("chevron").replace('class="ic"', 'class="ic chev"')}</button></li>`;
  $("#recentes-panel").hidden = path.length > 0;
  if (!path.length) {
    const sub = { clientes: "uma pasta por cliente", obras: "uma pasta por obra", "notas-fiscais": "uma pasta por nota fiscal", geral: "arquivos sem vínculo" };
    $("#explorer").innerHTML = ROOT_FOLDERS.map(([k, l]) => folderRow(k, l, sub[k])).join("");
    $("#recentes").innerHTML = `<div class="recentes">${Array.from({ length: 4 }, () => `<span class="sk" style="height:120px"></span>`).join("")}</div>`;
    const { data: resumo, error } = await supabase.rpc("arquivos_resumo");
    if (error) { toast(error.message, "err"); return; }
    const cont = resumo.pastas ?? {};
    $("#explorer").innerHTML = ROOT_FOLDERS.map(([k, l]) => folderRow(k, l, `${plural(cont[k] ?? 0, "arquivo", "arquivos")} · ${sub[k]}`)).join("");
    await renderRecentes(resumo.recentes ?? []);
    return;
  }
  $("#explorer").innerHTML = `<li class="empty-row"><span class="sk" style="width:50%"></span></li>`;
  const items = await listFiles(prefix);
  const folders = items.filter((f) => !f.id), files = items.filter((f) => f.id);
  const html = folders.map((f) => folderRow(f.name, path.length === 1 ? entityLabel(path[0], f.name) ?? f.name : f.name)).join("")
    + files.map((f) => fileItem(prefix, f)).join("");
  $("#explorer").innerHTML = html || `<li class="empty-row">Pasta vazia. Use “Enviar arquivo” para adicionar.</li>`;
}

// Últimos envios, com miniatura das fotos
async function renderRecentes(lista) {
  if (!lista.length) {
    $("#recentes").innerHTML = emptyBlock({ ic: "camera", title: "Nenhum arquivo ainda", text: "As fotos e os documentos que você anexar às obras aparecem aqui.", action: `<button class="btn primary hide-mobile" data-attach>${icon("camera")}Foto ou documento</button>` }); // no celular, o botão flutuante faz esse papel
    return;
  }
  const imagens = lista.filter((a) => ehImagem(a.name)).map((a) => a.name);
  const urls = {};
  if (imagens.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(imagens, 600);
    (data ?? []).forEach((u) => { if (u.signedUrl) urls[u.path] = u.signedUrl; });
  }
  const onde = (name) => {
    const [pasta, id] = name.split("/");
    return pasta === "geral" ? "Geral" : entityLabel(pasta, id) ?? ROOT_FOLDERS.find((r) => r[0] === pasta)?.[1] ?? pasta;
  };
  $("#recentes").innerHTML = `<div class="recentes">${lista.map((a) => `
    <button class="rec" data-download="${esc(a.name)}" title="Baixar ${esc(nomeArquivo(a.name.split("/").pop()))}">
      <span class="thumb">${urls[a.name] ? `<img src="${esc(urls[a.name])}" alt="" loading="lazy" />` : icon(ehImagem(a.name) ? "image" : "file")}</span>
      <span class="meta"><b>${esc(nomeArquivo(a.name.split("/").pop()))}</b><span>${esc(onde(a.name))} · ${fmtDate(String(a.created_at).slice(0, 10))}</span></span>
    </button>`).join("")}</div>`;
}

// ---------------------------------------------------------------- realtime
const labels = { clientes: "Cliente", obras: "Obra", notas_fiscais: "Nota fiscal" };
const verbs = { INSERT: "cadastrado(a)", UPDATE: "atualizado(a)", DELETE: "excluído(a)" };
let rtTimer = null;

function setRt(cls, txt) {
  $$("[data-rt-dot]").forEach((d) => { d.className = `dot ${cls}`; d.title = txt; });
  $$("[data-rt-label]").forEach((l) => (l.textContent = txt));
}

function subscribeRealtime() {
  if (channel) supabase.removeChannel(channel);
  channel = supabase.channel("db-changes");
  for (const table of Object.keys(labels)) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
      toast(`${labels[table]} ${verbs[payload.eventType]} em outro aparelho`, "rt");
      clearTimeout(rtTimer);
      rtTimer = setTimeout(async () => {
        await loadAll();
        loadDashboard();
        const id = payload.new?.id;
        if (id) $(`[data-row="${id}"]`)?.classList.add("flash");
      }, 250);
    });
  }
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") setRt("on", "Sincronizado em tempo real");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRt("off", "Sem sincronização");
    else if (status === "CLOSED") setRt("", "Sincronização pausada");
  });
}

// ---------------------------------------------------------------- navegação (com histórico: o "voltar" funciona)
const TAB_HASH = { dashboard: "#painel", clientes: "#clientes", obras: "#obras", notas: "#notas", arquivos: "#arquivos" };
const TAB_TITLE = { dashboard: "Painel", clientes: "Clientes", obras: "Obras", notas: "Notas fiscais", arquivos: "Arquivos" };
const FAB = {
  clientes: ["Novo cliente", () => openForm("clientes")],
  obras: ["Nova obra", () => openForm("obras")],
  notas: ["Nova nota", () => openForm("notas")],
  arquivos: ["Enviar arquivo", () => $("#explorer-upload").click()],
};
const tabFromHash = () => Object.keys(TAB_HASH).find((k) => TAB_HASH[k] === location.hash) ?? "dashboard";
function goTab(tab) {
  if (location.hash !== TAB_HASH[tab]) location.hash = TAB_HASH[tab];
  else switchTab(tab);
}

function switchTab(tab) {
  state.tab = tab;
  $$("[data-tab]").forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  const fab = FAB[tab];
  $("#fab").hidden = !fab;
  if (fab) $("#fab-label").textContent = fab[0];
  document.title = `${TAB_TITLE[tab]} · Gestão de Obras`;
  window.scrollTo({ top: 0 });
  if (tab === "dashboard" && state.loaded) loadDashboard();
  if (tab === "arquivos") renderExplorer();
}

// ---------------------------------------------------------------- eventos
$("#login-form").addEventListener("submit", login);
$("#entity-form").addEventListener("submit", submitForm);
$$("[data-logout]").forEach((b) => (b.onclick = () => supabase.auth.signOut()));
$("#fab").onclick = () => FAB[state.tab]?.[1]();
$$("[data-search]").forEach((i) => (i.oninput = () => {
  state.search[i.dataset.search] = i.value.trim().toLowerCase();
  state.page[i.dataset.search] = 1;
  renderAll();
}));
$$("dialog [data-close]").forEach((b) => (b.onclick = () => b.closest("dialog").close()));
window.addEventListener("hashchange", () => { if (!$("#app-view").hidden) switchTab(tabFromHash()); });

document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-open]");
  if (!t) return;
  const d = t.dataset;
  if (t.closest("#acoes-dialog") && (d.archive || d.del)) $("#acoes-dialog").close();
  if (d.busca !== undefined) openBusca();
  else if (d.hit) abrirResultado(d.hit, d.id, d.termo);
  else if (d.mais) openAcoes(d.mais, d.id);
  else if (d.tab) goTab(d.tab);
  else if (d.goto) goTab(d.goto);
  else if (d.new) openForm(d.new);
  else if (d.attach !== undefined) openPick();
  else if (d.pick) { $("#pick-dialog").close(); openFiles("obras", d.pick); }
  else if (d.edit) openForm(d.edit, d.id);
  else if (d.del) deleteRecord(d.del, d.id);
  else if (d.archive) setArquivado(d.id, d.archive === "1");
  else if (d.files) openFiles(d.files, d.id);
  else if (d.download) download(d.download);
  else if (d.remove) {
    if (await removeFile(d.remove)) { if ($("#files-dialog").open) renderFiles(); else renderExplorer(); }
  } else if (d.filter) { state.filtro[d.filter] = d.value; state.page[d.filter] = 1; renderAll(); }
  else if (d.clear) {
    state.search[d.clear] = "";
    state.filtro[d.clear] = { clientes: "ativos", obras: "todas", notas: "todas" }[d.clear];
    $(`[data-search="${d.clear}"]`).value = "";
    renderAll();
  } else if (d.page) { state.page[d.page] += Number(d.dir); renderAll(); window.scrollTo({ top: 0 }); }
  else if (d.open) { state.explorerPath.push(d.open); renderExplorer(); }
  else if (d.crumb !== undefined) { state.explorerPath = state.explorerPath.slice(0, Number(d.crumb)); renderExplorer(); }
});

$("#busca-input").addEventListener("input", renderBusca);
$("#busca-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("#busca-res .hit")?.click(); }
});
document.addEventListener("keydown", (e) => {
  const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
  if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !digitando && !document.querySelector("dialog[open]"))) {
    e.preventDefault();
    openBusca();
  }
});

const enviarParaPasta = async (input) => { await upload(filesFolder, input.files); input.value = ""; renderFiles(); };
$("#files-upload").onchange = (e) => enviarParaPasta(e.target);
$("#files-camera").onchange = (e) => enviarParaPasta(e.target);
$("#explorer-upload").onchange = async (e) => {
  const prefix = state.explorerPath.length ? state.explorerPath.join("/") : "geral";
  await upload(prefix, e.target.files);
  e.target.value = "";
  renderExplorer();
};

// ---------------------------------------------------------------- start
let appUserId = null;
supabase.auth.onAuthStateChange((event, session) => {
  if (session && session.user.id !== appUserId) {
    appUserId = session.user.id;
    setTimeout(() => showApp(session), 0); // fora do callback de auth (evita deadlock do supabase-js)
  } else if (!session) {
    appUserId = null;
    showLogin();
  }
});

// App instalável (PWA): guarda a interface para abrir rápido, mesmo com sinal fraco
if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
