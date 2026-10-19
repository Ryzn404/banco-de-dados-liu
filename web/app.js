import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, LOGIN_DOMAIN, BUCKET } from "./config.js";
import { digits, alnum, maskDoc, maskPhone, maskMoney, moneyToNumber, numberToMoney, today, fmtDate, fmtBRL } from "./formatos.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const PAGE_SIZE = 50; // linhas por página nas tabelas
const FETCH_SIZE = 1000; // linhas por consulta (o Supabase devolve no máximo 1000 por vez)

const state = {
  clientes: [],
  obras: [],
  notas: [],
  search: { clientes: "", obras: "", notas: "" },
  page: { clientes: 1, obras: 1, notas: 1 },
  mostrarArquivados: false,
  explorerPath: [],
};
let channel = null;

// ---------------------------------------------------------------- utilidades
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtSize = (b) => (b == null ? "" : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const safeName = (n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]/g, "_");

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

function obraStatus(o) {
  const h = today();
  if (o.data_inicio > h) return ["Agendada", "info"];
  if (o.previsao_termino && o.previsao_termino < h) return ["Prazo vencido", "warn"];
  return ["Em andamento", "ok"];
}

const clientesAtivos = () => state.clientes.filter((c) => !c.arquivado);

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
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(f.get("senha")) });
  btn.disabled = false;
  if (error) loginError(error.message === "Invalid login credentials" ? "Usuário ou senha inválidos" : error.message);
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
  const u = session.user;
  $("#user-label").textContent = `Conectado como ${u.user_metadata?.username ?? u.email}`;
  await loadAll();
  loadDashboard();
  subscribeRealtime();
}

function showLogin() {
  if (channel) { supabase.removeChannel(channel); channel = null; }
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
      fetchAll("obras", "*, clientes(nome, endereco)", [["data_inicio", false]]),
      fetchAll("notas_fiscais", "*, clientes(nome), obras(servicos, endereco)", [["data_emissao", false]]),
    ]);
  } catch (e) {
    toast(friendlyError(e), "err");
  }
  renderAll();
}

// ---------------------------------------------------------------- render
const match = (q, ...vals) => !q || vals.some((v) => String(v ?? "").toLowerCase().includes(q));

