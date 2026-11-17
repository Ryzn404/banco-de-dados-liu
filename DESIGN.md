---
name: Gestão de Obras
description: Painel administrativo de clientes, obras, notas fiscais e arquivos, no padrão da categoria e no acabamento do Stripe Dashboard.
colors:
  bg: "#f5f7fa"
  surface: "#ffffff"
  surface-2: "#fafbfc"
  surface-hover: "#f5f7fa"
  border: "#e4e7ec"
  border-strong: "#d0d5dd"
  text: "#111827"
  text-2: "#475467"
  text-3: "#667085"
  accent: "#2563eb"
  accent-hover: "#1d4ed8"
  accent-text: "#1d4ed8"
  accent-soft: "#eff4ff"
  accent-soft-2: "#c7d7fe"
  on-accent: "#ffffff"
  ok: "#067647"
  ok-bg: "#ecfdf3"
  ok-dot: "#17b26a"
  bad: "#b42318"
  bad-bg: "#fef3f2"
  bad-dot: "#f04438"
  info: "#175cd3"
  info-bg: "#eff8ff"
  info-dot: "#2e90fa"
  mute: "#475467"
  mute-bg: "#f2f4f7"
  mute-dot: "#98a2b3"
  danger: "#d92d20"
  on-danger: "#ffffff"
  inverse: "#111827"
  on-inverse: "#f9fafb"
  bg-dark: "#0b0f17"
  surface-dark: "#121826"
  surface-2-dark: "#0f1520"
  surface-hover-dark: "#182032"
  border-dark: "#232b3a"
  border-strong-dark: "#344054"
  text-dark: "#e6e9ef"
  text-2-dark: "#b4bcc8"
  text-3-dark: "#8d97a8"
  accent-text-dark: "#84adff"
  accent-soft-dark: "rgba(37, 99, 235, .16)"
  accent-soft-2-dark: "rgba(132, 173, 255, .35)"
  ok-dark: "#47cd89"
  ok-bg-dark: "rgba(23, 178, 106, .14)"
  ok-dot-dark: "#47cd89"
  bad-dark: "#f97066"
  bad-bg-dark: "rgba(240, 68, 56, .14)"
  bad-dot-dark: "#f97066"
  info-dark: "#84caff"
  info-bg-dark: "rgba(46, 144, 250, .14)"
  info-dot-dark: "#53b1fd"
  mute-dark: "#98a2b3"
  mute-bg-dark: "rgba(152, 162, 179, .12)"
  mute-dot-dark: "#667085"
  inverse-dark: "#e6e9ef"
  on-inverse-dark: "#0b0f17"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.857rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.715rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.143rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.005em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.857rem"
    fontWeight: 600
    lineHeight: 1.5
  micro:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.786rem"
    fontWeight: 600
    lineHeight: 1.5
  display-compact:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  lead:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1.071rem"
    fontWeight: 650
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.929rem"
    fontWeight: 500
    lineHeight: 1.5
  input-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  quick-action-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.933rem"
    fontWeight: 600
    lineHeight: 1.2
  action-label-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
  tab-label-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.733rem"
    fontWeight: 600
rounded:
  sm: "4px"
  sm-plus: "6px"
  md: "8px"
  md-plus: "10px"
  lg: "12px"
  xl: "16px"
  sheet: "16px 16px 0 0"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-danger}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "38px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
  nav-item:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
  badge-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
  badge-bad:
    backgroundColor: "{colors.bad-bg}"
    textColor: "{colors.bad}"
    rounded: "{rounded.pill}"
    height: "22px"
  badge-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.info}"
    rounded: "{rounded.pill}"
    height: "22px"
  badge-mute:
    backgroundColor: "{colors.mute-bg}"
    textColor: "{colors.mute}"
    rounded: "{rounded.pill}"
    height: "22px"
  kpi-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    width: "min(560px, calc(100vw - 32px))"
  fab:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.xl}"
    padding: "0 20px 0 16px"
    height: "52px"
  toast:
    backgroundColor: "{colors.inverse}"
    textColor: "{colors.on-inverse}"
    padding: "10px 14px"
---

# Design System: Gestão de Obras

## Overview

**Creative North Star: "O Painel Exato"**

O padrão da categoria executado no nível do Stripe Dashboard: menu lateral, indicadores, tabelas e filtros que se entendem sem pensar, com números e prazos legíveis de relance. O sistema recusa enfeite e identidade inventada; a qualidade está na precisão do alinhamento, do espaçamento e da formatação dos dados, não em efeitos.

