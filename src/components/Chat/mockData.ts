/** Dados fictícios do chat (mock 100%). Nada aqui persiste nem fala com
    servidor: é só a semente visual do futuro chat multiplayer com ranking.
    O papo é sobre o jogo em si (progressão do Reino, geradores da linha de
    Comida, modo automático, ganhos offline e ranking por prosperidade). */

import type { TKey } from '../../lib/locale';

export type RankId =
  | 'bronze'
  | 'prata'
  | 'ouro'
  | 'platina'
  | 'diamante'
  | 'mestre';

export type ChannelId = 'global' | 'rank' | 'cla';

export const CHANNELS: ChannelId[] = ['global', 'rank', 'cla'];

/** Ordem de prestígio (referência/ordenação). */
export const RANKS: RankId[] = [
  'bronze',
  'prata',
  'ouro',
  'platina',
  'diamante',
  'mestre',
];

/** Rank do próprio jogador (as mensagens enviadas herdam este rank). */
export const SELF_RANK: RankId = 'ouro';

export interface ChatMessage {
  id: string;
  /** Nome do autor. Vazio quando `system` é true ou quando `self`. */
  author: string;
  rank?: RankId;
  text: string;
  /** 'HH:MM' já formatado (mock). */
  time: string;
  /** Mensagem de sistema (entrou no canal, subiu de rank…). */
  system?: boolean;
  /** i18n key + params para mensagens de sistema. */
  sysKey?: TKey;
  sysParams?: Record<string, string | number>;
  /** Fala do próprio jogador. */
  self?: boolean;
  /** A mensagem menciona você (@Você) — usada para o "ir para a menção". */
  mentionsYou?: boolean;
}

export interface Player {
  name: string;
  rank: RankId;
  online: boolean;
}

/** Roster de jogadores conhecidos (para a lista lateral e as menções). */
export const PLAYERS: Player[] = [
  { name: 'Yseult', rank: 'mestre', online: true },
  { name: 'Kaelen', rank: 'diamante', online: true },
  { name: 'Bramble', rank: 'diamante', online: true },
  { name: 'Mirena', rank: 'platina', online: true },
  { name: 'Petra', rank: 'platina', online: true },
  { name: 'Aldric', rank: 'ouro', online: true },
  { name: 'Rowan', rank: 'ouro', online: true },
  { name: 'Corvin', rank: 'prata', online: true },
  { name: 'Doran', rank: 'bronze', online: true },
  { name: 'Thane', rank: 'platina', online: false },
  { name: 'Isolde', rank: 'ouro', online: false },
  { name: 'Garrick', rank: 'prata', online: false },
];

export const rankOf = (name: string): RankId | undefined =>
  PLAYERS.find((p) => p.name === name)?.rank;

/** Perfil fictício de um jogador (mock) — números só para preencher a tela. */
export interface PlayerProfile {
  /** Posição no ranking de prosperidade. */
  rankPos: number;
  /** Prosperidade total (pontuação do ranking). */
  prosperity: number;
  /** Trigo por segundo, já formatado (mock). */
  wheat: string;
  /** Gerador mais alto desbloqueado (linha da Comida). */
  topGen: string;
  /** Geradores desbloqueados (de GENERATORS_TOTAL). */
  gens: number;
  /** Clã ao qual pertence, ou null. */
  clan: string | null;
  /** Temporada em que começou a jogar. */
  seasonJoined: number;
}

/** Total de geradores da linha da Comida (para "X/12"). */
export const GENERATORS_TOTAL = 12;