function rowActions(entity, r) {
  const arquivar = entity === "clientes"
    ? `<button class="icon-btn" data-archive="${r.arquivado ? "0" : "1"}" data-id="${r.id}">${r.arquivado ? "Desarquivar" : "Arquivar"}</button>`
    : "";
  return `
  <td class="row-actions">
    <button class="icon-btn" data-files="${entity}" data-id="${r.id}" title="Arquivos">📁 Arquivos</button>
    <button class="icon-btn" data-edit="${entity}" data-id="${r.id}">Editar</button>
    ${arquivar}
    <button class="icon-btn del" data-del="${entity}" data-id="${r.id}">Excluir</button>
  </td>`;
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
    <span class="muted small">${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} de ${rows.length}</span>
    <button class="btn ghost small" data-page="${entity}" data-dir="-1" ${page === 1 ? "disabled" : ""}>‹ Anterior</button>
    <button class="btn ghost small" data-page="${entity}" data-dir="1" ${page === pages ? "disabled" : ""}>Próxima ›</button>`;
  return rows.slice(start, start + PAGE_SIZE);
}

function renderClientes() {
  const q = state.search.clientes;
  const rows = paginate("clientes", state.clientes.filter((c) => (state.mostrarArquivados || !c.arquivado)
    && match(q, c.nome, c.cpf_cnpj, maskDoc(c.cpf_cnpj), c.telefone, maskPhone(c.telefone), c.endereco)));
  $("#tb-clientes").innerHTML = rows.length ? rows.map((c) => `
    <tr data-row="${c.id}" class="${c.arquivado ? "archived" : ""}">
      <td><strong>${esc(c.nome)}</strong>${c.arquivado ? ` <span class="badge muted">Arquivado</span>` : ""}</td>
      <td>${esc(maskDoc(c.cpf_cnpj))}</td>
      <td>${esc(maskPhone(c.telefone)) || "—"}</td>
      <td class="clip" title="${esc(c.endereco)}">${esc(c.endereco) || "—"}</td>
      ${rowActions("clientes", c)}
    </tr>`).join("") : `<tr><td colspan="5" class="empty">Nenhum cliente encontrado.</td></tr>`;
}

function renderObras() {
  const q = state.search.obras;
  const rows = paginate("obras", state.obras.filter((o) => match(q, o.clientes?.nome, o.endereco, o.servicos)));
  $("#tb-obras").innerHTML = rows.length ? rows.map((o) => {
    const [st, cls] = obraStatus(o);
    return `
    <tr data-row="${o.id}">
      <td><strong>${esc(o.clientes?.nome)}</strong></td>
      <td class="clip" title="${esc(o.endereco)}">${esc(o.endereco) || "—"}</td>
      <td>${fmtDate(o.data_inicio)}</td>
      <td>${fmtDate(o.previsao_termino)}</td>
      <td class="clip" title="${esc(o.servicos)}">${esc(o.servicos) || "—"}</td>
      <td><span class="badge ${cls}">${st}</span></td>
      ${rowActions("obras", o)}
    </tr>`;
  }).join("") : `<tr><td colspan="7" class="empty">Nenhuma obra encontrada.</td></tr>`;
}

function renderNotas() {
  const q = state.search.notas;
  const rows = paginate("notas", state.notas.filter((n) => match(q, n.numero, n.clientes?.nome, n.obras?.servicos)));
  $("#tb-notas").innerHTML = rows.length ? rows.map((n) => `
    <tr data-row="${n.id}">
      <td><strong>${esc(n.numero)}</strong></td>
      <td>${fmtDate(n.data_emissao)}</td>
      <td>${esc(n.clientes?.nome)}</td>
      <td class="clip">${esc(n.obras?.servicos || n.obras?.endereco) || "—"}</td>
      <td class="num">${fmtBRL(n.valor_total)}</td>
      ${rowActions("notas", n)}
    </tr>`).join("") : `<tr><td colspan="6" class="empty">Nenhuma nota fiscal encontrada.</td></tr>`;
}

function renderAll() { renderClientes(); renderObras(); renderNotas(); }

// ---------------------------------------------------------------- painel (Edge Function)
async function loadDashboard() {
  const { data, error } = await supabase.functions.invoke("resumo-dashboard", { method: "GET" });
  if (error) return toast(`Painel: ${error.message}`, "err");
  const kpis = [
    ["Clientes ativos", data.totalClientes],
    ["Obras", data.totalObras],
    ["Em andamento", data.obrasAndamento],
    ["Prazo vencido", data.obrasPrazoVencido],
    ["Notas fiscais", data.totalNotas],
    ["Faturamento total", fmtBRL(data.faturamentoTotal)],
  ];
  $("#kpis").innerHTML = kpis.map(([l, v]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${esc(v)}</div></div>`).join("");
  const max = Math.max(1, ...data.faturamentoPorMes.map((m) => Number(m.valor)));
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  $("#chart").innerHTML = data.faturamentoPorMes.map((m) => `
    <div class="bar-col">
      <div class="bar-val">${Number(m.valor) ? fmtBRL(m.valor) : ""}</div>
      <div class="bar" style="height:${(Number(m.valor) / max) * 80}%"></div>
      <div class="bar-lbl">${meses[Number(m.mes.slice(5)) - 1]}/${m.mes.slice(2, 4)}</div>
    </div>`).join("");
}

