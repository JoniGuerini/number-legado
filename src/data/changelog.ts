/** Notas de patch exibidas na aba Notas — a história do laboratório.

    Cada versão é organizada em um resumo (summary) + seções por categoria:
    - major: grandes funcionalidades / mudanças de destaque
    - minor: funcionalidades menores e mudanças notáveis
    - qol:   qualidade de vida e polimento
    - fixes: correções de bugs

    Entradas até a v0.12.0 permanecem em português; a partir da v0.12.1 o
    inglês é a língua canônica do projeto (as notas antigas ficam no idioma
    original, como documentos históricos que são). */

export interface PatchNote {
  version: string;
  date: string;
  /** Hora do patch (HH:MM). Não dá para recuperar retroativamente, então as
      entradas antigas não têm — a UI mostra "—" no lugar. */
  time?: string;
  title: string;
  /** Uma linha que resume o patch. */
  summary: string;
  /** Grandes funcionalidades / mudanças de destaque. */
  major?: string[];
  /** Funcionalidades menores e mudanças notáveis. */
  minor?: string[];
  /** Qualidade de vida e polimento. */
  qol?: string[];
  /** Correções de bugs. */
  fixes?: string[];
}

/** Da mais recente para a mais antiga. */
export const CHANGELOG: PatchNote[] = [
  {
    version: 'v0.17.0',
    date: '05/07/2026',
    time: '00:40',
    title: 'Social — chat preview',
    summary:
      'A rich preview of the upcoming multiplayer chat, with friends, ranking and profiles.',
    major: [
      'New Social page (100% mock, for now): a preview of the future multiplayer chat. Public channels (Global, Ranked, Clan) and 1:1 direct messages, with rank-colored names and system events like rank-ups.',
      'Friends: a friends list sits next to the online players, each with an online/offline status. Right-click any player — in Online, Friends or the DM list — for options: view profile, open chat, add/remove friend and delete conversation.',
      'Player profile modal: ranking position, prosperity, wheat/s, top generator, generators unlocked, clan and the season they started playing.',
    ],
    minor: [
      'Mentions: @-autocomplete while you type, highlighted mentions inside messages, and a persistent "jump to mention" card that jumps to the first message that mentioned you — shown only while that message is off-screen.',
      'Unread counters for DMs and per-channel mention counts; your own messages align to the right, chat-app style.',
    ],
    qol: [
      'Kingdom: the production-line tabs are now hidden on the mode-select screen, where there is nothing to switch between yet.',
    ],
  },
  {
    version: 'v0.16.11',
    date: '04/07/2026',
    time: '20:19',
    title: 'Smarter auto mode',
    summary:
      'Auto mode now stacks the highest generator, not just unlocks the next.',
    qol: [
      'Auto mode now keeps progressing like a player would: each step it either unlocks the next generator or stacks another copy of the highest one you already own — and it never touches lower tiers. If it can afford neither, it waits.',
      'This fixes Kingdom auto mode stalling once the finite chain was fully unlocked — it now reinforces the top generator instead of idling.',
    ],
  },
  {
    version: 'v0.16.10',
    date: '04/07/2026',
    time: '20:01',
    title: 'Restore settings & tidier modal',
    summary:
      'A button to restore default settings, and a cleaner Settings modal.',
    qol: [
      'New "Restore defaults" button in the Settings footer: resets Themes, Sound, Video and Language to their defaults (with a confirmation step). Saved games are never touched.',
      'Removed the redundant ✕ on the Settings modal — click outside or press Esc to close — so the navigation tabs now use the full width.',
    ],
  },
  {
    version: 'v0.16.9',
    date: '04/07/2026',
    time: '19:52',
    title: 'Telemetry off by default',
    summary:
      'Telemetry cards now start hidden, leaving a cleaner default top bar.',
    qol: [
      'All Video telemetry cards (FPS, frame time, battery, memory, DOM nodes) now start off by default — turn on only what you want; your choice stays saved per device.',
      'The cycle progress bars remain on by default.',
    ],
  },
  {
    version: 'v0.16.8',
    date: '04/07/2026',
    time: '19:49',
    title: 'Patch notes, browsable',
    summary:
      'The patch notes get Steam-style feature banners, collapsible patches and jump-to-edge controls.',
    qol: [
      'Feature releases (x.y.0) now wear a Steam-style blue treatment: a header banner ("Feature release" for a MINOR, "Major update" for a MAJOR), a blue border and a subtle blue tint — the milestones stand out at a glance.',
      'Small patches now start collapsed, showing just version, title and date/time; click the row (or press Enter) to expand the details.',
      'Fade controls at the top and bottom of the list jump you to the start or the end, matching the Generators and Cycles lists.',
    ],
  },
  {
    version: 'v0.16.7',
    date: '04/07/2026',
    time: '19:31',
    title: 'Highlighted feature releases',
    summary:
      'Feature releases now stand out in the patch notes, Steam-style.',
    qol: [
      'Feature releases (x.y.0 — a MINOR or MAJOR) now get their own accent in the patch notes: a brass left bar, a warm background tint and a brighter version number, so the big milestones pop out from the small patches.',
      'Housekeeping: the previous release was reclassified as a PATCH (v0.17.0 → v0.16.6) — new telemetry cards and reordering aren\u2019t new game content, so they don\u2019t warrant a MINOR.',
    ],
  },
  {
    version: 'v0.16.6',
    date: '04/07/2026',
    time: '19:28',
    title: 'Kingdom up front & new telemetry',
    summary:
      'Kingdom takes the lead across the app, and telemetry gains memory and DOM-node readouts.',
    qol: [
      'Two new telemetry cards next to FPS and frame time: JS heap memory (MB, Chromium only) and a live DOM-node count — toggle them in Settings → Video, on by default. Handy for gauging how much features like hidden cycle bars actually save.',
      'Kingdom is now the first mode in the navigation and the default landing screen for first-time players; the Activity tabs lead with Kingdom too (Kingdom, Generators, Cycles).',
      'The "Notes" menu is now labelled "Patch notes".',
    ],
  },
  {
    version: 'v0.16.5',
    date: '04/07/2026',
    time: '19:05',
    title: 'Patch notes, laid out',
    summary:
      'The patch notes get a wider layout with a patch time, and the whole version history is renumbered.',
    qol: [
      'Each release now spans the full page width, with its Major, Minor, Quality-of-life and Fixes categories side by side in fixed-width columns (empty categories are skipped) — much easier to scan.',
      'Entries now show the patch time next to the date; historical entries with no recorded time show a "—" instead.',
      'Housekeeping: the entire version history was renumbered to a MAJOR.MINOR.PATCH scheme — PATCH for small fixes/QoL, MINOR for new content, MAJOR reserved for massive expansions. The game stays on 0.x until the 1.0 launch.',
    ],
  },
  {
    version: 'v0.16.4',
    date: '04/07/2026',
    title: 'Kingdom in Activity',
    summary: 'The Activity tab now tracks Kingdom unlocks too.',
    minor: [
      'New "Kingdom" tab in Activity: the unlock log now covers Kingdom alongside Cycles and Generators, listing each generator by its name (Reaper, Peasant, Farmer…) with the same times, intervals and pace breakdown.',
    ],
  },
  {
    version: 'v0.16.3',
    date: '04/07/2026',
    title: 'Toggleable cycle bars',
    summary:
      'A Video setting to hide the cycle progress bars, on by default.',
    qol: [
      'New "Cycle progress bars" switch in Settings → Video (on by default): hide the in-card cycle bars in Cycles and Kingdom if you prefer — the remaining-time column already shows the cycle.',
      'Purely visual: the setting is a per-device preference and never touches saves or the deterministic, bit-for-bit simulation.',
    ],
  },
  {
    version: 'v0.16.2',
    date: '04/07/2026',
    title: 'Patch notes revamp',
    summary:
      'The patch notes got a full revamp — every release is now organized into a summary plus color-coded sections.',
    qol: [
      'Each entry leads with a one-line summary, then groups its changes into labeled Major, Minor, Quality-of-life and Fixes sections so you can scan a release at a glance.',
      'Cleaner card layout with color-coded section tags.',
      'Applied retroactively across the entire history.',
    ],
  },
  {
    version: 'v0.16.1',
    date: '04/07/2026',
    title: 'Settings modal & Counter removal',
    summary:
      'Settings moved into a centered modal and the Counter mode was retired.',
    minor: [
      'Removed the Counter mode entirely: it was only a sandbox for validating ideas and was never really a game. The app now focuses on Generators, Cycles and Kingdom.',
    ],
    qol: [
      'Settings now opens as a centered square modal over the interface instead of a full page — close it by clicking outside, the ✕, or pressing Esc. Its section tabs live back inside the card.',
    ],
  },
  {
    version: 'v0.16.0',
    date: '04/07/2026',
    title: 'Kingdom mode (medieval production lines)',
    summary:
      'A new medieval Kingdom mode arrives with a fully playable Food production line.',
    major: [
      'New "Kingdom" mode: a medieval theme with several production lines you switch between via sub-tabs.',
      'The Food line is fully playable — harvest Wheat through a finite chain of 12 named generators (Reaper, Peasant, Farmer… up to Kingdom), each a deterministic cycle just like Cycles mode.',
    ],
    minor: [
      'Deliberately slow, medieval economy: cycles start at 2s and grow 3× per tier (minutes-long at the top), while per-cycle output is decoupled from cycle length (+0.1 per tier) — deeper tiers run long cycles for a modest yield, so their effective rate keeps dropping. The idea is to stack many copies of the same generator, so repeat purchases get gradually pricier.',
      'Every line runs its own independent, frame-rate-proof simulation anchored to wall-clock time, so progress stays perfectly reproducible.',
      'Mining, Medicine and Military lines are in as placeholders ("coming soon") for now.',
    ],
    qol: [
      'Auto mode no longer blocks manual purchases — it still auto-buys the next generator, but you can also buy on your own at any time.',
      'Locked generators now read as a progress bar (across Generators, Cycles and Kingdom): no card, just a filling bar toward the unlock cost, with the filled part in the same brass as the buy button. Costs show decimals so incremental price bumps are visible.',
    ],
  },
  {
    version: 'v0.15.3',
    date: '04/07/2026',
    title: 'Consistent Settings labels',
    summary: 'Settings tab labels now match their section titles.',
    fixes: [
      'Settings tab labels now match their section titles — the Saves tab reads "Jogos salvos" and the Video section is no longer titled "Telemetria".',
    ],
  },
  {
    version: 'v0.15.2',
    date: '04/07/2026',
    title: 'Fullscreen persistence & empty saves',
    summary:
      'Fullscreen survives a refresh and empty saves stop showing a fake date.',
    qol: [
      'Fullscreen now survives a refresh: the app re-enters fullscreen on your first click or keypress after reloading (browsers block auto-fullscreen without a gesture).',
      'Saves with no progress in any mode show "no data" instead of a meaningless date.',
    ],
  },
  {
    version: 'v0.15.1',
    date: '04/07/2026',
    title: 'Save reset tweaks',
    summary: 'Reset buttons behave better inside the save panel.',
    qol: [
      'Reset buttons are now disabled for modes with no progress yet — nothing to wipe, nothing to click.',
      'The three reset buttons (and the load button) now span the full width of the expanded save panel.',
    ],
  },
  {
    version: 'v0.15.0',
    date: '04/07/2026',
    title: 'Fullscreen & tidier Settings',
    summary: 'A fullscreen toggle arrives and Settings gets tidier.',
    minor: [
      'New fullscreen toggle at the top-left corner — enter or leave fullscreen with a single click (hidden where the browser has no Fullscreen API).',
    ],
    qol: [
      'Settings tabs now sit above the panel as standalone cards (like Activity), leaving the content card shorter and less boxed-in.',
    ],
  },
  {
    version: 'v0.14.1',
    date: '03/07/2026',
    title: 'Locale housekeeping',
    summary: 'Internal locale refactor — nothing changes in game.',
    minor: [
      'Internal: translations refactored into one file per language (src/lib/locale/), ready for more languages after 1.0.',
    ],
  },
  {
    version: 'v0.14.0',
    date: '03/07/2026',
    title: 'Ahora en español',
    summary: 'Español joins the UI, completing the 1.0 language trio.',
    major: [
      'Third UI language: Español — full dictionary, auto-detection for Spanish systems, localized dates and default save names (Partida N).',
    ],
    minor: [
      'The 1.0 language trio is set: English, Português (Brasil) and Español.',
    ],
  },
  {
    version: 'v0.13.4',
    date: '03/07/2026',
    title: 'Jogos salvos',
    summary: 'The Portuguese UI drops the "saves" loanword for "jogos salvos".',
    qol: [
      'The Portuguese UI now says "jogos salvos" instead of the English loanword "saves" — tab, titles, buttons and the default name of new saves (Jogo salvo N).',
    ],
  },
  {
    version: 'v0.13.3',
    date: '03/07/2026',
    title: 'Sound switch',
    summary: 'A sound on/off switch and simpler Video labels.',
    minor: [
      'Sound tab gained an on/off switch alongside the volume slider — mute without losing your volume level.',
    ],
    qol: [
      'Simpler labels on the Video toggles (FPS, Frame time, Battery), grouped under an "individual cards" label.',
    ],
  },
  {
    version: 'v0.13.2',
    date: '03/07/2026',
    title: 'One switch to rule them all',
    summary: 'A master switch toggles every telemetry card at once.',
    minor: [
      'Video tab gained an "All cards" master switch at the top: turns every telemetry card on or off at once.',
    ],
  },
  {
    version: 'v0.13.1',
    date: '03/07/2026',
    title: 'Less chatter in Settings',
    summary: 'Trimmed Settings copy and a cleaner active-save row.',
    qol: [
      'Settings descriptions trimmed to the essentials — shorter hints for Saves, Themes, Sound, Video and Language.',
      'The active save no longer shows a delete button (it was disabled anyway) — its card now takes the full row.',
    ],
  },
  {
    version: 'v0.13.0',
    date: '03/07/2026',
    title: 'The app speaks your language',
    summary: 'First-visit language now follows the OS/browser.',
    minor: [
      'On first visit the UI language now follows the OS/browser language: Portuguese systems get pt-BR, everything else gets English.',
    ],
    qol: [
      'Picking a language in Settings still overrides the detection and is remembered on the device.',
    ],
  },
  {
    version: 'v0.12.1',
    date: '03/07/2026',
    title: 'English as the canonical language',
    summary: 'English becomes the project\u2019s canonical language.',
    minor: [
      'English is now the project\u2019s canonical language: README, page metadata, docs and — starting with this entry — the patch notes are written in English.',
      'Portuguese (Brasil) remains fully available as a UI language for players; the app still opens in pt-BR by default.',
      'Older patch notes stay in Portuguese, as the historical documents they are.',
    ],
  },
  {
    version: 'v0.12.0',
    date: '03/07/2026',
    title: 'O laboratório fala inglês',
    summary: 'i18n chega: toda a interface em Português e English.',
    major: [
      'Suporte a idiomas (i18n): toda a interface agora existe em Português e English, com dicionários próprios e chaves tipadas.',
    ],
    minor: [
      'Nova aba Idioma na Config para trocar a língua — a escolha fica salva no dispositivo e vale para o app inteiro.',
      'Datas e horários acompanham o idioma (dd/mm vs. mm/dd).',
      'As notas de patch permanecem no idioma original, como documentos históricos que são.',
    ],
  },
  {
    version: 'v0.11.0',
    date: '03/07/2026',
    title: 'Saves com nome próprio',
    summary: 'Saves agora podem ser batizados e renomeados.',
    minor: [
      'Criar um save agora abre um campo de nome já preenchido com o genérico (Save N) — é só apagar e batizar como quiser antes de confirmar.',
      'Todo save pode ser renomeado: o campo fica no painel expandido, junto das outras opções.',
    ],
    qol: [
      'Enter confirma, Esc cancela a criação.',
      'O input de renomear ganhou um fundo mais claro dentro do painel escuro.',
      'Botões pressionados agora afundam 1px fixo em vez de encolher em porcentagem — botões largos não recuam mais de forma exagerada.',
    ],
    fixes: [
      'O filete de foco do input agora é cor sólida de verdade: a sombra interna do baixo relevo escurecia o topo dele, dando impressão de gradiente.',
      'O ✕ de excluir e a setinha de expandir viraram ícones desenhados (SVG): como caracteres de texto, cada sistema usava uma fonte diferente e os tamanhos divergiam entre macOS e Windows.',
    ],
  },
  {
    version: 'v0.10.1',
    date: '03/07/2026',
    title: 'Saves com calma',
    summary: 'O fluxo de saves ficou mais calmo, sem trocas acidentais.',
    minor: [
      'Clicar num save não troca mais na hora: abre um painel abaixo dele com as opções de carregar e de zerar cada modo.',
      'Os botões de zerar progresso saíram da seção solta e agora vivem dentro do save escolhido, lado a lado — dá até para zerar um modo de um save inativo.',
    ],
    qol: [
      'Os botões de carregar e de criar save usam o mesmo estilo dos botões de compra dos Geradores, com texto centralizado.',
      'Criar um novo save também ficou mais calmo: ele entra na lista sem assumir o lugar do atual; carregue quando quiser.',
    ],
  },
  {
    version: 'v0.10.0',
    date: '03/07/2026',
    title: 'Aba Temas e faixas exorcizadas',
    summary: 'Config ganha a aba Temas e o Chrome/macOS para de listrar o preto.',
    major: [
      'Config ganhou a aba Temas: cada tema virou um card pintado com as próprias cores, com um mini-mockup de interface dentro.',
    ],
    minor: [
      'O tema ativo fica em destaque no topo; os disponíveis se organizam lado a lado, quebrando linha conforme a coleção cresce.',
      'Tabs da Config agora ocupam a largura toda, e o conteúdo das abas também — os cards de tema aproveitam o espaço no desktop.',
    ],
    qol: [
      'O tema ativo perdeu o anel de destaque: a posição no topo já conta a história.',
      'Cards de tema agora têm largura fixa — o ativo parou de esticar pela tela toda.',
      'O app lembra em qual página você estava: dar refresh não te devolve mais para os Ciclos.',
    ],
    fixes: [
      'Corrigidas as faixas de pretos diferentes no Chrome/macOS: um micro-ruído imperceptível no fundo força todos os blocos de pintura pelo mesmo caminho de rasterização.',
    ],
  },
  {
    version: 'v0.9.0',
    date: '03/07/2026',
    title: 'Atividade para os dois modos',
    summary: 'A Atividade passa a cobrir Ciclos e Geradores.',
    minor: [
      'A Atividade ganhou abas Ciclos e Geradores — o log de desbloqueios agora cobre os dois modos.',
      'Modo sem desbloqueios mostra um convite com botão para começar a jogar dali mesmo.',
    ],
    qol: [
      'O card do gerador nos Geradores perdeu a coluna de desbloqueio (a informação vive na Atividade) e o grid foi redistribuído.',
    ],
  },
  {
    version: 'v0.8.0',
    date: '03/07/2026',
    title: 'Verde musgo e amostras',
    summary: 'Quarto tema (verde-musgo) e amostras de cor no seletor.',
    minor: [
      'Quarto tema: base verde-musgo escura com amarelo queimado (mostarda) nos acentos.',
    ],
    qol: [
      'O seletor de temas ganhou amostras de cores (fundo, card, acento, texto) ao lado de cada nome.',
    ],
  },
  {
    version: 'v0.7.0',
    date: '03/07/2026',
    title: 'Creme terracota',
    summary: 'Terceiro tema, agora claro: creme com terracota.',
    minor: [
      'Terceiro tema, agora claro: fundos em areia/creme, tintas em marrons quentes, terracota queimada como acento e sombras recalibradas para superfície clara.',
    ],
  },
  {
    version: 'v0.6.0',
    date: '03/07/2026',
    title: 'Sistema de temas',
    summary: 'Nasce o sistema de temas escolhíveis.',
    major: [
      'Paleta de cores escolhível na Config (aba Vídeo): Dark neutro ou Azul meia-noite, com aplicação instantânea e persistência no dispositivo.',
    ],
  },
  {
    version: 'v0.5.3',
    date: '03/07/2026',
    title: 'Dark neutro',
    summary: 'Dark mode de verdade: pretos e cinzas puros.',
    minor: [
      'Teste de paleta: a base azulada deu lugar a pretos e cinzas puros — dark mode de verdade, mantendo a hierarquia de profundidade (fundo → cards → superfícies) e o latão como acento.',
    ],
  },
  {
    version: 'v0.5.2',
    date: '03/07/2026',
    title: 'Canaleta calibrada',
    summary: 'A canaleta da barra de ciclo foi calibrada.',
    qol: [
      'A parte vazia da barra de ciclo foi calibrada num meio-termo: visível sem roubar atenção do preenchimento.',
    ],
  },
  {
    version: 'v0.5.1',
    date: '03/07/2026',
    title: 'Setinhas honestas',
    summary: 'Correção nas setinhas de navegação da lista.',
    fixes: [
      'Corrige as setinhas de navegação que às vezes ficavam visíveis (e inertes) mesmo com a lista já no fim — o estado das bordas envelhecia quando a virtualização mudava a altura do conteúdo sem evento de scroll.',
    ],
  },
  {
    version: 'v0.5.0',
    date: '03/07/2026',
    title: 'Notas de patch',
    summary: 'Estreia a aba Notas — esta página.',
    major: [
      'Nova aba Notas com o histórico de versões do laboratório — esta página.',
    ],
  },
  {
    version: 'v0.4.1',
    date: '03/07/2026',
    title: 'Barra de ciclo interna',
    summary: 'A fitinha de ciclo virou uma barra interna dedicada.',
    minor: [
      'A fitinha de 3px na borda dos cards dos Ciclos virou uma barra interna dedicada, com canaleta em baixo relevo e preenchimento em alto relevo.',
    ],
    qol: [
      'Cantos achatados no padrão dos cards e espessura calibrada em audições sucessivas.',
    ],
  },
  {
    version: 'v0.4.0',
    date: '03/07/2026',
    title: 'Config de gente grande',
    summary: 'Config vira painel único com tabs internas.',
    major: [
      'Config virou painel único com tabs internas: Saves, Som e Vídeo.',
    ],
    minor: [
      'Aba Vídeo estreia os toggles de telemetria: cards de FPS, frame time e bateria podem ser desligados.',
    ],
    qol: [
      'Switches deslizantes com relevo físico (canaleta afundada, bolinha flutuando).',
      'Slider de volume repaginado: pegador em pill, trilho em baixo relevo, preenchimento em alto relevo e halo no hover.',
    ],
  },
  {
    version: 'v0.3.0',
    date: '03/07/2026',
    title: 'Saves múltiplos',
    summary: 'Sistema de slots de save com migração automática.',
    major: [
      'Sistema de slots de save: crie, troque e exclua saves sem perder progresso — cada slot guarda os três modos.',
    ],
    minor: ['Zerar por modo passou a morar junto dos saves.'],
    qol: [
      'Migração automática do save antigo para o "Save 1", com sincronia bit a bit preservada.',
    ],
  },
  {
    version: 'v0.2.1',
    date: '03/07/2026',
    title: 'Virtualização',
    summary: 'Virtualização da lista leva o frame rate ao teto do monitor.',
    major: [
      'Cards fora da janela de scroll (e de abas ocultas) viram fantasmas de mesma altura: com 80+ geradores, o frame rate subiu de ~135fps para o teto do monitor (180fps).',
    ],
    minor: [
      'Simulação, sincronia e saves intocados — só a renderização emagreceu.',
    ],
  },
  {
    version: 'v0.2.0',
    date: '03/07/2026',
    title: 'Identidade de versão',
    summary: 'Pill de versão e detector de deploy pendente.',
    minor: [
      'Pill de versão no hub, alimentada pelo carimbo do build.',
      'Detector de deploy pendente: a pill vira o botão "Nova versão pendente" quando o servidor tem build mais novo (version.json consultado a cada 60s, sem backend).',
    ],
    qol: [
      'Contador ganhou o hub completo: início do save, tempo e Exportar CSV.',
    ],
  },
  {
    version: 'v0.1.0',
    date: '02/07/2026',
    title: 'A fundação',
    summary:
      'A fundação do laboratório: contador, geradores, ciclos, atividade e a infra.',
    major: [
      'Contador de formatação com break_eternity.js: sufixos K…No, letras infinitas (aa…zz, aaa…) e truncamento estilo odômetro.',
      'Geradores em cadeia contínua com desbloqueio progressivo, modo automático e curva de custos tunada por simulação.',
      'Ciclos: produção em rajadas com ciclos progressivos (5s × N) — e a descoberta de que rajadas nunca alcançam o contínuo.',
      'Atividade: log de desbloqueios com tempos explicados e ritmo colorido.',
    ],
    minor: [
      'Sincronia bit a bit entre máquinas: timestep fixo determinístico ancorado no relógio, com catch-up offline.',
      'Telemetria (FPS, frame time, bateria, ambiente), export CSV para balanceamento e wake lock.',
      'Som de clique sintetizado (o "Toc", garimpado de um bug alheio) com par pressionar/soltar e volume.',
    ],
    qol: [
      'Visual portado do design system do Coders, responsivo até no iPhone, com deploy contínuo na Vercel.',
    ],
  },
];
