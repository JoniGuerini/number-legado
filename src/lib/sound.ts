/** Feedback sonoro sintetizado via Web Audio — sem assets externos. */

let ctx: AudioContext | null = null;
/** Buffer de ruído compartilhado — regenerado quando o contexto renasce. */
let noiseBuf: AudioBuffer | null = null;

/** O AudioContext só pode nascer/tocar após um gesto do usuário; como o som
    dispara em cliques, a criação preguiçosa aqui sempre acontece num gesto.
    Contexto fechado (descartado após travar) renasce aqui. */
function ensureCtx(): AudioContext | null {
  try {
    if (ctx && ctx.state === 'closed') {
      ctx = null;
      noiseBuf = null;
    }
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

/** Descarta um contexto morto — o próximo clique cria um novo. */
function discardCtx(ac: AudioContext): void {
  void ac.close().catch(() => {});
  if (ctx === ac) {
    ctx = null;
    noiseBuf = null;
  }
}

/** Acorda o contexto quando a aba volta a ficar visível: o navegador suspende
    o áudio de abas ocultas e o PRIMEIRO clique de volta era engolido. */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  });
}

const CONFIG_KEY = 'number-legado:config';

interface SoundConfig {
  volume?: number;
  soundOn?: boolean;
}

function readConfig(): SoundConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as SoundConfig) : {};
  } catch {
    return {};
  }
}

const DEFAULT_VOLUME = 1;
const DEFAULT_SOUND_ON = true;

/** Volume mestre dos sons de botão (0..1). */
let currentVolume: number = readConfig().volume ?? DEFAULT_VOLUME;
/** Master on/off switch, independent of the volume level. */
let soundOn: boolean = readConfig().soundOn ?? DEFAULT_SOUND_ON;

export function getSoundVolume(): number {
  return currentVolume;
}

export function setSoundVolume(volume: number): void {
  currentVolume = Math.min(Math.max(volume, 0), 1);
  try {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ ...readConfig(), volume: currentVolume })
    );
  } catch {
    // Sem localStorage — a escolha vale só pra sessão
  }
}

export function isSoundOn(): boolean {
  return soundOn;
}

export function setSoundOn(on: boolean): void {
  soundOn = on;
  try {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ ...readConfig(), soundOn: on })
    );
  } catch {
    // Sem localStorage — a escolha vale só pra sessão
  }
}

/** Restaura som (volume e liga/desliga) ao padrão. Os módulos que exibem o
    estado (ex.: Config) devem reler getSoundVolume()/isSoundOn() depois. */
export function resetSound(): void {
  currentVolume = DEFAULT_VOLUME;
  soundOn = DEFAULT_SOUND_ON;
  try {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ ...readConfig(), volume: currentVolume, soundOn })
    );
  } catch {
    // Sem localStorage — a escolha vale só pra sessão
  }
}

/** Agenda o "toc" num contexto JÁ rodando. */
function schedule(ac: AudioContext): void {
  const now = ac.currentTime;

  if (!noiseBuf) {
    const len = Math.ceil(ac.sampleRate * 0.008);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  }

  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const g = ac.createGain();
  g.gain.setValueAtTime(Math.max(0.125 * currentVolume, 0.0001), now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
  src.connect(g);
  g.connect(ac.destination);
  src.start(now);
  src.stop(now + 0.01);
}

/** "Toc": click de ruído seco de 8ms — o som oficial do app.
    Contexto suspenso (aba ficou oculta, autoplay, troca de saída de áudio):
    o toque de agora era agendado num relógio CONGELADO e sumia — o clique não
    tocava nada. Agora o resume() assíncrono é aguardado e o toque sai assim
    que o contexto acorda (milissegundos); se nem assim voltar, o contexto é
    descartado e o próximo clique nasce num novo. */
function noiseClick(): void {
  const ac = ensureCtx();
  if (!ac) return;
  if (ac.state === 'running') {
    schedule(ac);
    return;
  }
  void ac
    .resume()
    .then(() => {
      if (ac.state === 'running') schedule(ac);
      else discardCtx(ac);
    })
    .catch(() => discardCtx(ac));
}

/** Som ao PRESSIONAR um botão. */
export function playPress(): void {
  if (!soundOn || currentVolume <= 0) return;
  try {
    noiseClick();
  } catch {
    // Sem suporte a Web Audio — segue sem som
  }
}

/** Som ao SOLTAR o botão. */
export function playRelease(): void {
  if (!soundOn || currentVolume <= 0) return;
  try {
    noiseClick();
  } catch {
    // Sem suporte a Web Audio — segue sem som
  }
}