// ---------------------------------------------------------------- formulários
// Clientes arquivados não aparecem nas opções, exceto o que já está selecionado
const clienteOptions = (sel) => state.clientes.filter((c) => !c.arquivado || c.id === sel)
  .map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.nome)}</option>`).join("");
const obraOptions = (clienteId, sel) => `<option value="">— Sem obra vinculada —</option>` + state.obras
  .filter((o) => o.cliente_id === clienteId)
  .map((o) => `<option value="${o.id}" ${o.id === sel ? "selected" : ""}>${esc(o.servicos || o.endereco)} (${fmtDate(o.data_inicio)})</option>`).join("");

const forms = {
  clientes: {
    title: (r) => (r ? "Editar cliente" : "Novo cliente"),
    fields: (r = {}) => `
      <label class="full">Nome<input name="nome" required value="${esc(r.nome)}" /></label>
      <label>CPF/CNPJ<input name="cpf_cnpj" required maxlength="18" autocapitalize="characters" autocomplete="off" value="${esc(maskDoc(r.cpf_cnpj))}" placeholder="000.000.000-00" /></label>
      <label>Telefone<input name="telefone" inputmode="numeric" maxlength="15" value="${esc(maskPhone(r.telefone))}" placeholder="(71)9 2222-2222" /></label>
      <label class="full">Endereço<input name="endereco" value="${esc(r.endereco)}" /></label>`,
    bind(form) {
      applyMask($("[name=cpf_cnpj]", form), maskDoc);
      applyMask($("[name=telefone]", form), maskPhone);
    },
    async payload(f) {
      const doc = alnum(f.get("cpf_cnpj"));
      if (doc.length !== 11 && doc.length !== 14) throw new Error("CPF deve ter 11 dígitos e CNPJ 14 caracteres");
      const tel = digits(f.get("telefone"));
      if (tel && tel.length !== 10 && tel.length !== 11) throw new Error("Telefone deve ter DDD + 8 ou 9 dígitos");
      // Edge Function valida CPF/CNPJ e devolve o valor sem pontuação (o banco valida de novo)
      const { data, error } = await supabase.functions.invoke("validar-documento", { body: { documento: doc } });
      if (error) throw new Error(`Validação: ${error.message}`);
      if (!data.valido) throw new Error(data.mensagem);
      return { nome: f.get("nome").trim(), cpf_cnpj: data.valor, telefone: tel || null, endereco: f.get("endereco").trim() || null };
    },
  },
  obras: {
    title: (r) => (r ? "Editar obra" : "Nova obra"),
    fields: (r = {}) => {
      const cid = r.cliente_id ?? clientesAtivos()[0]?.id;
      const cli = state.clientes.find((c) => c.id === cid);
      const mesmo = !r.id || (cli && r.endereco === cli.endereco);
      return `
      <label class="full">Cliente<select name="cliente_id" required>${clienteOptions(cid)}</select></label>
      <label class="check full"><input type="checkbox" name="mesmo_endereco" ${mesmo ? "checked" : ""} /> Mesmo endereço do cliente</label>
      <label class="full">Endereço da obra<input name="endereco" value="${esc(mesmo ? cli?.endereco : r.endereco)}" ${mesmo ? "readonly" : ""} /></label>
      <label>Data de início<input type="date" name="data_inicio" required value="${esc(r.data_inicio ?? today())}" /></label>
      <label>Previsão de término<input type="date" name="previsao_termino" value="${esc(r.previsao_termino)}" /></label>
      <label class="full">Serviços<textarea name="servicos" rows="3" placeholder="Ex.: alvenaria, elétrica, pintura">${esc(r.servicos)}</textarea></label>`;
    },
    bind(form) {
      const sel = $("[name=cliente_id]", form), chk = $("[name=mesmo_endereco]", form), end = $("[name=endereco]", form);
      const sync = () => {
        end.readOnly = chk.checked;
        if (chk.checked) end.value = state.clientes.find((c) => c.id === sel.value)?.endereco ?? "";
      };
      sel.onchange = chk.onchange = sync;
    },
    async payload(f) {
      const ini = f.get("data_inicio"), fim = f.get("previsao_termino") || null;
      if (fim && fim < ini) throw new Error("A previsão de término deve ser posterior à data de início");
      const cli = state.clientes.find((c) => c.id === f.get("cliente_id"));
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
      <label>Número da nota<input name="numero" required value="${esc(r.numero)}" /></label>
      <label>Data de emissão<input type="date" name="data_emissao" required value="${esc(r.data_emissao ?? today())}" /></label>
      <label class="full">Cliente<select name="cliente_id" required>${clienteOptions(cid)}</select></label>
      <label class="full">Obra<select name="obra_id">${obraOptions(cid, r.obra_id)}</select></label>
      <label class="full">Valor total (R$)<input name="valor_total" inputmode="numeric" required value="${esc(numberToMoney(r.valor_total))}" placeholder="R$0,00" /></label>`;
    },
    bind(form) {
      const sel = $("[name=cliente_id]", form);
      sel.onchange = () => ($("[name=obra_id]", form).innerHTML = obraOptions(sel.value));
      applyMask($("[name=valor_total]", form), maskMoney);
    },
    async payload(f) {
      if (!digits(f.get("valor_total"))) throw new Error("Informe o valor total");
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
  def.bind?.($("#entity-form"));
  $("#form-dialog").showModal();
}

