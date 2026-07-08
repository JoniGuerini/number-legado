/** Português (Brasil) — the source of truth for translation keys.
    Every other locale file must implement `Dict` (all keys, checked at
    compile time). */

export const pt = {
  // Navegação principal (rodapé) — também nomeia os modos pelo app todo
  'nav.geradores': 'Geradores',
  'nav.ciclos': 'Ciclos',
  'nav.reino': 'Reino',
  'nav.atividade': 'Atividade',
  'nav.chat': 'Social',
  'nav.notas': 'Notas de atualização',
  'nav.config': 'Config',

  // Compartilhado entre os modos de jogo
  'common.exportCsv': 'Exportar CSV',
  'common.start': 'Iniciar',
  'common.startLabel': 'início',
  'common.time': 'tempo',
  'common.produced': 'produzido',
  'common.toStart': 'Ir para o começo',
  'common.toEnd': 'Ir para o fim',
  'common.close': 'Fechar',

  // Tela de escolha de modo (Geradores/Ciclos)
  'mode.title': 'Modo de jogo',
  'mode.manual': 'Manual',
  'mode.auto': 'Automático',
  'mode.hintAuto':
    'O jogo compra sozinho o gerador de maior nível que couber no saldo: desbloqueia o próximo ou empilha o mais alto já desbloqueado.',
  'mode.hintManual': 'Você faz todas as compras manualmente.',

  // Geradores / Ciclos
  'gen.autoToggle': 'Automático: {state}',
  'gen.baseNumber': 'número base',
  'gen.owns': 'possui',
  'gen.produces': 'produz {target}',
  'cyc.cycleEvery': 'ciclo {time}',
  'cyc.perCycleSuffix': '/ ciclo',

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
  'activity.sincePrev': 'tempo desde o anterior',
  'activity.gameStart': 'início do jogo',
  'activity.pace': 'ritmo vs. desbloqueio anterior',
  'activity.samePace': 'mesmo ritmo',
  'activity.slower': 'mais lento',
  'activity.faster': 'mais rápido',

  // Cardzinhos de telemetria do topo
  'fps.production': 'produção',
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
  'saves.reset': 'Zerar {game}',
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
  'video.gameplay': 'no jogo',
  'video.cycleBars': 'Barras de progresso dos ciclos',

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

  // Modo Reino: sub-abas (linhas de produção)
  'reino.line.comida': 'Comida',
  'reino.line.mineracao': 'Mineração',
  'reino.line.remedios': 'Remédios',
  'reino.line.militar': 'Militar',
  'reino.soon': 'Em breve',

  // Modo Reino: linha de Comida (recurso base + 12 geradores nomeados)
  'reino.base.comida': 'Trigo',
  'reino.gen.comida.1': 'Ceifeiro',
  'reino.gen.comida.2': 'Camponês',
  'reino.gen.comida.3': 'Lavrador',
  'reino.gen.comida.4': 'Feitor',
  'reino.gen.comida.5': 'Aldeia',
  'reino.gen.comida.6': 'Vila',
  'reino.gen.comida.7': 'Feudo',
  'reino.gen.comida.8': 'Nobre',
  'reino.gen.comida.9': 'Barão',
  'reino.gen.comida.10': 'Conde',
  'reino.gen.comida.11': 'Duque',
  'reino.gen.comida.12': 'Reino',

  // Chat (multiplayer — protótipo/mock)
  'chat.preview': 'Prévia',
  'chat.previewNote': 'Chat fictício — prévia do multiplayer com ranking.',
  'chat.channel.global': 'Global',
  'chat.channel.rank': 'Ranqueada',
  'chat.channel.cla': 'Clã',
  'chat.channels': 'Canais',
  'chat.dms': 'Diretas',
  'chat.membersTitle': 'Online',
  'chat.friends': 'Amigos',
  'chat.openDm': 'Abrir conversa',
  'chat.deleteChat': 'Excluir conversa',
  'chat.viewProfile': 'Ver perfil',
  'chat.addFriend': 'Adicionar amigo',
  'chat.removeFriend': 'Remover amigo',
  'chat.profile.online': 'Online',
  'chat.profile.offline': 'Offline',
  'chat.profile.ranking': 'Ranking',
  'chat.profile.prosperity': 'Prosperidade',
  'chat.profile.wheat': 'Trigo/s',
  'chat.profile.topGen': 'Gerador atual',
  'chat.profile.generators': 'Geradores',
  'chat.profile.clan': 'Clã',
  'chat.profile.noClan': 'Sem clã',
  'chat.profile.since': 'Joga desde',
  'chat.profile.season': 'Temporada {n}',
  'chat.profile.friend': 'Amigo',
  'chat.noFriends': 'Nenhum amigo ainda',
  'chat.online': '{n} online',
  'chat.offline': 'offline',
  'chat.placeholder': 'Envie uma mensagem…',
  'chat.dmPlaceholder': 'Mensagem para {name}…',
  'chat.dmEmpty': 'Comece uma conversa com {name}.',
  'chat.mentionsYou': 'Mencionaram você ({n})',
  'chat.jumpToMention': 'Mencionaram você · ir para a mensagem',
  'chat.send': 'Enviar',
  'chat.you': 'Você',
  'chat.sys.joined': '{name} entrou no canal',
  'chat.sys.rankup': '{name} subiu para {rank}',
  'chat.rank.bronze': 'Bronze',
  'chat.rank.prata': 'Prata',
  'chat.rank.ouro': 'Ouro',
  'chat.rank.platina': 'Platina',
  'chat.rank.diamante': 'Diamante',
  'chat.rank.mestre': 'Mestre',
};

export type TKey = keyof typeof pt;

/** Shape every locale file must implement. */
export type Dict = Record<TKey, string>;