A densidade é de ferramenta de trabalho: base de 14px no computador (15px no celular), linhas de tabela de 12px de respiro vertical, superfícies brancas separadas por bordas de 1px e sombras curtas sobre um fundo cinza-azulado bem claro. Um único azul marca ação principal, seleção e foco; o resto da cor é reservado ao estado dos dados, sempre acompanhado de um ponto colorido.

O tema escuro é automático e só existe via `prefers-color-scheme`; não há alternância manual. Os mesmos tokens são redefinidos no bloco escuro, então nenhum componente escolhe cor por tema.

**Key Characteristics:**
- Superfície branca sobre fundo cinza-azulado, texto quase preto.
- Um azul só, para ação principal, seleção e foco.
- Estado sempre com ponto colorido: verde em andamento, vermelho prazo vencido, azul agendada, cinza arquivado.
- Fonte do sistema, números tabulares, bordas de 1px, sombras curtas e suaves.
- Ícones SVG de traço único (24px de grade, traço 1.75).
- Moeda no formato do usuário, R$1.900,00 sem espaço, inclusive nos rótulos compactos (R$1,9 mil).
- Celular com barra inferior de 5 seções, botão flutuante com rótulo, tabelas em cartões e diálogos em folhas inferiores.

## Colors

Paleta neutra fria com um único azul de ação e quatro pares de estado (texto, fundo, ponto).

### Primary
- **Azul de Ação** (accent, com texto em on-accent): botão principal, item de menu ativo (sobre o fundo azul suave), chip selecionado, barra do mês atual no gráfico, anel e contorno de foco, cursor de texto, botão flutuante e a marca.
- **Azul de Ação Profundo** (accent-hover / accent-text): hover do botão principal e texto azul sobre fundo claro (links, "Ver todas", migalhas). No escuro o texto azul passa a `#84adff` para manter contraste, enquanto o preenchimento do botão continua `#2563eb`.
- **Azul Suave** (accent-soft) e **Azul Bruma** (accent-soft-2): fundo do item ativo e do chip selecionado; borda do chip selecionado, anel de foco de 3px dos campos, seleção de texto e as barras dos meses passados no gráfico.

### Neutral
- **Cinza-Azulado de Fundo** (bg): o fundo da aplicação; também o hover de linhas e botões (surface-hover).
- **Superfície Branca** (surface): cartões, painéis, tabelas, campos, diálogos, barras móveis.
- **Superfície Recuada** (surface-2): menu lateral, cabeçalho de tabela, campo somente leitura, `kbd`.
- **Borda** (border) e **Borda Firme** (border-strong): divisórias e contorno de cartões; contorno de botões secundários e campos.
- **Tinta** (text), **Tinta Secundária** (text-2), **Tinta Terciária** (text-3): títulos e valores; rótulos de campo e menu; metadados, cabeçalhos de tabela, placeholders e ícones inativos.
- **Inverso** (inverse / on-inverse): avisos (toasts) em fundo escuro no tema claro e claro no tema escuro.

### Estados
- **Em andamento**: ok / ok-bg / ok-dot (verde). Também o botão "Ligar" no cartão móvel e o ponto de "Sincronizado em tempo real".
- **Prazo vencido**: bad / bad-bg / bad-dot (vermelho). Também textos de prazo vencido, erro de formulário e hover de excluir.
- **Agendada**: info / info-bg / info-dot (azul informativo, distinto do azul de ação).
- **Arquivado**: mute / mute-bg / mute-dot (cinza).
- **Destrutivo** (danger / on-danger): preenchimento do botão de excluir e do aviso de erro, com texto branco em `on-danger`; iguais nos dois temas.

### Tema escuro
Cada token redefinido no bloco `prefers-color-scheme: dark` está no frontmatter com o sufixo `-dark` (por exemplo `bg-dark`, `text-3-dark`); são os valores normativos do tema escuro. Fundo quase preto azulado, superfícies em azul-ardósia escuro, tinta clara em três níveis; os fundos de estado viram transparências de 12 a 16% da cor do ponto e os textos de estado clareiam. Valem iguais nos dois temas, sem versão escura: accent, accent-hover, on-accent, danger e on-danger. As sombras ficam pretas e mais densas (ver sidecar).

### Named Rules
**The One Blue Rule.** O azul de ação (`#2563eb`) aparece só em ação principal, seleção e foco. Nunca como decoração, fundo de seção ou cor de título.

**The Dot Rule.** Todo estado de dado leva o ponto colorido de 6px antes do texto, dentro de um selo em pílula. A cor sozinha nunca carrega o significado; o rótulo escrito ("Prazo vencido") vem sempre junto.