async function submitForm(e) {
  e.preventDefault();
  const { entity, id } = editing;
  const btn = $("#form-submit"), err = $("#form-error");
  btn.disabled = true;
  err.hidden = true;
  try {
    const payload = await forms[entity].payload(new FormData(e.target));
    const q = supabase.from(tableOf[entity]);
    await mutate(id ? q.update(payload).eq("id", id) : q.insert(payload));
    $("#form-dialog").close();
    toast(id ? "Registro atualizado" : "Registro criado");
    await loadAll();
    loadDashboard();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  } finally {
    btn.disabled = false;
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
    const cli = state.clientes.find((c) => c.id === id);
    const qtd = state.notas.filter((n) => n.cliente_id === id).length;
    if (qtd && cli?.arquivado) return bloqueio(`Este cliente tem ${qtd} nota(s) fiscal(is) e não pode ser excluído. Ele já está arquivado.`);
    if (qtd) {
      const arquivar = await confirmDialog(
        `Este cliente tem ${qtd} nota(s) fiscal(is) e não pode ser excluído, porque notas fiscais precisam ser guardadas. ` +
        "Deseja arquivá-lo? Ele sai da lista, mas todo o histórico continua salvo.",
        { title: "Exclusão bloqueada", ok: "Arquivar", danger: false },
      );
      if (arquivar) await setArquivado(id, true);
      return;
    }
  }
  if (entity === "obras") {
    const qtd = state.notas.filter((n) => n.obra_id === id).length;
    if (qtd) return bloqueio(`Esta obra tem ${qtd} nota(s) fiscal(is) vinculada(s) e não pode ser excluída.`);
  }

  const msg = entity === "clientes"
    ? "Excluir este cliente? As obras e os arquivos vinculados também serão excluídos."
    : "Excluir este registro e seus arquivos?";
  if (!(await confirmDialog(msg))) return;
  const folders = [`${folderOf[entity]}/${id}`];
  if (entity === "clientes") state.obras.filter((o) => o.cliente_id === id).forEach((o) => folders.push(`obras/${o.id}`));
  try {
    await mutate(supabase.from(tableOf[entity]).delete().eq("id", id));
  } catch (ex) {
    return toast(ex.message, "err");
  }
  await Promise.all(folders.map(removeFolder));
  toast("Registro excluído");
  await loadAll();
  loadDashboard();
}

// ---------------------------------------------------------------- storage (por pastas)
let filesFolder = null;

function entityLabel(folder, id) {
  if (folder === "clientes") return state.clientes.find((c) => c.id === id)?.nome;
  if (folder === "obras") { const o = state.obras.find((x) => x.id === id); return o && `${o.clientes?.nome} — ${o.servicos || o.endereco || ""}`; }
  if (folder === "notas-fiscais") { const n = state.notas.find((x) => x.id === id); return n && `NF ${n.numero}`; }
}

async function listFiles(prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) { toast(error.message, "err"); return []; }
  return data.filter((f) => f.name !== ".emptyFolderPlaceholder");
}

const fileItem = (prefix, f) => `
  <li>
    <span>📄</span>
    <span class="name" title="${esc(f.name)}">${esc(f.name.replace(/^\d+_/, ""))}</span>
    <span class="muted small">${fmtSize(f.metadata?.size)}</span>
    <button class="icon-btn" data-download="${esc(prefix)}/${esc(f.name)}">Baixar</button>
    <button class="icon-btn del" data-remove="${esc(prefix)}/${esc(f.name)}">Excluir</button>
  </li>`;

async function openFiles(entity, id) {
  filesFolder = `${folderOf[entity]}/${id}`;
  $("#files-title").textContent = `Arquivos — ${entityLabel(folderOf[entity], id) ?? ""}`;
  $("#files-path").textContent = `${BUCKET}/${filesFolder}/`;
  await renderFiles();
  $("#files-dialog").showModal();
}

async function renderFiles() {
  const files = (await listFiles(filesFolder)).filter((f) => f.id);
  $("#files-list").innerHTML = files.length ? files.map((f) => fileItem(filesFolder, f)).join("") : `<li class="empty">Nenhum arquivo nesta pasta.</li>`;
}

async function upload(prefix, fileList) {
  for (const file of fileList) {
    const { error } = await supabase.storage.from(BUCKET).upload(`${prefix}/${Date.now()}_${safeName(file.name)}`, file);
    if (error) toast(`${file.name}: ${error.message}`, "err");
    else toast(`Enviado: ${file.name}`);
  }
}

async function download(path) {
  const name = path.split("/").pop().replace(/^\d+_/, "");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60, { download: name });
  if (error) return toast(error.message, "err");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.click();
}

async function removeFile(path) {
  if (!(await confirmDialog(`Excluir o arquivo "${path.split("/").pop().replace(/^\d+_/, "")}"?`))) return false;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) { toast(error.message, "err"); return false; }
  toast("Arquivo excluído");
  return true;
}

// Explorador de pastas
const ROOT_FOLDERS = [["clientes", "Clientes"], ["obras", "Obras"], ["notas-fiscais", "Notas Fiscais"], ["geral", "Geral"]];

