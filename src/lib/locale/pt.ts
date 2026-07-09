/** Português (Brasil) — the source of truth for translation keys.
    Every other locale file must implement `Dict` (all keys, checked at
    compile time). */

export const pt = {
  // Navegação (topo: Atividade / Combate / Config; geradores = nome do modo)
  'nav.geradores': 'Geradores',
  'nav.atividade': 'Atividade',
  'nav.combate': 'Combate',
  'nav.config': 'Configurações',

  // Combate (protótipo turno a turno — visual sandbox)
  'combat.playerName': 'Aventureiro',
  'combat.enemyName': 'Sombra',
  'combat.status.yourTurn': 'Seu turno',
  'combat.status.enemyTurn': 'Turno inimigo',
  'combat.status.won': 'Vitória',
  'combat.status.lost': 'Derrota',
  'combat.act.attack': 'Atacar',
  'combat.act.heal': 'Curar',
  'combat.act.defend': 'Defender',
  'combat.again': 'De novo',
  'combat.log.title': 'Log',
  'combat.log.start': 'O combate começa.',
  'combat.log.attack': '{actor} ataca {target} por {dmg}.',
  'combat.log.heal': '{actor} recupera {heal} de vida.',
  'combat.log.defend': '{actor} se prepara para defender.',
  'combat.log.noMana': 'Mana insuficiente.',
  'combat.log.won': 'Você venceu.',
  'combat.log.lost': 'Você foi derrotado.',

  // Compartilhado
  'common.exportCsv': 'Exportar CSV',
  'common.start': 'Iniciar',
  'common.startLabel': 'início',
  'common.produced': 'produzido',
  'common.toStart': 'Ir para o começo',
  'common.toEnd': 'Ir para o fim',
  'crash.message': 'Algo deu errado. Recarregue para continuar.',
  'crash.reload': 'Recarregar',

  // Tela de escolha de modo
  'mode.title': 'Modo de jogo',
  'mode.manual': 'Manual',
  'mode.auto': 'Automático',
  'mode.hintAuto':
    'O jogo compra sozinho o gerador de maior nível que couber no saldo: desbloqueia o próximo ou empilha o mais alto já desbloqueado.',
  'mode.hintManual': 'Você faz todas as compras manualmente.',

  // Geradores
  'gen.autoToggle': 'Automático: {state}',
  'gen.baseNumber': 'recurso base',
  'gen.owns': 'possui',
  'gen.produces': 'produz {target}',
  // Header fixo da tabela de geradores
  'gen.colGen': 'gerador',
  'gen.colProduces': 'produz',
  'gen.colInvest': 'investir',
  'gen.colMult': 'multiplicador',
  'gen.colBuy': 'comprar',
  'gen.colBuyMax': 'máx',
  'gen.buyMaxBtn': '{cost}',
  'gen.buyMaxAria': 'Comprar {n} unidades por {cost}',
  'gen.buyMultAria': 'Comprar até {n} unidades por {cost}',
  // Atalhos do botão comprar (rodapé)
  'shortcut.aria': 'Atalhos do botão comprar',
  'shortcut.alt': 'Alt',
  'shortcut.cmd': '⌘',
  'shortcut.ctrl': 'Ctrl',
  'shortcut.shift': 'Shift',
  'shortcut.x5': '×5',
  'shortcut.x10': '×10',
  'shortcut.x50': '×50',
  'shortcut.x100': '×100',
  'gen.buyMaxWarnTitle': 'Pouca eficiência',
  'gen.buyMaxWarnBody':
    'O máx do gerador {n} compra {buy}, abaixo da produção do gerador {next} ({rate}/s).',
  'gen.buyMaxWarnConfirm': 'Confirmar',
  'gen.buyMaxWarnCancel': 'Voltar',
  // Timer do botão de desbloqueio quando o custo já foi atingido
  'gen.unlockReady': 'Pronto',

  // Fragmentos (marcos 10/100/1000…; cada marco rende o tier do gerador)
  'frag.label': 'fragmentos',
  'frag.claimAria': 'Resgatar {n} fragmentos',
  'frag.next': 'próximo fragmento',
  'frag.claimAll': 'resgatar tudo',
  'frag.claimAllAria': 'Resgatar os fragmentos pendentes de todos os geradores',
  'frag.investBtn': '{cost}',
  'frag.investAria':
    'Investir {cost} fragmentos: dobra a produção do gerador {n}',
  'frag.investTipTitle': 'Próximo gerador',
  'frag.investTipNow': 'agora',
  'frag.investTipAfter': 'depois',
  'frag.investTipSaved': 'economiza',
  'frag.investTipDelayed': 'atrasa',
  'frag.investTipUnits': 'compra',
  'frag.investTipNoChange': 'sem mudança',
  'frag.investTipBecomes': 'passa a ser alcançável',
  'frag.investTipCantAfford': 'faltam {need}',
  'frag.investTipReady': 'Próximo gerador já pronto',
  'frag.investTipUnknown': 'Sem previsão de desbloqueio',

  // Prestígio (reset da run → produção permanente ×2 por nível)
  'prestige.mult': '×{mult}',
  'prestige.preview': 'Prestígio +{gain} → ×{mult}',
  'prestige.confirm': 'Confirmar +{gain} → ×{mult}',
  'prestige.cancel': 'Cancelar',

  // Atividade (log de desbloqueios)
  'activity.empty': 'Nenhum desbloqueio registrado no modo {game} ainda.',
  'activity.cta': 'Começar a jogar {game}',
  'activity.unlocked': 'geradores desbloqueados',
  'activity.playTime': 'tempo de jogo',
  'activity.avgInterval': 'média do “tempo desde o anterior”',
  'activity.sinceLast': 'desde o último',
  'activity.generator': 'Gerador {n}',
  'activity.unlockedWith': 'desbloqueado com',
  'activity.ofPlay': '{time} de jogo',
  'activity.prevTier': 'tinha do tier anterior',
  'activity.sincePrev': 'tempo desde o anterior',
  'activity.gameStart': 'início do jogo',
  'activity.pace': 'ritmo vs. desbloqueio anterior',
  'activity.samePace': 'mesmo ritmo',
  'activity.slower': 'mais lento',
  'activity.faster': 'mais rápido',

  // Cardzinhos de telemetria do topo
  'fps.max': 'máx',
  'fps.newVersion': 'Nova versão pendente',

  // Config: tabs
  'tab.saves': 'Jogos salvos',
  'tab.temas': 'Temas',
  'tab.som': 'Som',
  'tab.video': 'Vídeo',
  'tab.idioma': 'Idioma',

  // Config: Saves
  'saves.title': 'Jogos salvos',
  'saves.hint': 'Seus jogos salvos.',
  'saves.active': 'ativo',
  'saves.load': 'Carregar jogo salvo',
  'saves.reset': 'Resetar',
  'saves.resetConfirm': 'Confirmar',
  'saves.rename': 'Renomear',
  'saves.create': 'Criar novo jogo salvo +',
  'saves.confirmCreate': 'Criar',
  'saves.cancel': 'Cancelar',
  'saves.deleteAria': 'Excluir {name}',
  'saves.nameAria': 'Nome do {name}',
  'saves.newNameAria': 'Nome do novo jogo salvo',
  'saves.defaultName': 'Jogo salvo {n}',
  'saves.noData': 'sem dados',

  // Config: Temas
  'themes.title': 'Temas',
  'themes.hint': 'Biblioteca de temas.',
  'themes.active': 'tema ativo',
  'themes.available': 'disponíveis',
  'theme.neutro': 'Dark neutro',
  'theme.midnight': 'Azul meia-noite',
  'theme.creme': 'Creme terracota',
  'theme.verde': 'Verde musgo',

  // Config: Som
  'sound.title': 'Som',
  'sound.hint': 'Som do click dos botões.',
  'sound.enabled': 'Som',
  'sound.volumeAria': 'Volume do som dos botões',

  // Config: Vídeo
  'video.title': 'Vídeo',
  'video.hint': 'Opções de exibição.',
  'video.all': 'Todos os cards',
  'video.individual': 'cards individuais',
  'video.fps': 'FPS',
  'video.frameTime': 'Frame time',
  'video.battery': 'Bateria',
  'video.memory': 'Memória',
  'video.domNodes': 'Nós de DOM',

  // Config: Idioma
  'lang.title': 'Idioma',
  'lang.hint': 'Selecione o idioma.',

  // Config: restaurar padrões
  'config.reset': 'Restaurar padrões',
  'config.resetWarn':
    'Restaurar temas, som, vídeo e idioma para o padrão? Os jogos salvos não são afetados.',
  'config.resetConfirm': 'Restaurar',

  // Botão de tela cheia (topo)
  'fullscreen.enter': 'Tela cheia',
  'fullscreen.exit': 'Sair da tela cheia',
};

export type TKey = keyof typeof pt;

/** Shape every locale file must implement. */
export type Dict = Record<TKey, string>;