**The Token-Only Theme Rule.** O tema escuro é automático (`prefers-color-scheme`), sem botão de alternância. Componentes usam apenas as variáveis de `:root`; nenhuma cor é escolhida por tema dentro de um componente.

## Typography

**Display Font:** fonte do sistema (-apple-system, Segoe UI, Roboto, com Helvetica Neue e Arial de reserva)
**Body Font:** a mesma fonte do sistema
**Label/Mono Font:** nenhuma distinta; números usam algarismos tabulares da mesma fonte

**Character:** Uma família só, neutra e nativa de cada aparelho. A hierarquia vem de peso (400, 500, 600, 650) e tamanho, não de troca de fonte.

### Hierarchy
- **Display** (650, 1.857rem, 1.2, -0.02em, tabular): valor dos indicadores do painel.
- **Display compacto** (650, 1.5rem): valor dos indicadores no celular e título do cartão de login.
- **Headline** (650, 1.715rem, 1.25, -0.015em, `text-wrap: balance`): título da seção (h1).
- **Headline móvel** (650, 1.6rem): o mesmo h1 abaixo de 860px.
- **Title** (600, 1.143rem, 1.35): título de painel e de diálogo (h2).
- **Lead** (1.071rem): nome da marca (650), título do estado vazio e campo da busca geral (400).
- **Body** (400, 1rem, 1.5): texto corrente e células. Base de 14px no computador, 15px no celular. Títulos de célula e nomes em 600.
- **Control** (500 a 600, 0.929rem): rótulo de campo, caixa de seleção, chip, ação de linha, migalhas.
- **Label** (500 a 600, 0.857rem): metadados, subtítulos de célula, cabeçalho de tabela, contagens do menu, rodapé dos indicadores.
- **Micro** (600, 0.786rem): texto do selo de estado, valores das barras do gráfico, nome de grupo na busca geral, `kbd`.

Base de 14px no `html` do computador e 15px abaixo de 860px. No celular, três componentes fixam o tamanho em pixels do computador, compensando a base maior: rótulo da barra inferior (0.733rem, 11px), rótulo das ações do cartão (0.8rem, 12px) e ações rápidas do painel (0.933rem, 14px). Campos de texto no celular usam 16px exatos.

### Named Rules
**The Tabular Rule.** Todo número que se compara (valores, datas, contagens, paginação) usa `font-variant-numeric: tabular-nums`; colunas numéricas alinham à direita.

**The Brazilian Format Rule.** Moeda no formato R$1.900,00, sem espaço depois do R$, em toda a interface, incluindo rótulos compactos do gráfico (R$1,9 mil). Datas dd/mm/aaaa. CPF 111.111.111-11, CNPJ 11.222.333/0001-81 e alfanumérico 12.ABC.345/01DE-35, telefone (71)9 2222-2222 (fixo (71)2222-2222). Campos aplicam a máscara enquanto se digita; a moeda entra pelos centavos.

## Layout

No computador, grade de duas colunas: menu lateral fixo de 240px (sticky, altura total) e área principal de até 1400px com respiro de 28px 32px 48px. Cada seção é uma coluna com 20px entre blocos: cabeçalho da página (título, subtítulo de data ou contagem, ações à direita), barra de ferramentas (busca até 420px, chips de filtro, total à direita) e o conteúdo.

O painel tem uma linha de 4 indicadores (16px de intervalo) e uma grade 1.5fr / 1fr com obras em andamento à esquerda e faturamento de 6 meses à direita; notas recentes ocupam a largura toda. Abaixo de 1180px os indicadores passam a 2 colunas e a grade do painel a 1.

Abaixo de 860px (celular): o menu lateral some; entram uma barra superior de 56px (marca e busca) e uma barra inferior fixa de 64px com as 5 seções (ícone 22px e rótulo). Cada seção tem um botão flutuante com rótulo da ação principal ("Nova nota fiscal", etc.), acima da barra inferior; abaixo de 340px ele vira só ícone. O fim da lista reserva 100px para o último cartão nunca ficar sob o botão. Os chips rolam na horizontal sem quebrar. Tudo respeita `env(safe-area-inset-*)`.

Ritmo de espaçamento observado: 4, 8, 12, 16, 20, 24 e 32px, com 2, 6 e 10px em ajustes internos de ícone e texto.

### Named Rules
**The Thumb Reach Rule.** No celular, todo alvo de toque tem pelo menos 44px (campos 46px, botões de folha 48px, ações de cartão 56px, botão flutuante 52px) e campos de texto usam 16px para o navegador não dar zoom.

## Elevation & Depth