async function renderExplorer() {
  const path = state.explorerPath;
  const prefix = path.join("/");
  const crumbs = [`<button data-crumb="0">documentos</button>`]
    .concat(path.map((p, i) => `<span>/</span><button data-crumb="${i + 1}">${esc(i === 1 ? entityLabel(path[0], p) ?? p : (ROOT_FOLDERS.find((r) => r[0] === p)?.[1] ?? p))}</button>`));
  $("#crumbs").innerHTML = crumbs.join("");
  $("#explorer-upload-label").title = path.length ? `Enviar para ${prefix}/` : "Enviar para geral/";

  if (!path.length) {
    $("#explorer").innerHTML = ROOT_FOLDERS.map(([k, l]) => `<li><span>📂</span><span class="name folder" data-open="${k}">${l}</span><span class="muted small">${k}/</span></li>`).join("");
    return;
  }
  const items = await listFiles(prefix);
  const folders = items.filter((f) => !f.id), files = items.filter((f) => f.id);
  const html = folders.map((f) => {
    const label = path.length === 1 ? entityLabel(path[0], f.name) : null;
    return `<li><span>📂</span><span class="name folder" data-open="${esc(f.name)}">${esc(label ?? f.name)}</span>${label ? `<span class="muted small">${esc(f.name.slice(0, 8))}…</span>` : ""}</li>`;
  }).join("") + files.map((f) => fileItem(prefix, f)).join("");
  $("#explorer").innerHTML = html || `<li class="empty">Pasta vazia.</li>`;
}

// ---------------------------------------------------------------- realtime
const labels = { clientes: "Cliente", obras: "Obra", notas_fiscais: "Nota fiscal" };
const verbs = { INSERT: "criado(a)", UPDATE: "atualizado(a)", DELETE: "excluído(a)" };
let rtTimer = null;

function subscribeRealtime() {
  if (channel) supabase.removeChannel(channel);
  const setRt = (cls, txt) => { $("#rt-dot").className = `dot ${cls}`; $("#rt-label").textContent = txt; };
  channel = supabase.channel("db-changes");
  for (const table of Object.keys(labels)) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
      toast(`⚡ ${labels[table]} ${verbs[payload.eventType]} (tempo real)`, "rt");
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
    if (status === "SUBSCRIBED") setRt("on", "Realtime conectado");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRt("off", "Realtime desconectado");
    else if (status === "CLOSED") setRt("", "Realtime fechado");
  });
}

// ---------------------------------------------------------------- eventos
function switchTab(tab) {
  $$(".sidebar nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $$("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== tab));
  if (tab === "dashboard") loadDashboard();
  if (tab === "arquivos") renderExplorer();
}

$("#login-form").addEventListener("submit", login);
$("#logout").onclick = () => supabase.auth.signOut();
$("#entity-form").addEventListener("submit", submitForm);
$("#refresh-dash").onclick = loadDashboard;
$$(".sidebar nav button").forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));
$$("[data-new]").forEach((b) => (b.onclick = () => openForm(b.dataset.new)));
$$("[data-search]").forEach((i) => (i.oninput = () => {
  state.search[i.dataset.search] = i.value.trim().toLowerCase();
  state.page[i.dataset.search] = 1;
  renderAll();
}));
$("#mostrar-arquivados").onchange = (e) => {
  state.mostrarArquivados = e.target.checked;
  state.page.clientes = 1;
  renderClientes();
};
$$("dialog [data-close]").forEach((b) => (b.onclick = () => b.closest("dialog").close()));

document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-open]");
  if (!t) return;
  const d = t.dataset;
  if (d.edit) openForm(d.edit, d.id);
  else if (d.del) deleteRecord(d.del, d.id);
  else if (d.archive) setArquivado(d.id, d.archive === "1");
  else if (d.files) openFiles(d.files, d.id);
  else if (d.download) download(d.download);
  else if (d.remove) {
    if (await removeFile(d.remove)) { if ($("#files-dialog").open) renderFiles(); else renderExplorer(); }
  } else if (d.page) { state.page[d.page] += Number(d.dir); renderAll(); }
  else if (d.open) { state.explorerPath.push(d.open); renderExplorer(); }
  else if (d.crumb !== undefined) { state.explorerPath = state.explorerPath.slice(0, Number(d.crumb)); renderExplorer(); }
});

$("#files-upload").onchange = async (e) => { await upload(filesFolder, e.target.files); e.target.value = ""; renderFiles(); };
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
