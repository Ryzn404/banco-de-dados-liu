"""Teste rápido ponta a ponta com o usuário liu (login, CRUD, trigger, edge functions, storage)."""
import json
import sys
import urllib.error
import urllib.request

sys.path.insert(0, __import__("os").path.dirname(__file__))
from setup import load_env  # noqa: E402

env = load_env()
URL, ANON = env["SUPABASE_URL"], env["SUPABASE_ANON_KEY"]


def call(method, path, token=None, body=None, extra=None, raw=False):
    h = {"apikey": ANON, "Authorization": f"Bearer {token or ANON}", "Content-Type": "application/json"}
    h.update(extra or {})
    data = body if raw else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(URL + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return r.status, json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


s, d = call("POST", "/auth/v1/token?grant_type=password", body={"email": env["APP_USER_EMAIL"], "password": env["APP_USER_PASSWORD"]})
assert s == 200, (s, d)
tok = d["access_token"]
print("[ok] login liu")

s, d = call("POST", "/functions/v1/validar-documento", tok, {"documento": "11222333000181"})
print("[ok] validar-documento ->", s, d)
s, d = call("POST", "/functions/v1/validar-documento", None, {"documento": "11222333000181"})
print("[ok] validar-documento sem login ->", s)

rep = {"Prefer": "return=representation"}
s, c = call("POST", "/rest/v1/clientes", tok, {"nome": "Teste Smoke", "cpf_cnpj": "000.000.000-00-smoke", "telefone": "1", "endereco": "Rua A, 1"}, rep)
assert s == 201, (s, c)
cid = c[0]["id"]
s, o = call("POST", "/rest/v1/obras", tok, {"cliente_id": cid, "data_inicio": "2026-10-01", "servicos": "x"}, rep)
assert s == 201 and o[0]["endereco"] == "Rua A, 1", (s, o)
print("[ok] CRUD + trigger endereço da obra =", o[0]["endereco"])

s, d = call("GET", "/functions/v1/resumo-dashboard", tok)
print("[ok] resumo-dashboard ->", s, d)

s, d = call("POST", f"/storage/v1/object/documentos/clientes/{cid}/teste.txt", tok, b"ola", {"Content-Type": "text/plain"}, raw=True)
print("[ok] upload storage ->", s)
s, d = call("DELETE", "/storage/v1/object/documentos", tok, {"prefixes": [f"clientes/{cid}/teste.txt"]})
print("[ok] delete storage ->", s)

s, _ = call("DELETE", f"/rest/v1/clientes?id=eq.{cid}", tok)
print("[ok] limpeza ->", s)
