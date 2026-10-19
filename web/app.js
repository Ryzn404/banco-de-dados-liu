import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY, LOGIN_DOMAIN, BUCKET } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = { clientes: [], obras: [], notas: [], search: { clientes: "", obras: "", notas: "" }, explorerPath: [] };
let channel = null;

// ---------------------------------------------------------------- utilidades
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDate = (d) => (d ? d.split("-").reverse().join("/") : "—");
const fmtBRL = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const fmtSize = (b) => (b == null ? "" : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const digits = (v) => String(v ?? "").replace(/\D/g, "");

// 111.111.111-11 (até 11 dígitos) ou 11.222.333/0001-81 (12 a 14 dígitos)
function maskDoc(v) {
  const d = digits(v).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

// (71)9 2222-2222 (celular, 11 dígitos) ou (71)2222-2222 (fixo, 10 dígitos)
function maskPhone(v) {
  const d = digits(v).slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2), r = d.slice(2);
  if (d.length === 11) return `(${ddd})${r[0]} ${r.slice(1, 5)}-${r.slice(5)}`;
  return r.length > 4 ? `(${ddd})${r.slice(0, 4)}-${r.slice(4)}` : `(${ddd})${r}`;
}

function applyMask(input, mask) {
  input.value = mask(input.value);
  input.addEventListener("input", () => (input.value = mask(input.value)));
}

const safeName = (n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]/g, "_");

function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $("#toasts").append(el);
  setTimeout(() => el.remove(), 3500);
}

function confirmDialog(text) {
  return new Promise((resolve) => {
    const dlg = $("#confirm-dialog");
    $("#confirm-text").textContent = text;
    const done = (v) => { dlg.close(); $("#confirm-yes").onclick = $("#confirm-no").onclick = null; resolve(v); };
    $("#confirm-yes").onclick = () => done(true);
    $("#confirm-no").onclick = () => done(false);
    dlg.showModal();
  });
}

function obraStatus(o) {
  const h = today();
  if (o.data_inicio > h) return ["Agendada", "info"];
  if (o.previsao_termino && o.previsao_termino < h) return ["Prazo vencido", "warn"];
  return ["Em andamento", "ok"];
}

// ---------------------------------------------------------------- autenticação
async function login(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const usuario = String(f.get("usuario")).trim();
  const email = usuario.includes("@") ? usuario : `${usuario.toLowerCase()}@${LOGIN_DOMAIN}`;
  const btn = $("button[type=submit]", e.target);
  btn.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(f.get("senha")) });
  btn.disabled = false;
  const err = $("#login-error");
  err.hidden = !error;
  if (error) err.textContent = error.message === "Invalid login credentials" ? "Usuário ou senha inválidos" : error.message;
}

async function showApp(session) {
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
async function loadClientes() {
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) return toast(error.message, "err");
  state.clientes = data;
}
async function loadObras() {
  const { data, error } = await supabase.from("obras").select("*, clientes(nome, endereco)").order("data_inicio", { ascending: false });
  if (error) return toast(error.message, "err");
  state.obras = data;
}
async function loadNotas() {
  const { data, error } = await supabase.from("notas_fiscais").select("*, clientes(nome), obras(servicos, endereco)").order("data_emissao", { ascending: false });
  if (error) return toast(error.message, "err");
  state.notas = data;
}
async function loadAll() {
  await Promise.all([loadClientes(), loadObras(), loadNotas()]);
  renderAll();
}

// ---------------------------------------------------------------- render
const match = (q, ...vals) => !q || vals.some((v) => String(v ?? "").toLowerCase().includes(q));
const rowActions = (entity, id) => `
  <td class="row-actions">
    <button class="icon-btn" data-files="${entity}" data-id="${id}" title="Arquivos">📁 Arquivos</button>
    <button class="icon-btn" data-edit="${entity}" data-id="${id}">Editar</button>
    <button class="icon-btn del" data-del="${entity}" data-id="${id}">Excluir</button>
  </td>`;

