import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/locale';
import styles from './Combat.module.css';

type Side = 'player' | 'enemy';
type Phase = 'player' | 'enemy' | 'won' | 'lost';

interface Fighter {
  nameKey: 'combat.playerName' | 'combat.enemyName';
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  atk: number;
  defending: boolean;
}

interface LogLine {
  id: number;
  text: string;
  side: Side | 'system';
}

interface Fight {
  player: Fighter;
  enemy: Fighter;
  phase: Phase;
  log: LogLine[];
}

let logSeq = 0;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roll(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function makePlayer(): Fighter {
  return {
    nameKey: 'combat.playerName',
    hp: 100,
    maxHp: 100,
    mana: 40,
    maxMana: 40,
    atk: 12,
    defending: false,
  };
}

function makeEnemy(): Fighter {
  return {
    nameKey: 'combat.enemyName',
    hp: 80,
    maxHp: 80,
    mana: 20,
    maxMana: 20,
    atk: 10,
    defending: false,
  };
}

function appendLog(
  log: LogLine[],
  text: string,
  side: LogLine['side']
): LogLine[] {
  return [...log.slice(-80), { id: ++logSeq, text, side }];
}

function applyDamage(
  target: Fighter,
  raw: number
): { next: Fighter; dealt: number } {
  const dealt = target.defending ? Math.max(1, Math.floor(raw / 2)) : raw;
  return {
    next: {
      ...target,
      hp: clamp(target.hp - dealt, 0, target.maxHp),
      defending: false,
    },
    dealt,
  };
}

function Plate({ fighter, label }: { fighter: Fighter; label: string }) {
  const hpPct = clamp((fighter.hp / fighter.maxHp) * 100, 0, 100);
  const manaPct = clamp((fighter.mana / fighter.maxMana) * 100, 0, 100);

  return (
    <div className={styles.plate}>
      <div className={styles.plateHead}>
        <span className={styles.plateName}>{label}</span>
        {fighter.defending && <span className={styles.plateTag}>DEF</span>}
      </div>
      <div className={styles.barTrack} aria-hidden="true">
        <div
          className={`${styles.barFill} ${styles.barHp}`}
          style={{ width: `${hpPct}%` }}
        />
      </div>
      <div className={styles.barMeta}>
        <span>HP</span>
        <span>
          {fighter.hp}/{fighter.maxHp}
        </span>
      </div>
      <div className={styles.barTrack} aria-hidden="true">
        <div
          className={`${styles.barFill} ${styles.barMana}`}
          style={{ width: `${manaPct}%` }}
        />
      </div>
      <div className={styles.barMeta}>
        <span>MP</span>
        <span>
          {fighter.mana}/{fighter.maxMana}
        </span>
      </div>
    </div>
  );
}

export default function Combat() {
  const { t } = useI18n();
  const [fight, setFight] = useState<Fight>(() => ({
    player: makePlayer(),
    enemy: makeEnemy(),
    phase: 'player',
    log: [],
  }));
  const started = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setFight((f) => ({
      ...f,
      log: appendLog([], t('combat.log.start'), 'system'),
    }));
  }, [t]);

  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [fight.log]);

  const resetFight = () => {
    setFight({
      player: makePlayer(),
      enemy: makeEnemy(),
      phase: 'player',
      log: appendLog([], t('combat.log.start'), 'system'),
    });
  };

  const playerAttack = () => {
    setFight((f) => {
      if (f.phase !== 'player') return f;
      const dmg = roll(f.player.atk - 3, f.player.atk + 4);
      const { next: enemy, dealt } = applyDamage(f.enemy, dmg);
      const player = {
        ...f.player,
        defending: false,
        mana: clamp(f.player.mana + 2, 0, f.player.maxMana),
      };
      let log = appendLog(
        f.log,
        t('combat.log.attack', {
          actor: t(f.player.nameKey),
          target: t(f.enemy.nameKey),
          dmg: dealt,
        }),
        'player'
      );
      if (enemy.hp <= 0) {
        log = appendLog(log, t('combat.log.won'), 'system');
        return { player, enemy, phase: 'won', log };
      }
      return { player, enemy, phase: 'enemy', log };
    });
  };

  const playerHeal = () => {
    setFight((f) => {
      if (f.phase !== 'player') return f;
      if (f.player.mana < 12) {
        return {
          ...f,
          log: appendLog(f.log, t('combat.log.noMana'), 'system'),
        };
      }
      const heal = roll(14, 22);
      const player = {
        ...f.player,
        mana: f.player.mana - 12,
        hp: clamp(f.player.hp + heal, 0, f.player.maxHp),
        defending: false,
      };
      return {
        ...f,
        player,
        phase: 'enemy',
        log: appendLog(
          f.log,
          t('combat.log.heal', { actor: t(f.player.nameKey), heal }),
          'player'
        ),
      };
    });
  };

  const playerDefend = () => {
    setFight((f) => {
      if (f.phase !== 'player') return f;
      const player = {
        ...f.player,
        defending: true,
        mana: clamp(f.player.mana + 4, 0, f.player.maxMana),
      };
      return {
        ...f,
        player,
        phase: 'enemy',
        log: appendLog(
          f.log,
          t('combat.log.defend', { actor: t(f.player.nameKey) }),
          'player'
        ),
      };
    });
  };

  // Turno do inimigo (atraso curto pra ler o log)
  useEffect(() => {
    if (fight.phase !== 'enemy') return;
    const timer = window.setTimeout(() => {
      setFight((f) => {
        if (f.phase !== 'enemy') return f;
        const { player: p, enemy: e } = f;

        if (e.hp <= e.maxHp * 0.35 && e.mana >= 10) {
          const heal = roll(10, 16);
          const enemy = {
            ...e,
            mana: e.mana - 10,
            hp: clamp(e.hp + heal, 0, e.maxHp),
            defending: false,
          };
          return {
            ...f,
            enemy,
            phase: 'player',
            log: appendLog(
              f.log,
              t('combat.log.heal', { actor: t(e.nameKey), heal }),
              'enemy'
            ),
          };
        }

        const dmg = roll(e.atk - 2, e.atk + 3);
        const { next: player, dealt } = applyDamage(p, dmg);
        const enemy = { ...e, defending: false };
        let log = appendLog(
          f.log,
          t('combat.log.attack', {
            actor: t(e.nameKey),
            target: t(p.nameKey),
            dmg: dealt,
          }),
          'enemy'
        );
        if (player.hp <= 0) {
          log = appendLog(log, t('combat.log.lost'), 'system');
          return { player, enemy, phase: 'lost', log };
        }
        return { player, enemy, phase: 'player', log };
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [fight.phase, t]);

  const { player, enemy, phase, log } = fight;
  const busy = phase !== 'player';
  const over = phase === 'won' || phase === 'lost';

  const statusText = over
    ? t(phase === 'won' ? 'combat.status.won' : 'combat.status.lost')
    : phase === 'player'
      ? t('combat.status.yourTurn')
      : t('combat.status.enemyTurn');

  return (
    <div className={styles.wrap}>
      <div className={styles.plates}>
        <Plate fighter={player} label={t(player.nameKey)} />
        <Plate fighter={enemy} label={t(enemy.nameKey)} />
      </div>

      <div className={styles.command}>
        <div className={styles.turnBar} aria-live="polite">
          {statusText}
        </div>
        <div className={styles.actions}>
          {over ? (
            <button className="btn-primary" onClick={resetFight}>
              {t('combat.again')}
            </button>
          ) : (
            <>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={playerAttack}
              >
                {t('combat.act.attack')}
              </button>
              <button
                className="btn-secondary"
                disabled={busy || player.mana < 12}
                onClick={playerHeal}
              >
                {t('combat.act.heal')}
              </button>
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={playerDefend}
              >
                {t('combat.act.defend')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.logCard}>
        <div className={styles.logHead}>{t('combat.log.title')}</div>
        <div className={styles.log} ref={logRef} role="log" aria-live="polite">
          {log.map((line) => (
            <div
              key={line.id}
              className={`${styles.logLine} ${
                line.side === 'player'
                  ? styles.logPlayer
                  : line.side === 'enemy'
                    ? styles.logEnemy
                    : styles.logSystem
              }`}
            >
              {line.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
