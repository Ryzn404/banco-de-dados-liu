"""Teste ponta a ponta: regras de acesso, validações, CRUD, Edge Functions e Storage.

Cria registros de teste e apaga todos no final. Uso: python scripts/smoke_test.py
"""
import base64
import json
import pathlib
import random
import sys
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from setup import load_env  # noqa: E402

env = load_env()
URL, KEY = env["SUPABASE_URL"], env["SUPABASE_PUBLISHABLE_KEY"]
REP = {"Prefer": "return=representation"}


def call(method, path, token=None, body=None, extra=None, raw=False):
    h = {"apikey": KEY, "Authorization": f"Bearer {token or KEY}", "Content-Type": "application/json"}
    h.update(extra or {})
    data = body if raw else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(URL + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return r.status, json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try:
            return e.code, json.loads(txt)
        except ValueError:
            return e.code, txt


def check(cond, msg, detalhe=None):
    if not cond:
        raise AssertionError(f"{msg} -> {detalhe}")
    print(f"[ok] {msg}")


def gerar_cpf():
    while True:
        d = [random.randint(0, 9) for _ in range(9)]
        if len(set(d)) > 1:
            break
    for n in (9, 10):
        d.append(sum(x * (n + 1 - i) for i, x in enumerate(d)) * 10 % 11 % 10)
    return "".join(map(str, d))


def gerar_cnpj_alfanumerico():
    base = "".join(random.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(12))
    for pesos in ([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]):
        resto = sum((ord(c) - 48) * p for c, p in zip(base, pesos)) % 11
        base += str(0 if resto < 2 else 11 - resto)
    return base


fmt_cpf = lambda c: f"{c[:3]}.{c[3:6]}.{c[6:9]}-{c[9:]}"  # noqa: E731
fmt_cnpj = lambda c: f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}"  # noqa: E731

# Sem login, nada é visível
s, d = call("GET", "/rest/v1/clientes?select=id&limit=1")
check(s == 200 and d == [], "visitante sem login não vê clientes", (s, d))

s, d = call("POST", "/auth/v1/token?grant_type=password", body={"email": env["APP_USER_EMAIL"], "password": env["APP_USER_PASSWORD"]})
check(s == 200, "login liu", (s, d))
tok = d["access_token"]
claims = json.loads(base64.urlsafe_b64decode(tok.split(".")[1] + "=="))
check(claims.get("app_metadata", {}).get("role") == "admin", "token com papel admin", claims.get("app_metadata"))

