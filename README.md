# Gestão de Obras — CRUD com Supabase

| Recurso Supabase | Onde |
|---|---|
| **Auth** | Login por usuário (`liu` → `liu@obras.local`), sessão via `supabase-js` |
| **Database** | `clientes`, `obras`, `notas_fiscais` com RLS, FKs, triggers — `supabase/migrations/001_schema.sql` |
| **Storage** | Bucket privado `documentos` com pastas `clientes/<id>`, `obras/<id>`, `notas-fiscais/<id>`, `geral/` |
| **Realtime** | `postgres_changes` nas 3 tabelas — atualiza a tela de todos os usuários conectados |
| **Edge Functions** | `validar-documento` (CPF/CNPJ) e `resumo-dashboard` (indicadores) — `supabase/functions/` |

## Rodar

```powershell
python scripts/setup.py      # provisiona banco, usuário e edge functions (idempotente)
python serve.py              # http://localhost:5173
python scripts/smoke_test.py # teste ponta a ponta via API
```

Segredos ficam em `.env` (não versionar). O front usa apenas a chave pública (`web/config.js`).
