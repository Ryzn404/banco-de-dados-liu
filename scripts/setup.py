"""Provisiona o backend no Supabase (idempotente).

1. Configura o Auth (cadastro público desligado, política de senha)
2. Garante o usuário administrador (papel "admin" em app_metadata)
3. Aplica as migrações ainda não aplicadas de supabase/migrations (controle em app_internal.migracoes)
4. Publica as Edge Functions de supabase/functions/*

Uso:  python scripts/setup.py
"""
import json
import pathlib
import sys
import urllib.error
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent
MGMT = "https://api.supabase.com/v1"

AUTH_CONFIG = {
    "disable_signup": True,  # usuários só são criados pelo administrador
    "password_min_length": 8,
    "password_required_characters": "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789",
}


def load_env():
    env = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def request(method, url, headers, body=None):
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw


def mgmt_headers(env):
    return {"Authorization": f"Bearer {env['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json",
            "User-Agent": "setup-script"}


def admin_headers(env):
    key = env["SUPABASE_SECRET_KEY"]
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def sql(env, query):
    url = f"{MGMT}/projects/{env['SUPABASE_PROJECT_REF']}/database/query"
    status, data = request("POST", url, mgmt_headers(env), json.dumps({"query": query}).encode())
    if status >= 300:
        raise RuntimeError(f"{status} {data}")
    return data


def configure_auth(env):
    url = f"{MGMT}/projects/{env['SUPABASE_PROJECT_REF']}/config/auth"
    status, data = request("PATCH", url, mgmt_headers(env), json.dumps(AUTH_CONFIG).encode())
    if status >= 300:
        sys.exit(f"[ERRO] configurar Auth: {status} {data}")
    print("[ok] Auth: cadastro público desligado, senha mínima de 8 caracteres com letras e números")


def ensure_admin_user(env):
    url = f"{env['SUPABASE_URL']}/auth/v1/admin/users"
    body = {"email": env["APP_USER_EMAIL"], "password": env["APP_USER_PASSWORD"], "email_confirm": True,
            "user_metadata": {"username": "liu", "nome": "Liu"}, "app_metadata": {"role": "admin"}}
    status, data = request("POST", url, admin_headers(env), json.dumps(body).encode())
    if status < 300:
        print(f"[ok] usuário admin criado: {env['APP_USER_EMAIL']}")
        return
    if not (status == 422 and "already" in json.dumps(data).lower()):
        sys.exit(f"[ERRO] criar usuário: {status} {data}")

    # Já existe: garante o papel admin
    status, data = request("GET", f"{url}?per_page=1000", admin_headers(env))
    if status >= 300:
        sys.exit(f"[ERRO] listar usuários: {status} {data}")
    user = next((u for u in data["users"] if u["email"].lower() == env["APP_USER_EMAIL"].lower()), None)
    if (user.get("app_metadata") or {}).get("role") == "admin":
        print(f"[ok] usuário admin já existe: {env['APP_USER_EMAIL']}")
        return
    status, data = request("PUT", f"{url}/{user['id']}", admin_headers(env),
                           json.dumps({"app_metadata": {"role": "admin"}}).encode())
    if status >= 300:
        sys.exit(f"[ERRO] definir papel admin: {status} {data}")
    print(f"[ok] papel admin atribuído a {env['APP_USER_EMAIL']}")


def run_migrations(env):
    sql(env, "create schema if not exists app_internal;"
             "create table if not exists app_internal.migracoes ("
             " versao text primary key, aplicada_em timestamptz not null default now());")
    aplicadas = {r["versao"] for r in sql(env, "select versao from app_internal.migracoes")}
    for sql_file in sorted((ROOT / "supabase" / "migrations").glob("*.sql")):
        versao = sql_file.stem
        if versao in aplicadas:
            print(f"[--] migração {sql_file.name} já aplicada")
            continue
        # migração e registro na mesma requisição (mesma transação)
        query = sql_file.read_text(encoding="utf-8") + f"\n;insert into app_internal.migracoes (versao) values ('{versao}');"
        try:
            sql(env, query)
        except RuntimeError as e:
            sys.exit(f"[ERRO] migração {sql_file.name}: {e}")
        print(f"[ok] migração {sql_file.name}")


def deploy_functions(env):
    ref = env["SUPABASE_PROJECT_REF"]
    for fn_dir in sorted(p for p in (ROOT / "supabase" / "functions").iterdir() if p.is_dir()):
        slug = fn_dir.name
        boundary = uuid.uuid4().hex
        parts = []
        meta = {"entrypoint_path": "index.ts", "name": slug, "verify_jwt": False}
        if (fn_dir / "deno.json").exists():
            meta["import_map_path"] = "deno.json"
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n{json.dumps(meta)}\r\n'.encode())
        for f in sorted([*fn_dir.rglob("*.ts"), *fn_dir.glob("deno.json")]):
            rel = f.relative_to(fn_dir).as_posix()
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{rel}"\r\n'
                         f"Content-Type: application/typescript\r\n\r\n".encode() + f.read_bytes() + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        headers = {**mgmt_headers(env), "Content-Type": f"multipart/form-data; boundary={boundary}"}
        status, data = request("POST", f"{MGMT}/projects/{ref}/functions/deploy?slug={slug}", headers, b"".join(parts))
        if status >= 300:
            sys.exit(f"[ERRO] deploy {slug}: {status} {data}")
        print(f"[ok] edge function '{slug}' publicada (versão {data.get('version')})")


if __name__ == "__main__":
    env = load_env()
    configure_auth(env)
    ensure_admin_user(env)
    run_migrations(env)
    deploy_functions(env)
    print("Setup concluído.")