criados = []  # (tabela, id), apagados no final em ordem inversa
try:
    cpf, cnpj = gerar_cpf(), gerar_cnpj_alfanumerico()

    # Edge Function de validação
    s, d = call("POST", "/functions/v1/validar-documento", tok, {"documento": fmt_cpf(cpf)})
    check(s == 200 and d["valido"] and d["valor"] == cpf, "validar-documento aceita CPF válido", (s, d))
    s, d = call("POST", "/functions/v1/validar-documento", tok, {"documento": "12.ABC.345/01DE-35"})
    check(s == 200 and d["valido"] and d["valor"] == "12ABC34501DE35", "validar-documento aceita CNPJ alfanumérico", (s, d))
    s, d = call("POST", "/functions/v1/validar-documento", tok, {"documento": "111.111.111-11"})
    check(s == 200 and not d["valido"], "validar-documento recusa CPF inválido", (s, d))
    s, _ = call("POST", "/functions/v1/validar-documento", None, {"documento": cpf})
    check(s == 401, "validar-documento exige login", s)

    # O banco valida mesmo sem passar pela Edge Function
    s, d = call("POST", "/rest/v1/clientes", tok, {"nome": "Teste inválido", "cpf_cnpj": "111.111.111-11"}, REP)
    check(s == 400 and d.get("code") == "23514", "banco recusa CPF inválido", (s, d))
    s, d = call("POST", "/rest/v1/clientes", tok, {"nome": "Teste inválido", "cpf_cnpj": gerar_cpf(), "telefone": "123"}, REP)
    check(s == 400 and d.get("code") == "23514", "banco recusa telefone inválido", (s, d))

    # Grava sem pontuação
    s, c = call("POST", "/rest/v1/clientes", tok, {"nome": "Teste Smoke", "cpf_cnpj": fmt_cpf(cpf),
                                                    "telefone": "(71)9 2222-2222", "endereco": "Rua A, 1"}, REP)
    check(s == 201, "cria cliente", (s, c))
    cid = c[0]["id"]
    criados.append(("clientes", cid))
    check(c[0]["cpf_cnpj"] == cpf and c[0]["telefone"] == "71922222222", "CPF e telefone gravados só com dígitos", c[0])

    s, c2 = call("POST", "/rest/v1/clientes", tok, {"nome": "Teste CNPJ alfanumérico", "cpf_cnpj": fmt_cnpj(cnpj).lower()}, REP)
    check(s == 201 and c2[0]["cpf_cnpj"] == cnpj, "aceita CNPJ alfanumérico (gravado em maiúsculas)", (s, c2))
    criados.append(("clientes", c2[0]["id"]))

    s, d = call("POST", "/rest/v1/clientes", tok, {"nome": "Duplicado", "cpf_cnpj": cpf}, REP)
    check(s == 409 and d.get("code") == "23505", "recusa CPF duplicado (com ou sem pontuação)", (s, d))

    # Obra e nota
    s, o = call("POST", "/rest/v1/obras", tok, {"cliente_id": cid, "data_inicio": "2026-10-01", "servicos": "teste"}, REP)
    check(s == 201 and o[0]["endereco"] == "Rua A, 1", "obra herda o endereço do cliente", (s, o))
    oid = o[0]["id"]
    criados.append(("obras", oid))

    s, n = call("POST", "/rest/v1/notas_fiscais", tok, {"cliente_id": cid, "obra_id": oid, "numero": f"SMOKE-{uuid.uuid4().hex[:8]}",
                                                        "data_emissao": "2026-10-01", "valor_total": 1900}, REP)
    check(s == 201, "cria nota fiscal", (s, n))
    criados.append(("notas_fiscais", n[0]["id"]))

    # Notas fiscais protegem cliente e obra contra exclusão
    s, d = call("DELETE", f"/rest/v1/clientes?id=eq.{cid}", tok)
    check(s == 409 and d.get("code") == "23503", "cliente com nota fiscal não pode ser excluído", (s, d))
    s, d = call("DELETE", f"/rest/v1/obras?id=eq.{oid}", tok)
    check(s == 409 and d.get("code") == "23503", "obra com nota fiscal não pode ser excluída", (s, d))
    s, d = call("PATCH", f"/rest/v1/clientes?id=eq.{cid}", tok, {"arquivado": True}, REP)
    check(s == 200 and d[0]["arquivado"] is True, "cliente pode ser arquivado", (s, d))

    # Painel (somas no banco)
    s, d = call("GET", "/functions/v1/resumo-dashboard", tok)
    check(s == 200 and d["totalNotas"] >= 1 and d["faturamentoTotal"] >= 1900 and len(d["faturamentoPorMes"]) == 6,
          "resumo-dashboard", (s, d))

    # Storage
    s, _ = call("POST", f"/storage/v1/object/documentos/clientes/{cid}/teste.txt", tok, b"ola", {"Content-Type": "text/plain"}, raw=True)
    check(s == 200, "upload no storage", s)
    s, _ = call("DELETE", "/storage/v1/object/documentos", tok, {"prefixes": [f"clientes/{cid}/teste.txt"]})
    check(s == 200, "exclusão no storage", s)
    s, _ = call("POST", "/storage/v1/object/documentos/fora-das-pastas/teste.txt", tok, b"ola", {"Content-Type": "text/plain"}, raw=True)
    check(s >= 400, "storage recusa pasta não permitida", s)
finally:
    for tabela, rid in reversed(criados):
        call("DELETE", f"/rest/v1/{tabela}?id=eq.{rid}", tok)
    print("[ok] limpeza dos registros de teste")
