/** Modo Chat (protótipo 100% mock). Prévia rica da interface do futuro chat
    multiplayer com ranking:
      - sidebar de conversas (canais públicos + mensagens diretas)
      - área central de mensagens com menções @ destacadas
      - lista lateral de jogadores online (clique abre uma DM)
      - campo de envio com autocomplete de menção
    Nada persiste nem fala com rede — é só a casca visual. */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { getDateLocale, useI18n, type TKey } from '../../lib/locale';
import styles from './Chat.module.css';
import {
  CHANNELS,
  CHANNEL_MENTIONS,
  DM_SEED,
  DM_UNREAD,
  GENERATORS_TOTAL,
  INITIAL_DMS,
  INITIAL_FRIENDS,
  ONLINE,
  PLAYERS,
  SEED,
  SELF_RANK,
  profileOf,
  rankOf,
  type ChannelId,
  type ChatMessage,
} from './mockData';

/** Conversa ativa: um canal público ou uma DM com um jogador. */
type Active = { type: 'channel'; id: ChannelId } | { type: 'dm'; user: string };

const nowHHMM = (): string =>
  new Date().toLocaleTimeString(getDateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });

let idSeq = 0;
const nextId = (): string => `local-${idSeq++}`;

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function Chat() {
  const { t } = useI18n();
  const you = t('chat.you');

  const [active, setActive] = useState<Active>({ type: 'channel', id: 'global' });
  const [byChannel, setByChannel] = useState<Record<ChannelId, ChatMessage[]>>(
    () => ({
      global: [...SEED.global],
      rank: [...SEED.rank],
      cla: [...SEED.cla],
    })
  );
  const [dms, setDms] = useState<Record<string, ChatMessage[]>>(() => ({
    Yseult: [...DM_SEED.Yseult],
    Mirena: [...DM_SEED.Mirena],
  }));
  const [openDms, setOpenDms] = useState<string[]>(() => [...INITIAL_DMS]);
  const [friends, setFriends] = useState<string[]>(() => [...INITIAL_FRIENDS]);
  const [unread, setUnread] = useState<Record<string, number>>(() => ({
    ...DM_UNREAD,
  }));
  const [mentions, setMentions] = useState<Record<ChannelId, number>>(() => ({
    ...CHANNEL_MENTIONS,
  }));
  // Menção pendente por canal (id da 1ª mensagem que te marcou). Só some quando
  // você clica no card (vai até a mensagem) ou fecha no X — persiste ao navegar.
  const [pendingJump, setPendingJump] = useState<
    Record<ChannelId, string | null>
  >(() => {
    const out = {} as Record<ChannelId, string | null>;
    for (const c of CHANNELS) {
      out[c] =
        CHANNEL_MENTIONS[c] > 0
          ? SEED[c].find((m) => m.mentionsYou)?.id ?? null
          : null;
    }
    return out;
  });
  const [highlight, setHighlight] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ above: false, below: false });
  // A menção pendente está visível na área de rolagem agora? (Se sim, sem card.)
  const [jumpVisible, setJumpVisible] = useState(false);
  const activeJumpRef = useRef<string | null>(null);

  const messages: ChatMessage[] =
    active.type === 'channel' ? byChannel[active.id] : dms[active.user] ?? [];

  const onlinePlayers = useMemo(() => PLAYERS.filter((p) => p.online), []);

  const friendSet = useMemo(() => new Set(friends), [friends]);
  // Amigos ordenados: online primeiro, depois por nome.
  const friendPlayers = useMemo(
    () =>
      PLAYERS.filter((p) => friendSet.has(p.name)).sort(
        (a, b) =>
          Number(b.online) - Number(a.online) || a.name.localeCompare(b.name)
      ),
    [friendSet]
  );

  const addFriend = (name: string) =>
    setFriends((prev) => (prev.includes(name) ? prev : [...prev, name]));
  const removeFriend = (name: string) =>
    setFriends((prev) => prev.filter((n) => n !== name));

  // Perfil aberto (modal). null = fechado.
  const [profileName, setProfileName] = useState<string | null>(null);

  // Menu de contexto (clique direito) sobre um jogador da lista.
  const [menu, setMenu] = useState<{ x: number; y: number; name: string } | null>(
    null
  );
  const openMenu = (e: ReactMouseEvent, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, name });
  };
  useEffect(() => {
    if (!profileName) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && setProfileName(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profileName]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // Nomes reconhecidos como menção (roster + o próprio jogador).
  const mentionNames = useMemo(() => [...PLAYERS.map((p) => p.name), you], [you]);

  // Abrir uma DM marca as mensagens dela como lidas. As menções em canais NÃO
  // são zeradas ao abrir: só quando você interage com o card (ver ou fechar).
  useEffect(() => {
    if (active.type !== 'dm') return;
    const u = active.user;
    setUnread((prev) => (prev[u] ? { ...prev, [u]: 0 } : prev));
  }, [active]);

  // ===== Rolagem =====
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, active]);

  const updateEdges = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setEdges({
      above: el.scrollTop > 4,
      below: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
    });
    // O card "ir para a menção" só aparece se a mensagem estiver fora de vista.
    const id = activeJumpRef.current;
    const target = id
      ? el.querySelector<HTMLElement>(`[data-mid="${id}"]`)
      : null;
    if (!target) {
      setJumpVisible(false);
      return;
    }
    const cr = el.getBoundingClientRect();
    const tr = target.getBoundingClientRect();
    setJumpVisible(tr.bottom > cr.top && tr.top < cr.bottom);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    const inner = innerRef.current;
    if (!el || !inner) return;
    updateEdges();
    el.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);
    const ro = new ResizeObserver(updateEdges);
    ro.observe(inner);
    return () => {
      el.removeEventListener('scroll', updateEdges);
      window.removeEventListener('resize', updateEdges);
      ro.disconnect();
    };
  }, [updateEdges]);

  const animate = (getTarget: (el: HTMLDivElement) => number) => {
    const el = listRef.current;
    if (!el) return;
    const from = el.scrollTop;
    const start = performance.now();
    const DURATION_MS = 400;
    const step = (now: number) => {
      const list = listRef.current;
      if (!list) return;
      const p = Math.min((now - start) / DURATION_MS, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      list.scrollTop = from + (getTarget(list) - from) * ease;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /** Marca a menção do canal como resolvida (some o card e zera o contador). */
  const dismissJump = (c: ChannelId) => {
    setPendingJump((prev) => ({ ...prev, [c]: null }));
    setMentions((prev) => (prev[c] ? { ...prev, [c]: 0 } : prev));
  };

  /** Rola suave até a mensagem `id` e dá um destaque temporário nela. */
  const jumpToMessage = (id: string) => {
    const container = listRef.current;
    const el = container?.querySelector<HTMLElement>(`[data-mid="${id}"]`);
    if (container && el) {
      // Deixa a mensagem ~1/3 abaixo do topo, com respiro acima dela.
      const offset = container.clientHeight * 0.34;
      const target =
        container.scrollTop +
        (el.getBoundingClientRect().top - container.getBoundingClientRect().top) -
        offset;
      animate(() => Math.max(0, target));
      setHighlight(id);
      window.setTimeout(() => setHighlight((h) => (h === id ? null : h)), 1800);
    }
    if (active.type === 'channel') dismissJump(active.id);
  };

  // ===== Ações =====
  const append = (msg: ChatMessage) => {
    if (active.type === 'channel') {
      setByChannel((prev) => ({ ...prev, [active.id]: [...prev[active.id], msg] }));
    } else {
      const u = active.user;
      setDms((prev) => ({ ...prev, [u]: [...(prev[u] ?? []), msg] }));
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    append({ id: nextId(), author: '', rank: SELF_RANK, text, time: nowHHMM(), self: true });
    setDraft('');
    setMentionQuery(null);
  };

  const openDm = (user: string) => {
    if (user === you) return;
    setOpenDms((prev) => (prev.includes(user) ? prev : [...prev, user]));
    if (!dms[user]) setDms((prev) => ({ ...prev, [user]: prev[user] ?? [] }));
    setActive({ type: 'dm', user });
  };

  /** Remove a DM: tira da lista, apaga as mensagens e volta pro Global se
      a conversa excluída estava aberta. */
  const deleteDm = (user: string) => {
    setOpenDms((prev) => prev.filter((u) => u !== user));
    setDms((prev) => {
      const { [user]: _removed, ...rest } = prev;
      return rest;
    });
    setUnread((prev) => {
      if (!(user in prev)) return prev;
      const { [user]: _u, ...rest } = prev;
      return rest;
    });
    setActive((prev) =>
      prev.type === 'dm' && prev.user === user
        ? { type: 'channel', id: 'global' }
        : prev
    );
  };

  // ===== Menções =====
  const onDraftChange = (value: string) => {
    setDraft(value);
    const m = /@([\p{L}\d_]*)$/u.exec(value);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  };

  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return [];
    return onlinePlayers
      .filter((p) => p.name.toLowerCase().startsWith(mentionQuery))
      .slice(0, 6);
  }, [mentionQuery, onlinePlayers]);

  const pickMention = (name: string) => {
    setDraft((d) => d.replace(/@([\p{L}\d_]*)$/u, `@${name}`));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  /** Quebra o texto destacando menções (@Nome). A menção ao próprio jogador
      ganha realce mais forte; menção a um jogador do roster abre a DM ao clicar. */
  const renderText = (text: string): ReactNode => {
    if (!text) return text;
    const re = new RegExp(
      `@(${mentionNames.map(escapeRe).sort((a, b) => b.length - a.length).join('|')})`,
      'gu'
    );
    const out: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const name = m[1];
      const isSelf = name === you;
      const known = PLAYERS.some((p) => p.name === name);
      out.push(
        <span
          key={m.index}
          className={`${styles.mention} ${isSelf ? styles.mentionSelf : ''}`}
          data-rank={rankOf(name)}
          onClick={known ? () => openDm(name) : undefined}
          role={known ? 'button' : undefined}
        >
          @{name}
        </span>
      );
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  };

  // Menção pendente do canal ativo (id da mensagem para o card levar).
  const activeJump = active.type === 'channel' ? pendingJump[active.id] : null;
  activeJumpRef.current = activeJump;

  // Recalcula bordas/visibilidade quando a conversa, as mensagens ou a menção
  // pendente mudam (após o layout já ter posicionado a rolagem).
  useEffect(() => {
    updateEdges();
  }, [active, messages.length, activeJump, updateEdges]);

  // ===== Cabeçalho =====
  const activeRank = active.type === 'dm' ? rankOf(active.user) : undefined;
  const dmOnline =
    active.type === 'dm' && PLAYERS.find((p) => p.name === active.user)?.online;

  const placeholder =
    active.type === 'dm'
      ? t('chat.dmPlaceholder', { name: active.user })
      : t('chat.placeholder');

  return (
    <div className={styles.chat}>
      {/* ===== Sidebar: conversas ===== */}
      <aside className={styles.sidebar}>
        <div className={styles.navGroup}>
          <div className={styles.navLabel}>{t('chat.channels')}</div>
          {CHANNELS.map((c) => (
            <button
              key={c}
              className={`${styles.navItem} ${
                active.type === 'channel' && active.id === c ? styles.navActive : ''
              }`}
              onClick={() => setActive({ type: 'channel', id: c })}
            >
              <span className={styles.hash}>#</span>
              <span className={styles.navName}>
                {t(`chat.channel.${c}` as TKey)}
              </span>
              {mentions[c] > 0 && (
                <span
                  className={styles.mentionCount}
                  title={t('chat.mentionsYou', { n: mentions[c] })}
                >
                  {mentions[c]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className={styles.navGroup}>
          <div className={styles.navLabel}>{t('chat.dms')}</div>
          {openDms.map((u) => (
            <button
              key={u}
              className={`${styles.navItem} ${
                active.type === 'dm' && active.user === u ? styles.navActive : ''
              }`}
              onClick={() => setActive({ type: 'dm', user: u })}
              onContextMenu={(e) => openMenu(e, u)}
            >
              <span className={styles.navName} data-rank={rankOf(u)}>
                {u}
              </span>
              {unread[u] > 0 && <span className={styles.unread}>{unread[u]}</span>}
            </button>
          ))}
        </div>

        <span className={styles.preview} title={t('chat.previewNote')}>
          {t('chat.preview')}
        </span>
      </aside>

      {/* ===== Área central ===== */}
      <div className={styles.header}>
          {active.type === 'channel' ? (
            <>
              <span className={styles.headerName}>
                # {t(`chat.channel.${active.id}` as TKey)}
              </span>
              <span className={styles.online}>
                <i className={styles.dot} />
                {t('chat.online', {
                  n: ONLINE[active.id].toLocaleString(getDateLocale()),
                })}
              </span>
            </>
          ) : (
            <>
              <span className={styles.headerName} data-rank={activeRank}>
                {active.user}
              </span>
              <span className={styles.headerRank}>
                {activeRank && t(`chat.rank.${activeRank}` as TKey)}
              </span>
              <span className={styles.online}>
                {dmOnline ? (
                  <>
                    <i className={styles.dot} />
                    {t('chat.online', { n: 1 })}
                  </>
                ) : (
                  t('chat.offline')
                )}
              </span>
            </>
          )}
        </div>

        <div className={styles.list}>
          {edges.above && !(activeJump && !jumpVisible) && (
            <button
              className={`${styles.fade} ${styles.fadeTop}`}
              onClick={() => animate(() => 0)}
              aria-label={t('common.toStart')}
            >
              ↑
            </button>
          )}
          <div className={styles.scroll} ref={listRef}>
            <div className={styles.inner} ref={innerRef}>
              {messages.length === 0 && active.type === 'dm' && (
                <p className={styles.empty}>
                  {t('chat.dmEmpty', { name: active.user })}
                </p>
              )}
              {messages.map((msg) =>
                msg.system ? (
                  <div key={msg.id} className={styles.system}>
                    <span className={styles.systemText}>
                      {msg.sysKey
                        ? t(
                            msg.sysKey,
                            msg.sysParams
                              ? Object.fromEntries(
                                  Object.entries(msg.sysParams).map(([k, v]) => [
                                    k,
                                    typeof v === 'string' &&
                                    v.startsWith('chat.rank.')
                                      ? t(v as TKey)
                                      : v,
                                  ])
                                )
                              : undefined
                          )
                        : msg.text}
                    </span>
                  </div>
                ) : (
                  <div
                    key={msg.id}
                    data-mid={msg.id}
                    className={`${styles.msg} ${msg.self ? styles.msgSelf : ''} ${
                      highlight === msg.id ? styles.msgHighlight : ''
                    }`}
                  >
                    <div className={styles.body}>
                      <div className={styles.meta}>
                        <span className={styles.author} data-rank={msg.rank}>
                          {msg.self ? you : msg.author}
                        </span>
                        {msg.rank && (
                          <span className={styles.badge}>
                            {t(`chat.rank.${msg.rank}` as TKey)}
                          </span>
                        )}
                        <span className={styles.time}>{msg.time}</span>
                      </div>
                      <p className={styles.text}>{renderText(msg.text)}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
          {edges.below && (
            <button
              className={`${styles.fade} ${styles.fadeBottom}`}
              onClick={() => animate((el) => el.scrollHeight - el.clientHeight)}
              aria-label={t('common.toEnd')}
            >
              ↓
            </button>
          )}
          {activeJump && !jumpVisible && (
            <div className={styles.jumpBar}>
              <button
                className={styles.jumpCard}
                onClick={() => jumpToMessage(activeJump)}
              >
                <span className={styles.jumpAt}>@</span>
                {t('chat.jumpToMention')}
                <span className={styles.jumpArrow}>↑</span>
              </button>
              <button
                className={styles.jumpClose}
                onClick={() =>
                  active.type === 'channel' && dismissJump(active.id)
                }
                aria-label={t('common.close')}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {mentionMatches.length > 0 && (
            <div className={styles.mentionPop}>
              {mentionMatches.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className={styles.mentionOption}
                  onClick={() => pickMention(p.name)}
                >
                  <span className={styles.mentionName} data-rank={p.rank}>
                    {p.name}
                  </span>
                  <span className={styles.mentionRank}>
                    {t(`chat.rank.${p.rank}` as TKey)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            className={styles.input}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setMentionQuery(null);
              } else if (e.key === 'Enter' && mentionMatches.length === 1) {
                // Uma única sugestão de menção: Enter completa em vez de enviar.
                e.preventDefault();
                pickMention(mentionMatches[0].name);
              }
            }}
            placeholder={placeholder}
            maxLength={280}
            aria-label={placeholder}
          />
          <button
            type="submit"
            className={`btn-primary ${styles.send}`}
            disabled={!draft.trim()}
          >
            {t('chat.send')}
          </button>
        </form>

      {/* ===== Cards laterais: Online (metade de cima) + Amigos (metade de baixo) ===== */}
      <aside className={styles.members}>
        <section className={styles.membersHalf}>
          <div className={styles.navLabel}>
            {t('chat.membersTitle')} — {onlinePlayers.length}
          </div>
          <div className={styles.memberScroll}>
            <div className={styles.memberList}>
              {onlinePlayers.map((p) => (
                <div
                  key={p.name}
                  className={`${styles.member} ${
                    active.type === 'dm' && active.user === p.name
                      ? styles.memberActive
                      : ''
                  }`}
                  onContextMenu={(e) => openMenu(e, p.name)}
                >
                  <button
                    className={styles.memberOpen}
                    onClick={() => openDm(p.name)}
                    title={t('chat.dmPlaceholder', { name: p.name })}
                  >
                    <span className={styles.memberName} data-rank={p.rank}>
                      {p.name}
                    </span>
                  </button>
                  <span className={styles.memberRank}>
                    {t(`chat.rank.${p.rank}` as TKey)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.membersDivider} />

        <section className={styles.membersHalf}>
          <div className={styles.navLabel}>
            {t('chat.friends')} — {friendPlayers.length}
          </div>
          <div className={styles.memberScroll}>
            {friendPlayers.length === 0 ? (
              <p className={styles.friendsEmpty}>{t('chat.noFriends')}</p>
            ) : (
              <div className={styles.memberList}>
                {friendPlayers.map((p) => (
                  <div
                    key={p.name}
                    className={`${styles.member} ${
                      active.type === 'dm' && active.user === p.name
                        ? styles.memberActive
                        : ''
                    }`}
                    onContextMenu={(e) => openMenu(e, p.name)}
                  >
                    <button
                      className={styles.memberOpen}
                      onClick={() => openDm(p.name)}
                      title={t('chat.dmPlaceholder', { name: p.name })}
                    >
                      <span
                        className={`${styles.statusDot} ${
                          p.online ? styles.statusOn : ''
                        }`}
                      />
                      <span className={styles.memberName} data-rank={p.rank}>
                        {p.name}
                      </span>
                    </button>
                    <span className={styles.memberRank}>
                      {t(`chat.rank.${p.rank}` as TKey)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </aside>

      {menu && (
        <div
          className={styles.ctxMenu}
          style={{
            left: Math.min(menu.x, window.innerWidth - 188),
            top: Math.min(menu.y, window.innerHeight - 132),
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className={styles.ctxName} data-rank={rankOf(menu.name)}>
            {menu.name}
          </div>
          <button
            className={styles.ctxItem}
            onClick={() => {
              setProfileName(menu.name);
              setMenu(null);
            }}
          >
            {t('chat.viewProfile')}
          </button>
          <button
            className={styles.ctxItem}
            onClick={() => {
              openDm(menu.name);
              setMenu(null);
            }}
          >
            {t('chat.openDm')}
          </button>
          {friendSet.has(menu.name) ? (
            <button
              className={styles.ctxItem}
              onClick={() => {
                removeFriend(menu.name);
                setMenu(null);
              }}
            >
              {t('chat.removeFriend')}
            </button>
          ) : (
            <button
              className={styles.ctxItem}
              onClick={() => {
                addFriend(menu.name);
                setMenu(null);
              }}
            >
              {t('chat.addFriend')}
            </button>
          )}
          {openDms.includes(menu.name) && (
            <button
              className={`${styles.ctxItem} ${styles.ctxDanger}`}
              onClick={() => {
                deleteDm(menu.name);
                setMenu(null);
              }}
            >
              {t('chat.deleteChat')}
            </button>
          )}
        </div>
      )}

      {profileName &&
        (() => {
          const p = PLAYERS.find((pl) => pl.name === profileName);
          const prof = profileOf(profileName);
          if (!p || !prof) return null;
          const loc = getDateLocale();
          const isFriend = friendSet.has(p.name);
          const stats: [string, string][] = [
            [t('chat.profile.ranking'), `#${prof.rankPos.toLocaleString(loc)}`],
            [t('chat.profile.prosperity'), prof.prosperity.toLocaleString(loc)],
            [t('chat.profile.wheat'), prof.wheat],
            [t('chat.profile.topGen'), prof.topGen],
            [t('chat.profile.generators'), `${prof.gens}/${GENERATORS_TOTAL}`],
            [t('chat.profile.clan'), prof.clan ?? t('chat.profile.noClan')],
            [
              t('chat.profile.since'),
              t('chat.profile.season', { n: prof.seasonJoined }),
            ],
          ];
          return (
            <div
              className={styles.profileBackdrop}
              onClick={() => setProfileName(null)}
            >
              <div
                className={styles.profileModal}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className={styles.profileClose}
                  onClick={() => setProfileName(null)}
                  aria-label={t('common.close')}
                >
                  ✕
                </button>
                <div className={styles.profileHead}>
                  <div className={styles.profileId}>
                    <span className={styles.profileName} data-rank={p.rank}>
                      {p.name}
                    </span>
                    <span className={styles.profileRank}>
                      {t(`chat.rank.${p.rank}` as TKey)}
                    </span>
                    <span className={styles.profileStatus}>
                      <i
                        className={`${styles.statusDot} ${
                          p.online ? styles.statusOn : ''
                        }`}
                      />
                      {p.online
                        ? t('chat.profile.online')
                        : t('chat.profile.offline')}
                      {isFriend && ` · ${t('chat.profile.friend')}`}
                    </span>
                  </div>
                </div>
                <div className={styles.profileStats}>
                  {stats.map(([label, value]) => (
                    <div className={styles.statRow} key={label}>
                      <span className={styles.statLabel}>{label}</span>
                      <span className={styles.statValue}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.profileActions}>
                  <button
                    className={`btn-primary ${styles.profileBtn}`}
                    onClick={() => {
                      openDm(p.name);
                      setProfileName(null);
                    }}
                  >
                    {t('chat.openDm')}
                  </button>
                  <button
                    className={styles.profileBtnGhost}
                    onClick={() =>
                      isFriend ? removeFriend(p.name) : addFriend(p.name)
                    }
                  >
                    {isFriend ? t('chat.removeFriend') : t('chat.addFriend')}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
