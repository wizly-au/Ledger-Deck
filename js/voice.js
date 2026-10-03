/* Read-aloud: the device's own voice by default, or OpenAI's voice when an OpenAI key is connected. */
import { state } from './store.js';
import { speakOpenAI, provById, aiReady } from './ai.js';

export const synth = window.speechSynthesis || null;
function score(v) {
  let s = 0; if (/en[-_]AU/i.test(v.lang)) s += 4; else if (/en[-_](GB|NZ)/i.test(v.lang)) s += 2; else if (/^en/i.test(v.lang)) s += 1;
  if (/natural|neural|premium|enhanced|online/i.test(v.name)) s += 5;
  if (/novelty|whisper|bells|bubbles|cellos|zarvox|trinoids|bad news|good news|organ|boing|jester|superstar|wobble|albert|fred|junior|ralph|grandma|grandpa|rocko|shelley|reed|eddy|flo|sandy/i.test(v.name)) s -= 10;
  return s;
}
export const voices = () => synth ? synth.getVoices().filter(v => /^en/i.test(v.lang)).sort((a, b) => score(b) - score(a)) : [];
export const canCloudVoice = () => aiReady() && !!provById(state.settings.ai.provider)?.tts;
const pick = () => { const vs = voices(); return vs.find(v => v.name === state.settings.voice) || vs[0] || null; };

let run = 0, audio = null, ctl = null;
export function stop() { run++; synth?.cancel(); ctl?.abort(); if (audio) { audio.pause(); audio = null; } }

function sayDevice(text, rate) {
  return new Promise(res => {
    if (!synth) { setTimeout(res, Math.max(1200, text.length * 55 / rate)); return; }
    const u = new SpeechSynthesisUtterance(text), v = pick(); if (v) u.voice = v; u.lang = v?.lang || 'en-AU'; u.rate = .95 * rate; u.pitch = 1;
    const t = setTimeout(res, text.length * 140 / rate + 4000); u.onend = u.onerror = () => { clearTimeout(t); res(); }; synth.speak(u);
  });
}

/* Speaks the sentences one by one, calling onLine(i) as each starts. Resolves when done or stopped. */
export async function speakLines(lines, onLine, rate = state.settings.rate || 1) {
  stop(); const id = ++run;
  if (state.settings.voiceSrc === 'cloud' && canCloudVoice()) {
    try {
      ctl = new AbortController(); onLine(0);
      const blob = await speakOpenAI(lines.join(' '), ctl.signal); if (id !== run) return;
      audio = new Audio(URL.createObjectURL(blob)); audio.playbackRate = rate;
      await new Promise(res => { audio.onended = res; audio.onerror = res; audio.play().catch(res); });
      return;
    } catch (e) { if (e.name === 'AbortError' || id !== run) return; /* fall back to the device voice */ }
  }
  for (let i = 0; i < lines.length; i++) { if (id !== run) return; onLine(i); await sayDevice(lines[i], rate); }
}
export function sayOnce(text) { stop(); sayDevice(text.replace(/\*\*/g, '').replace(/^\s*[-*•]\s+/gm, ''), state.settings.rate || 1); }