export const PROFILES: Record<string, PlayerProfile> = {
  Yseult: { rankPos: 1, prosperity: 9_820_000, wheat: '4.2M', topGen: 'Reino', gens: 12, clan: 'Ordem do Trigo', seasonJoined: 1 },
  Kaelen: { rankPos: 2, prosperity: 8_450_000, wheat: '3.1M', topGen: 'Reino', gens: 12, clan: 'Ordem do Trigo', seasonJoined: 1 },
  Bramble: { rankPos: 5, prosperity: 5_600_000, wheat: '1.4M', topGen: 'Duque', gens: 11, clan: 'Vale Dourado', seasonJoined: 2 },
  Mirena: { rankPos: 14, prosperity: 3_200_000, wheat: '820K', topGen: 'Marquês', gens: 10, clan: 'Vale Dourado', seasonJoined: 2 },
  Petra: { rankPos: 19, prosperity: 2_950_000, wheat: '760K', topGen: 'Marquês', gens: 10, clan: 'Ordem do Trigo', seasonJoined: 2 },
  Thane: { rankPos: 22, prosperity: 2_700_000, wheat: '690K', topGen: 'Marquês', gens: 10, clan: 'Ordem do Trigo', seasonJoined: 2 },
  Isolde: { rankPos: 47, prosperity: 1_450_000, wheat: '260K', topGen: 'Conde', gens: 9, clan: 'Vale Dourado', seasonJoined: 3 },
  Aldric: { rankPos: 63, prosperity: 1_180_000, wheat: '210K', topGen: 'Visconde', gens: 8, clan: 'Vale Dourado', seasonJoined: 3 },
  Rowan: { rankPos: 88, prosperity: 980_000, wheat: '160K', topGen: 'Visconde', gens: 8, clan: null, seasonJoined: 3 },
  Corvin: { rankPos: 210, prosperity: 420_000, wheat: '52K', topGen: 'Barão', gens: 7, clan: 'Vale Dourado', seasonJoined: 4 },
  Garrick: { rankPos: 305, prosperity: 260_000, wheat: '31K', topGen: 'Senhor', gens: 6, clan: null, seasonJoined: 4 },
  Doran: { rankPos: 640, prosperity: 90_000, wheat: '6.4K', topGen: 'Capataz', gens: 5, clan: null, seasonJoined: 5 },
};

export const profileOf = (name: string): PlayerProfile | undefined =>
  PROFILES[name];

const M = (
  id: string,
  author: string,
  rank: RankId,
  text: string,
  time: string
): ChatMessage => ({ id, author, rank, text, time });

/** Mensagem que menciona você (@Você). */
const MEN = (
  id: string,
  author: string,
  rank: RankId,
  text: string,
  time: string
): ChatMessage => ({ id, author, rank, text, time, mentionsYou: true });

const SYS = (
  id: string,
  time: string,
  sysKey: TKey,
  sysParams: Record<string, string | number>
): ChatMessage => ({ id, author: '', text: '', time, system: true, sysKey, sysParams });

/** Fala do próprio jogador na semente (o nome é resolvido via i18n na tela). */
const ME = (id: string, text: string, time: string): ChatMessage => ({
  id,
  author: '',
  rank: SELF_RANK,
  text,
  time,
  self: true,
});