Híbrido discreto: as superfícies se separam do fundo por borda de 1px e uma sombra curta quase imperceptível. A sombra cresce só para o que flutua (diálogos, avisos, botão flutuante) ou como resposta a hover em cartões clicáveis.

### Shadow Vocabulary
- **Repouso** (`--shadow-sm`: `0 1px 2px rgba(16, 24, 40, .05)`): cartões, painéis, botões, campos, busca. Some ao pressionar o botão.
- **Elevado** (`--shadow-md`: `0 4px 8px -2px rgba(16, 24, 40, .08), 0 2px 4px -2px rgba(16, 24, 40, .04)`): cartão de login e hover dos arquivos recentes.
- **Flutuante** (`--shadow-lg`: `0 20px 24px -4px rgba(16, 24, 40, .10), 0 8px 8px -4px rgba(16, 24, 40, .04)`): diálogos e avisos.
- **Flutuante de ação** (`--shadow-fab`: `0 8px 16px -4px rgba(16, 24, 40, .28)`, sempre somada a `--shadow-md`): só o botão flutuante do celular. Definida apenas no tema claro; o escuro herda o mesmo valor.
- **Fundo de diálogo** (`--scrim`: `rgba(16, 24, 40, .45)`).

### Named Rules
**The Short Shadow Rule.** Sombras são suaves, difusas e na cor da tinta (`rgba(16, 24, 40, …)`); nunca deslocadas e duras, nunca coloridas. A borda de 1px faz o trabalho estrutural; a sombra só indica altura.

## Shapes

Cantos levemente arredondados e consistentes por escala: 6px em peças pequenas dentro do texto (migalhas, barra de esqueleto), 8px em controles (botões, campos, itens de menu, ações de linha, marca, quadrados de ícone), 10px em avisos e cartões de arquivo recente, 12px em cartões, painéis, indicadores e no quadrado do estado vazio, 16px em diálogos, cartão de login e botão flutuante, 999px em chips e selos, círculo (50%) em pontos de estado e avatar. No celular os diálogos viram folhas com cantos superiores de 16px e base reta. As barras do gráfico têm só o topo arredondado (4px). O contorno de foco usa 4px. Bordas sempre de 1px, sólidas.

## Components

### Buttons
Contidos e firmes.
- **Shape:** cantos de 8px, altura 36px (42px em bloco, 48px no rodapé das folhas móveis).
- **Primary:** azul de ação com texto branco, peso 600, ícone de 16px à esquerda com 8px de intervalo. Um por tela no cabeçalho.
- **Secondary:** superfície branca, borda firme, sombra de repouso; hover no fundo cinza-azulado.
- **Danger:** preenchimento destrutivo, usado só no diálogo de confirmação.
- **Hover / Focus:** transição de 150ms em cor e sombra; foco com contorno de 2px azul a 2px de distância. Pressionar remove a sombra (no celular, escurece 8%).
- **Ícone e link:** botão de ícone 32px transparente em tinta terciária; link em azul de texto, peso 600, sublinhado só no hover.
- **Ações rápidas do painel (celular):** dois botões de 68px lado a lado, ícone em cima e rótulo embaixo, principal primeiro.

### Chips
- **Style:** pílula de 32px (44px no celular), borda de 1px, superfície branca, tinta secundária, com contagem tabular opcional.
- **State:** selecionado com fundo azul suave, borda azul bruma, texto azul e peso 600 (`aria-pressed`).

### Status Badge
- Pílula de 22px, texto micro 600, ponto de 6px antes do rótulo; quatro variantes (ok, bad, info, mute). Ver The Dot Rule.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** superfície branca.
- **Shadow Strategy:** repouso (ver Elevation & Depth).
- **Border:** 1px na borda padrão.
- **Internal Padding:** indicadores 18px 20px (14px no celular); cabeçalho de painel 16px 20px 12px.
- **Indicador (KPI):** rótulo em tinta secundária 500, valor em Display, rodapé em Label que fica verde ou vermelho com peso 600 quando sinaliza estado.

### Tables
- Cabeçalho fixo em superfície recuada, Label 600 em tinta terciária; células com 12px 16px e divisória de 1px; hover de linha no fundo cinza-azulado; linha recém-salva pisca em azul suave por 1.8s.
- Célula principal com título 600 e subtítulo em Label; arquivados em tinta terciária.
- Ações por linha: ícones de 32px em tinta terciária; excluir fica vermelho no hover.
- **No celular**, cada linha vira cartão (12px de canto, 14px 16px de respiro), com rótulo do campo à esquerda e valor à direita, e uma fileira de ações de mesmo tamanho (56px, ícone sobre rótulo): Ligar (fundo verde), Arquivos, Editar e Mais. A tabela compacta do painel vira lista simples dentro do painel, sem cartão dentro de cartão.

