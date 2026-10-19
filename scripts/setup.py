"""Provisiona o backend no Supabase (idempotente).

1. Executa supabase/migrations/*.sql (tabelas, RLS, Realtime, Storage)
2. Cria o usuário inicial (Auth Admin API)
3. Publica as Edge Functions de supabase/functions/*

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


def run_migrations(env):
    headers = {"Authorization": f"Bearer {env['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json",
               "User-Agent": "setup-script"}
    url = f"{MGMT}/projects/{env['SUPABASE_PROJECT_REF']}/database/query"
    for sql_file in sorted((ROOT / "supabase" / "migrations").glob("*.sql")):
        status, data = request("POST", url, headers, json.dumps({"query": sql_file.read_text(encoding="utf-8")}).encode())
        if status >= 300:
            sys.exit(f"[ERRO] migração {sql_file.name}: {status} {data}")
        print(f"[ok] migração {sql_file.name}")


def create_user(env):
    headers = {"apikey": env["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}",
               "Content-Type": "application/json"}
    body = {"email": env["APP_USER_EMAIL"], "password": env["APP_USER_PASSWORD"], "email_confirm": True,
            "user_metadata": {"username": "liu", "nome": "Liu"}}
    status, data = request("POST", f"{env['SUPABASE_URL']}/auth/v1/admin/users", headers, json.dumps(body).encode())
    if status < 300:
        print(f"[ok] usuário criado: {env['APP_USER_EMAIL']}")
    elif status == 422 and "already" in json.dumps(data).lower():
        print(f"[ok] usuário já existe: {env['APP_USER_EMAIL']}")
    else:
        sys.exit(f"[ERRO] criar usuário: {status} {data}")


def deploy_functions(env):
    ref = env["SUPABASE_PROJECT_REF"]
    for fn_dir in sorted(p for p in (ROOT / "supabase" / "functions").iterdir() if p.is_dir()):
        slug = fn_dir.name
        boundary = uuid.uuid4().hex
        parts = []
        meta = {"entrypoint_path": "index.ts", "name": slug, "verify_jwt": False}
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n{json.dumps(meta)}\r\n'.encode())
        for f in sorted(fn_dir.rglob("*.ts")):
            rel = f.relative_to(fn_dir).as_posix()
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{rel}"\r\n'
                         f"Content-Type: application/typescript\r\n\r\n".encode() + f.read_bytes() + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        headers = {"Authorization": f"Bearer {env['SUPABASE_ACCESS_TOKEN']}",
                   "Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "setup-script"}
        status, data = request("POST", f"{MGMT}/projects/{ref}/functions/deploy?slug={slug}", headers, b"".join(parts))
        if status >= 300:
            sys.exit(f"[ERRO] deploy {slug}: {status} {data}")
        print(f"[ok] edge function '{slug}' publicada (versão {data.get('version')})")


if __name__ == "__main__":
    env = load_env()
    run_migrations(env)
    create_user(env)
    deploy_functions(env)
    print("Setup concluído.")
