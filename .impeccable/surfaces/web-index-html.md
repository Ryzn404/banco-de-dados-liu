---
version: 1
slug: "web-index-html"
primary_target: "web/index.html"
related_targets: ["web/app.js","web/styles.css"]
---

# Surface brief: aplicativo web (web/index.html)

Escopo: todo o app autenticado (Painel, Clientes, Obras, Notas Fiscais, Arquivos, login), desktop e celular, instalável como PWA. Modo: Operate.

Tarefa: no computador, cadastrar e revisar; no celular, na obra, consultar cliente/obra, lançar nota fiscal, anexar foto/documento e ver o painel em um ou dois toques. Manter as 5 seções e o tema escuro automático. Referência de acabamento escolhida pelo usuário: Stripe Dashboard.

## Direction contract

THESIS: O padrão da categoria executado no nível do Stripe Dashboard: menu lateral, indicadores, tabelas e filtros que o Liu entende sem pensar, com números e prazos legíveis de relance. Recusa enfeite e identidade inventada; a qualidade está na precisão.

OWN-WORLD: Superfície branca sobre fundo cinza-azulado bem claro, texto quase preto (#111827), um azul (#2563eb) só para ação principal, seleção e foco; estados com ponto colorido (verde em andamento, vermelho prazo vencido, azul agendada, cinza arquivado). Fonte do sistema, números tabulares, bordas de 1px, sombras curtas e suaves, ícones SVG de traço único.

STORY: O Liu abre e vê o que exige atenção (prazo vencido, faturamento do mês), acha qualquer cliente ou obra pela busca e lança uma nota sem procurar o botão.

FIRST VIEWPORT: Desktop: menu lateral branco à esquerda com marca, 5 itens com ícone e contagem, status do tempo real no rodapé; topo com título "Painel" e botão azul "+ Nova nota fiscal"; linha de 4 indicadores; abaixo, obras em andamento (tabela) à esquerda e faturamento de 6 meses à direita, notas recentes embaixo. Celular: barra superior com título e ação; barra inferior fixa com as 5 seções; listas viram cartões com Ligar, Arquivos e Editar ao alcance do polegar.

FORM: canon (padrão da categoria), escolhido pelo usuário na rodada de direção; seed:4fac3531354e0a28

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
