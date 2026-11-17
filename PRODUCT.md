# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Um único usuário: o Liu, que toca as obras. Cadastra e organiza no computador, no escritório, e consulta ou atualiza pelo celular quando está na obra ou no fornecedor.

## Product Purpose

Medição de obras e controle de notas fiscais emitidas. Reúne num só lugar os clientes, as obras de cada cliente, as notas fiscais emitidas e os documentos de cada um, com um painel de faturamento e de obras em andamento. Sucesso é o Liu encontrar ou lançar qualquer informação em segundos, esteja onde estiver.

## Operating Context

- No computador: cadastro e revisão com calma (clientes, obras, notas, organização de arquivos).
- No celular, na obra ou no fornecedor, com pressa e muitas vezes com uma mão só: consultar telefone, endereço, prazo e status de uma obra; lançar uma nota fiscal na hora; tirar foto ou anexar PDF a um cliente, obra ou nota; olhar o painel.
- Os dados mudam em tempo real entre o computador e o celular (Supabase Realtime).

## Capabilities and Constraints

- Site estático (HTML, CSS e JavaScript sem framework) servido localmente em `web/`, com backend Supabase: Auth, Database, Storage, Realtime e Edge Functions.
- A versão mobile é o mesmo site adaptado ao celular e instalável na tela inicial (PWA), com uma base de código só. Não haverá app nativo.
- Entidades: clientes (nome, CPF/CNPJ, telefone, endereço), obras (endereço igual ao do cliente por padrão, início, previsão de término, serviços), notas fiscais (número, data de emissão, valor total, cliente e obra opcional) e arquivos por pasta.
- Regras: CPF/CNPJ (inclusive alfanumérico) validado; cliente ou obra com nota fiscal não pode ser excluído, o cliente pode ser arquivado; datas no fuso de Brasília.
- Interface em português do Brasil: datas dd/mm/aaaa, moeda R$1.900,00, telefone (71)9 2222-2222.
- Em aberto: medições de obra (itens, % executado), status de obra concluída/cancelada e campos fiscais extras ainda não existem.

## Brand Commitments

Nome atual da interface: "Gestão de Obras". Não há logo nem cores de marca definidas.

## Evidence on Hand

Dados reais do Liu no banco (poucos registros). Não há depoimentos, clientes de referência ou números de uso para exibir; não inventar.

## Product Principles

1. Rapidez no campo: no celular, as quatro tarefas da obra (consultar, lançar nota, anexar foto/documento, ver painel) ficam a um ou dois toques.
2. Nada se perde: notas fiscais e o histórico são preservados; ações destrutivas são raras, claras e reversíveis quando possível.
3. Os dados são o produto: números, prazos e status precisam ser legíveis de relance, inclusive no sol.
4. Uma ferramenta, dois lugares: computador e celular mostram a mesma verdade, sincronizada em tempo real.