### Inputs / Fields
- **Style:** 38px de altura (46px no celular), borda firme, cantos de 8px, sombra de repouso; rótulo acima em 500, 0.929rem, tinta secundária; dica em Label terciária.
- **Focus:** borda azul e anel de 3px em azul bruma, sem contorno nativo.
- **Error / Disabled:** erro de formulário em bloco com fundo e texto vermelhos de estado; somente leitura em superfície recuada e tinta secundária. Select e data usam ícones SVG de traço próprios, nas cores da tinta terciária de cada tema.

### Navigation
- **Menu lateral:** superfície recuada com borda direita; marca (quadrado azul de 30px com ícone e nome em 650), gatilho de busca com `Ctrl K`, itens de 36px com ícone de 18px, rótulo 500 e contagem tabular à direita. Hover em fundo cinza-azulado; ativo em azul suave com texto azul 600. No rodapé, estado do tempo real com ponto verde (halo de 3px) e usuário com avatar circular de iniciais.
- **Barra inferior (celular):** 5 colunas iguais, ícone de 22px e rótulo de 0.733rem 600 em tinta terciária; ativo em azul com traço do ícone engrossado para 2.1.

### Dialogs and Sheets
- Diálogo de até 560px (440px para confirmação, 640px para busca), cantos de 16px, sombra flutuante, entrada subindo 8px em 200ms. Cabeçalho com título e botão fechar; rodapé alinhado à direita.
- **No celular** viram folhas inferiores de largura total, até 92% da altura, com rodapé fixo, botões de 48px dividindo a largura e campos em uma coluna. A busca geral ocupa a tela inteira.

### Busca geral
Paleta de comandos aberta por `Ctrl K` ou pelo ícone de busca: campo de 44px sem borda, resultados agrupados por tipo com nome do grupo em Micro terciária, itens de 52px com ícone em quadrado de 32px, hover e foco em azul suave.

### Floating Action Button (celular)
Pílula de 52px com cantos de 16px, azul de ação, ícone e rótulo da ação principal da seção, peso 650, sombra `--shadow-fab` somada a `--shadow-md`. Esconde quando a seção não tem ação.

### Avisos (toasts)
Canto inferior direito (no celular, largura total acima da barra inferior), cantos de 10px, fundo inverso; erro em vermelho destrutivo com texto `on-danger`; aviso de tempo real com ponto verde.

## Do's and Don'ts

### Do:
- **Do** usar o azul de ação (`#2563eb`) só para ação principal, seleção e foco.
- **Do** acompanhar todo estado de dado com selo em pílula, ponto colorido e rótulo escrito: verde em andamento, vermelho prazo vencido, azul agendada, cinza arquivado.
- **Do** formatar moeda como R$1.900,00 (sem espaço) em todo lugar, inclusive no compacto R$1,9 mil, e alinhar números à direita com algarismos tabulares.
- **Do** separar superfícies com borda de 1px e sombra de repouso (`0 1px 2px rgba(16, 24, 40, .05)`), reservando sombras maiores para o que flutua.
- **Do** desenhar ícones como SVG de traço único em grade de 24px, traço 1.75, `currentColor`.
- **Do** manter, abaixo de 860px, barra inferior com as 5 seções, botão flutuante com rótulo, tabelas como cartões com Ligar/Arquivos/Editar/Mais, diálogos como folhas inferiores e busca em tela cheia.
- **Do** usar só as variáveis de `:root` para cor, para o tema escuro automático funcionar sem código extra.

### Don't:
- **Don't** adicionar botão de alternância de tema; o escuro segue `prefers-color-scheme`.
- **Don't** usar o azul de ação como decoração, fundo de seção ou cor de título, nem confundi-lo com o azul informativo de "Agendada".
- **Don't** indicar estado só com cor, sem ponto e sem rótulo.
- **Don't** usar sombras duras deslocadas, sombras coloridas ou gradientes decorativos; o único gradiente é o brilho do esqueleto de carregamento.
- **Don't** trocar a fonte do sistema por fonte de exibição, nem usar caracteres ou emoji como ícone.
- **Don't** colocar rótulos pequenos (kickers) acima dos títulos de seção; o título e o subtítulo bastam.
- **Don't** pôr cartão dentro de cartão; dentro de um painel, listas são linhas com divisória.
- **Don't** criar alvos de toque menores que 44px no celular.