/** Semente estática de cada canal público. */
export const SEED: Record<ChannelId, ChatMessage[]> = {
  global: [
    M('g1', 'Doran', 'bronze', 'bom dia reino, cadê a galera', '13:52'),
    M('g2', 'Corvin', 'prata', 'acabei de desbloquear o Lavrador, tô empolgado kkk', '13:53'),
    M('g3', 'Aldric', 'ouro', 'já chegou no Duque? tô juntando trigo faz um tempão', '13:54'),
    M('g4', 'Mirena', 'platina', 'cheguei ontem, o salto de custo do Conde pro Duque é brutal', '13:55'),
    MEN('g4b', 'Kaelen', 'diamante', '@Você teu reino tá voando, bora um coop depois?', '13:55'),
    M('g5', 'Petra', 'platina', 'nem me fala, o ciclo do Duque é lento demais', '13:55'),
    M('g6', 'Doran', 'bronze', 'qual a melhor estratégia no modo automático?', '13:56'),
    M('g7', 'Mirena', 'platina', '@Doran empilhar o gerador mais alto até dar pra desbloquear o próximo', '13:57'),
    M('g8', 'Corvin', 'prata', 'sério? não é melhor guardar trigo pro próximo direto?', '13:57'),
    M('g9', 'Aldric', 'ouro', '@Corvin não, empilhar rende bem mais. testei e chega mais rápido', '13:58'),
    SYS('g10', '13:59', 'chat.sys.rankup', { name: 'Bramble', rank: 'chat.rank.diamante' }),
    M('g11', 'Bramble', 'diamante', 'subi pra Diamante no ranking!! reino próspero demais', '13:59'),
    M('g12', 'Corvin', 'prata', 'parabéns bram, merecido', '14:00'),
    M('g13', 'Petra', 'platina', 'boa! quanto tá teu trigo por segundo?', '14:00'),
    M('g14', 'Bramble', 'diamante', 'passou de 1 milhão/s depois que empilhei os Barões', '14:01'),
    M('g15', 'Yseult', 'mestre', 'dica: deixa no automático e volta depois de umas horas', '14:03'),
    M('g16', 'Aldric', 'ouro', 'o progresso offline salva demais mesmo', '14:03'),
    M('g17', 'Kaelen', 'diamante', 'fechei o jogo ontem e voltei com o cofre cheio de trigo kkk', '14:04'),
    M('g18', 'Doran', 'bronze', 'ele simula o tempo parado? que sensacional', '14:04'),
    M('g19', 'Yseult', 'mestre', '@Doran simula sim, ancora no relógio e recupera tudo quando volta', '14:05'),
    M('g20', 'Petra', 'platina', 'alguém sabe quando abre a linha de Mineração?', '14:05'),
    M('g21', 'Aldric', 'ouro', 'ainda tá como "em breve", só Comida liberada por enquanto', '14:07'),
    M('g22', 'Bramble', 'diamante', 'ansioso por Remédios e Militar tbm', '14:07'),
    M('g23', 'Corvin', 'prata', 'quanto tempo leva pra desbloquear a cadeia inteira da Comida?', '14:08'),
    M('g24', 'Mirena', 'platina', 'uns 2 dias no automático até fechar no gerador Reino', '14:08'),
    SYS('g25', '14:10', 'chat.sys.joined', { name: 'Rowan' }),
    M('g26', 'Rowan', 'ouro', 'voltei depois de semanas, meu reino tá irreconhecível', '14:10'),
    M('g27', 'Petra', 'platina', '@Rowan olha quem apareceu kkk o offline trabalhou por vc', '14:11'),
    M('g28', 'Rowan', 'ouro', 'acumulou trigo demais, já desbloqueei 3 geradores de uma vez', '14:11'),
    M('g29', 'Doran', 'bronze', 'o Camponês custando 25 de trigo tá pesado pra mim ainda', '14:13'),
    M('g30', 'Yseult', 'mestre', '@Doran no começo é assim, depois que o Ceifeiro empilha destrava', '14:13'),
    M('g31', 'Kaelen', 'diamante', 'e joga no modo Ciclos tbm, ajuda a pegar o jeito da economia', '14:14'),
    M('g32', 'Mirena', 'platina', 'verdade, Ciclos e Geradores são ótimos pra treinar', '14:14'),
    M('g33', 'Corvin', 'prata', 'anotado, obrigado galera', '14:15'),
    M('g34', 'Bramble', 'diamante', 'a temporada do ranking tá acirrada esse mês', '14:16'),
    M('g35', 'Aldric', 'ouro', 'concordo, o top 100 tá disputadíssimo', '14:16'),
  ],
  rank: [
    M('r1', 'Yseult', 'mestre', 'como tá o top do ranking essa season?', '13:58'),
    M('r2', 'Kaelen', 'diamante', 'Yseult lidera disparada, reino monstruoso', '13:58'),
    SYS('r3', '13:59', 'chat.sys.joined', { name: 'Petra' }),
    M('r4', 'Petra', 'platina', 'tô subindo, passei de 200 posições essa semana', '13:59'),
    M('r5', 'Bramble', 'diamante', 'o segredo é não deixar trigo parado, automático sempre on', '14:00'),
    M('r6', 'Yseult', 'mestre', 'exato, e priorizar desbloquear o próximo gerador', '14:00'),
    MEN('r6b', 'Yseult', 'mestre', '@Você teu reino tá subindo rápido no ranking hein', '14:00'),
    MEN('r6c', 'Petra', 'platina', '@Você bora fazer dupla na próxima season?', '14:00'),
    M('r7', 'Kaelen', 'diamante', 'meu trigo/s explodiu quando empilhei os Condes', '14:01'),
    M('r8', 'Petra', 'platina', 'os geradores fundos rendem pouco por causa do ciclo longo né', '14:01'),
    M('r9', 'Yseult', 'mestre', 'sim, mas a produção total compensa empilhando o topo', '14:02'),
    M('r10', 'Bramble', 'diamante', 'a corrida pro gerador Reino é o que decide o ranking', '14:02'),
    M('r11', 'Kaelen', 'diamante', 'quem fechar a cadeia primeiro dispara na frente', '14:03'),
    SYS('r12', '14:19', 'chat.sys.rankup', { name: 'Kaelen', rank: 'chat.rank.mestre' }),
    M('r13', 'Kaelen', 'mestre', 'FECHEI a linha da Comida e subi pra Mestre no ranking!!', '14:19'),
    M('r14', 'Petra', 'platina', 'monstro kkkk parabéns', '14:20'),
    M('r15', 'Yseult', 'mestre', 'bem-vindo ao topo @Kaelen, agora segura a posição', '14:20'),
    M('r16', 'Bramble', 'diamante', 'invejável, quero chegar lá ainda essa season', '14:21'),
  ],
  cla: [
    M('c1', 'Corvin', 'prata', 'meta do clã essa semana: todo mundo no Barão', '13:50'),
    M('c2', 'Aldric', 'ouro', 'boa meta, quem tá longe ainda?', '13:51'),
    SYS('c3', '13:52', 'chat.sys.joined', { name: 'Doran' }),
    M('c4', 'Doran', 'bronze', 'eu tô só no Feitor ainda kk mas deixo no automático', '13:52'),
    M('c5', 'Mirena', 'platina', '@Doran relaxa, empilha o Feitor que o trigo vem rápido', '13:53'),
    MEN('c5b', 'Aldric', 'ouro', '@Você confirma presença na meta de sábado?', '13:53'),
    M('c6', 'Petra', 'platina', 'se precisar de dica de progressão é só chamar aqui', '13:54'),
    M('c7', 'Aldric', 'ouro', 'a soma da prosperidade do clã tá subindo bem', '13:55'),
    M('c8', 'Corvin', 'prata', 'somando o trigo/s de todo mundo já é absurdo', '13:55'),
    M('c9', 'Mirena', 'platina', 'se mantivermos o ritmo a gente sobe no ranking de clãs', '13:56'),
    M('c10', 'Doran', 'bronze', 'conta comigo, deixo rodando a noite toda', '13:57'),
    M('c11', 'Aldric', 'ouro', 'é isso, o offline faz metade do trabalho', '13:57'),
    SYS('c12', '13:58', 'chat.sys.rankup', { name: 'Corvin', rank: 'chat.rank.ouro' }),
    M('c13', 'Corvin', 'ouro', 'subi pra Ouro! chego no Barão até domingo tranquilo', '13:58'),
    M('c14', 'Petra', 'platina', 'o clã tá evoluindo junto, adoro isso', '13:59'),
    M('c15', 'Mirena', 'platina', 'bora fechar a meta, falta pouco pra todo mundo', '14:00'),
  ],
};