function renderClientes() {
  const q = state.search.clientes;
  const rows = state.clientes.filter((c) => match(q, c.nome, c.cpf_cnpj, c.telefone, c.endereco));
  $("#tb-clientes").innerHTML = rows.length ? rows.map((c) => `
    <tr data-row="${c.id}">
      <td><strong>${esc(c.nome)}</strong></td>
      <td>${esc(c.cpf_cnpj)}</td>
      <td>${esc(c.telefone) || "—"}</td>
      <td class="clip" title="${esc(c.endereco)}">${esc(c.endereco) || "—"}</td>
      ${rowActions("clientes", c.id)}
    </tr>`).join("") : `<tr><td colspan="5" class="empty">Nenhum cliente cadastrado.</td></tr>`;
}

function renderObras() {
  const q = state.search.obras;
  const rows = state.obras.filter((o) => match(q, o.clientes?.nome, o.endereco, o.servicos));
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
      ${rowActions("obras", o.id)}
    </tr>`;
  }).join("") : `<tr><td colspan="7" class="empty">Nenhuma obra cadastrada.</td></tr>`;
}

function renderNotas() {
  const q = state.search.notas;
  const rows = state.notas.filter((n) => match(q, n.numero, n.clientes?.nome, n.obras?.servicos));
  $("#tb-notas").innerHTML = rows.length ? rows.map((n) => `
    <tr data-row="${n.id}">
      <td><strong>${esc(n.numero)}</strong></td>
      <td>${fmtDate(n.data_emissao)}</td>
      <td>${esc(n.clientes?.nome)}</td>
      <td class="clip">${esc(n.obras?.servicos || n.obras?.endereco) || "—"}</td>
      <td class="num">${fmtBRL(n.valor_total)}</td>
      ${rowActions("notas", n.id)}
    </tr>`).join("") : `<tr><td colspan="6" class="empty">Nenhuma nota fiscal cadastrada.</td></tr>`;
}

function renderAll() { renderClientes(); renderObras(); renderNotas(); }

// ---------------------------------------------------------------- painel (Edge Function)
async function loadDashboard() {
  const { data, error } = await supabase.functions.invoke("resumo-dashboard", { method: "GET" });
  if (error) return toast(`Painel: ${error.message}`, "err");
  const kpis = [
    ["Clientes", data.totalClientes],
    ["Obras", data.totalObras],
    ["Em andamento", data.obrasAndamento],
    ["Prazo vencido", data.obrasPrazoVencido],
    ["Notas fiscais", data.totalNotas],
    ["Faturamento total", fmtBRL(data.faturamentoTotal)],
  ];
  $("#kpis").innerHTML = kpis.map(([l, v]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${esc(v)}</div></div>`).join("");
  const max = Math.max(1, ...data.faturamentoPorMes.map((m) => m.valor));
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  $("#chart").innerHTML = data.faturamentoPorMes.map((m) => `
    <div class="bar-col">
      <div class="bar-val">${m.valor ? fmtBRL(m.valor) : ""}</div>
      <div class="bar" style="height:${(m.valor / max) * 80}%"></div>
      <div class="bar-lbl">${meses[Number(m.mes.slice(5)) - 1]}/${m.mes.slice(2, 4)}</div>
    </div>`).join("");
}

