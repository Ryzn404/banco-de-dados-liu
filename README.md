# banco-de-dados-liu

Medição de obras e controle de notas fiscais emitidas — CRUD com Supabase.

| Recurso Supabase | Onde |
|---|---|
| **Auth** | Login por usuário (`liu` → `liu@obras.local`). Cadastro público desligado; só usuários com papel `admin` (`app_metadata.role`) acessam os dados |
| **Database** | `clientes`, `obras`, `notas_fiscais` com RLS, FKs e triggers — `supabase/migrations/` |
| **Storage** | Bucket privado `documentos` com pastas `clientes/<id>`, `obras/<id>`, `notas-fiscais/<id>`, `geral/` |
| **Realtime** | `postgres_changes` nas 3 tabelas — atualiza a tela de todos os usuários conectados |
| **Edge Functions** | `validar-documento` (CPF/CNPJ, inclusive alfanumérico) e `resumo-dashboard` (indicadores) — `supabase/functions/` |

## Regras de negócio no banco

- CPF/CNPJ é validado no Postgres (`documento_valido`) e gravado sem pontuação; telefone gravado só com dígitos.
- Cliente ou obra com nota fiscal não pode ser excluído (notas fiscais precisam ser guardadas); o cliente pode ser **arquivado**.
- O resumo do painel é calculado em SQL (`resumo_dashboard`), no fuso de Brasília.

## Rodar

```powershell
python scripts/setup.py         # Auth, usuário admin, migrações novas e Edge Functions (idempotente)
python serve.py                 # http://localhost:5173
python scripts/smoke_test.py    # teste ponta a ponta (cria e apaga registros de teste)
```

As migrações aplicadas ficam registradas em `app_internal.migracoes`; o setup só roda as novas.
Segredos ficam no `.env` (não versionado). O front usa apenas a chave publicável (`web/config.js`).