/** Conversas diretas (1:1) já iniciadas na semente. `ME(...)` é a fala do
    próprio jogador; o nome dela é resolvido por i18n na interface. */
export const DM_SEED: Record<string, ChatMessage[]> = {
  Yseult: [
    M('dy1', 'Yseult', 'mestre', 'e aí, viu que subi pra Mestre no ranking?', '14:06'),
    ME('dy2', 'vi sim! parabéns, teu reino tá voando', '14:07'),
    M('dy3', 'Yseult', 'mestre', 'valeu! empilha os Barões que teu trigo/s dispara', '14:07'),
    ME('dy4', 'tô fazendo isso agora, já quase dobrou', '14:08'),
    M('dy5', 'Yseult', 'mestre', 'isso, e não esquece de deixar no automático offline', '14:09'),
  ],
  Mirena: [
    M('dm1', 'Mirena', 'platina', 'bora fechar a meta do clã hoje?', '13:48'),
    ME('dm2', 'bora, tô quase no Barão', '13:49'),
    M('dm3', 'Mirena', 'platina', 'boa! qualquer dúvida de progressão me chama aqui', '13:49'),
  ],
};

/** DMs abertas de início (aparecem na barra lateral). */
export const INITIAL_DMS: string[] = ['Yseult', 'Mirena'];

/** Amigos já adicionados na semente (mistura de online e offline). */
export const INITIAL_FRIENDS: string[] = ['Yseult', 'Mirena', 'Thane', 'Isolde'];

/** Mensagens diretas ainda não lidas por conversa (mock). Zeram ao abrir a DM. */
export const DM_UNREAD: Record<string, number> = {
  Yseult: 2,
  Mirena: 1,
};

/** Menções a você (@Você) ainda não vistas por canal (mock). Zeram ao abrir. */
export const CHANNEL_MENTIONS: Record<ChannelId, number> = {
  global: 1,
  rank: 2,
  cla: 1,
};

/** Contagem "online" fictícia por canal, só para o cabeçalho. */
export const ONLINE: Record<ChannelId, number> = {
  global: 1284,
  rank: 342,
  cla: 27,
};