// ---------------------------------------------------------------- formulários
const clienteOptions = (sel) => state.clientes.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.nome)}</option>`).join("");
const obraOptions = (clienteId, sel) => `<option value="">— Sem obra vinculada —</option>` + state.obras
  .filter((o) => o.cliente_id === clienteId)
  .map((o) => `<option value="${o.id}" ${o.id === sel ? "selected" : ""}>${esc(o.servicos || o.endereco)} (${fmtDate(o.data_inicio)})</option>`).join("");

const forms = {
  clientes: {
    title: (r) => (r ? "Editar cliente" : "Novo cliente"),
    fields: (r = {}) => `
      <label class="full">Nome<input name="nome" required value="${esc(r.nome)}" /></label>
      <label>CPF/CNPJ<input name="cpf_cnpj" required inputmode="numeric" maxlength="18" value="${esc(r.cpf_cnpj)}" placeholder="000.000.000-00" /></label>
      <label>Telefone<input name="telefone" inputmode="numeric" maxlength="15" value="${esc(r.telefone)}" placeholder="(71)9 2222-2222" /></label>
      <label class="full">Endereço<input name="endereco" value="${esc(r.endereco)}" /></label>`,
    bind(form) {
      applyMask($("[name=cpf_cnpj]", form), maskDoc);
      applyMask($("[name=telefone]", form), maskPhone);
    },
    async payload(f) {
      const doc = digits(f.get("cpf_cnpj"));
      if (doc.length !== 11 && doc.length !== 14) throw new Error("CPF deve ter 11 dígitos e CNPJ 14 dígitos");
      const tel = digits(f.get("telefone"));
      if (tel && tel.length !== 10 && tel.length !== 11) throw new Error("Telefone deve ter DDD + 8 ou 9 dígitos");
      // Edge Function valida CPF/CNPJ e devolve formatado
      const { data, error } = await supabase.functions.invoke("validar-documento", { body: { documento: f.get("cpf_cnpj") } });
      if (error) throw new Error(`Validação: ${error.message}`);
      if (!data.valido) throw new Error(data.mensagem);
      return { nome: f.get("nome").trim(), cpf_cnpj: data.formatado, telefone: tel ? maskPhone(tel) : null, endereco: f.get("endereco").trim() || null };
    },
  },
  obras: {
    title: (r) => (r ? "Editar obra" : "Nova obra"),
    fields: (r = {}) => {
      const cid = r.cliente_id ?? state.clientes[0]?.id;
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
      const cid = r.cliente_id ?? state.clientes[0]?.id;
      return `
      <label>Número da nota<input name="numero" required value="${esc(r.numero)}" /></label>
      <label>Data de emissão<input type="date" name="data_emissao" required value="${esc(r.data_emissao ?? today())}" /></label>
      <label class="full">Cliente<select name="cliente_id" required>${clienteOptions(cid)}</select></label>
      <label class="full">Obra<select name="obra_id">${obraOptions(cid, r.obra_id)}</select></label>
      <label class="full">Valor total (R$)<input type="number" name="valor_total" min="0" step="0.01" required value="${esc(r.valor_total)}" /></label>`;
    },
    bind(form) {
      const sel = $("[name=cliente_id]", form);
      sel.onchange = () => ($("[name=obra_id]", form).innerHTML = obraOptions(sel.value));
    },
    async payload(f) {
      return {
        numero: f.get("numero").trim(), data_emissao: f.get("data_emissao"), cliente_id: f.get("cliente_id"),
        obra_id: f.get("obra_id") || null, valor_total: Number(f.get("valor_total")),
      };
    },
  },
};
const tableOf = { clientes: "clientes", obras: "obras", notas: "notas_fiscais" };
const folderOf = { clientes: "clientes", obras: "obras", notas: "notas-fiscais" };
let editing = null;

function openForm(entity, id = null) {
  if (entity !== "clientes" && !state.clientes.length) return toast("Cadastre um cliente primeiro.", "err");
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
    const { error } = id ? await q.update(payload).eq("id", id) : await q.insert(payload);
    if (error) throw new Error(error.code === "23505" ? "Registro duplicado (CPF/CNPJ ou número da nota já existe)" : error.message);
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

async function removeFolder(prefix) {
  const { data } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  const paths = (data ?? []).filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

async function deleteRecord(entity, id) {
  const msg = entity === "clientes"
    ? "Excluir este cliente? As obras, notas fiscais e arquivos vinculados também serão excluídos."
    : "Excluir este registro e seus arquivos?";
  if (!(await confirmDialog(msg))) return;
  const folders = [`${folderOf[entity]}/${id}`];
  if (entity === "clientes") {
    state.obras.filter((o) => o.cliente_id === id).forEach((o) => folders.push(`obras/${o.id}`));
    state.notas.filter((n) => n.cliente_id === id).forEach((n) => folders.push(`notas-fiscais/${n.id}`));
  }
  const { error } = await supabase.from(tableOf[entity]).delete().eq("id", id);
  if (error) return toast(error.message, "err");
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
  renderAll();
}));
$$("dialog [data-close]").forEach((b) => (b.onclick = () => b.closest("dialog").close()));

document.addEventListener("click", async (e) => {
  const t = e.target.closest("button, [data-open]");
  if (!t) return;
  const d = t.dataset;
  if (d.edit) openForm(d.edit, d.id);
  else if (d.del) deleteRecord(d.del, d.id);
  else if (d.files) openFiles(d.files, d.id);
  else if (d.download) download(d.download);
  else if (d.remove) {
    if (await removeFile(d.remove)) { if ($("#files-dialog").open) renderFiles(); else renderExplorer(); }
  } else if (d.open) { state.explorerPath.push(d.open); renderExplorer(); }
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
