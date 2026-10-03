/* Bring-your-own-key AI. Requests go straight from this browser to the provider the person chose.
   Three adapters cover the list: Anthropic, Google Gemini, and the OpenAI-style API most others share. */
import { state } from './store.js';

export const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic (Claude)', tier: 'Popular', kind: 'anthropic', base: 'https://api.anthropic.com/v1', hint: 'sk-ant-…', keyUrl: 'https://console.anthropic.com/settings/keys', prefer: /sonnet/ },
  { id: 'openai', name: 'OpenAI (ChatGPT)', tier: 'Popular', kind: 'openai', base: 'https://api.openai.com/v1', hint: 'sk-…', keyUrl: 'https://platform.openai.com/api-keys', prefer: /^gpt-[\d.]+-?mini|^gpt-4o-mini/, filter: /^(gpt|o\d|chatgpt)/, tts: true },
  { id: 'google', name: 'Google (Gemini)', tier: 'Popular', kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', hint: 'AIza…', keyUrl: 'https://aistudio.google.com/app/apikey', prefer: /flash/ },
  { id: 'xai', name: 'xAI (Grok)', tier: 'Popular', kind: 'openai', base: 'https://api.x.ai/v1', hint: 'xai-…', keyUrl: 'https://console.x.ai', prefer: /grok/, note: 'If xAI blocks requests from a browser, use OpenRouter to reach Grok instead.' },
  { id: 'openrouter', name: 'OpenRouter', tier: 'Popular', kind: 'openai', base: 'https://openrouter.ai/api/v1', hint: 'sk-or-…', keyUrl: 'https://openrouter.ai/keys', featured: true, prefer: /claude.*sonnet|gpt-.*mini/, note: 'One key gives you hundreds of models from every major company.' },
  { id: 'mistral', name: 'Mistral', tier: 'Also supported', kind: 'openai', base: 'https://api.mistral.ai/v1', hint: 'Mistral API key', keyUrl: 'https://console.mistral.ai/api-keys', prefer: /small-latest|medium-latest/ },
  { id: 'deepseek', name: 'DeepSeek', tier: 'Also supported', kind: 'openai', base: 'https://api.deepseek.com/v1', hint: 'sk-…', keyUrl: 'https://platform.deepseek.com/api_keys', prefer: /chat/ },
  { id: 'groq', name: 'Groq', tier: 'Also supported', kind: 'openai', base: 'https://api.groq.com/openai/v1', hint: 'gsk_…', keyUrl: 'https://console.groq.com/keys', prefer: /70b|versatile/ },
  { id: 'together', name: 'Together AI', tier: 'Also supported', kind: 'openai', base: 'https://api.together.xyz/v1', hint: 'Together API key', keyUrl: 'https://api.together.xyz/settings/api-keys', prefer: /instruct/i },
  { id: 'perplexity', name: 'Perplexity', tier: 'Also supported', kind: 'openai', base: 'https://api.perplexity.ai', hint: 'pplx-…', keyUrl: 'https://www.perplexity.ai/settings/api', models: ['sonar', 'sonar-pro'] },
  { id: 'ollama', name: 'Ollama (runs on your computer)', tier: 'Private: nothing leaves your computer', kind: 'openai', base: 'http://localhost:11434/v1', local: true, note: 'Start Ollama with OLLAMA_ORIGINS set to this site’s address so the browser is allowed to reach it.' },
  { id: 'lmstudio', name: 'LM Studio (runs on your computer)', tier: 'Private: nothing leaves your computer', kind: 'openai', base: 'http://localhost:1234/v1', local: true, note: 'In LM Studio, start the local server and turn on “Enable CORS”.' },
  { id: 'custom', name: 'Another OpenAI-compatible service', tier: 'Private: nothing leaves your computer', kind: 'openai', base: '', custom: true, note: 'Enter the service’s base URL, for example https://example.com/v1.' },
];
export const provById = id => PROVIDERS.find(p => p.id === id);
export const aiReady = () => { const a = state.settings.ai, p = provById(a.provider); return !!(p && a.ok && a.model && (a.key || p.local || p.custom)); };
export const aiName = () => { const p = provById(state.settings.ai.provider); return p ? p.name.replace(/ \(.*\)/, '') : ''; };
export const aiLabel = () => aiReady() ? `${aiName()} · ${state.settings.ai.model}` : '';
const baseOf = (p, a) => (p.custom || p.local) && a.base ? a.base.replace(/\/+$/, '') : p.base;

function headers(p, key) {
  if (p.kind === 'anthropic') return { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  if (p.kind === 'gemini') return { 'content-type': 'application/json', 'x-goog-api-key': key };
  const h = { 'content-type': 'application/json' }; if (key) h.authorization = `Bearer ${key}`;
  if (p.id === 'openrouter') { h['HTTP-Referer'] = location.origin; h['X-Title'] = 'Ledger Deck'; }
  return h;
}

export class AIError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
async function check(r, p) {
  if (r.ok) return r;
  let detail = ''; try { const j = await r.json(); detail = j.error?.message || j.message || j.error || ''; } catch { }
  if (r.status === 401 || r.status === 403) throw new AIError(`${p.name.replace(/ \(.*\)/, '')} didn’t accept that key. Check you copied all of it and that it’s active.`, 'auth');
  if (r.status === 402) throw new AIError('Your account with this provider needs credit before it can answer.', 'billing');
  if (r.status === 429) throw new AIError('The provider says too many requests. Wait a minute and try again.', 'rate');
  if (r.status === 404) throw new AIError('That model wasn’t found. Pick another model in Data & AI.', 'model');
  throw new AIError(`The provider returned an error (${r.status}). ${String(detail).slice(0, 160)}`, 'http');
}
const netErr = (p, e) => e.name === 'AbortError' ? e : new AIError(p.local ? `Couldn’t reach ${p.name.replace(/ \(.*\)/, '')} on this computer. Check it’s running and allows this site.` : `Couldn’t reach ${p.name.replace(/ \(.*\)/, '')} from this browser. Check your connection. Some providers block browser requests; OpenRouter works from any browser.`, 'network');

/* Lists the models a key can use, best guess first. */
export async function listModels(pid, key, base) {
  const p = provById(pid); if (!p) throw new AIError('Choose a provider first.', 'input');
  if (p.models) return p.models;
  const b = (p.custom || p.local) && base ? base.replace(/\/+$/, '') : p.base; if (!b) throw new AIError('Enter the service’s address first.', 'input');
  let r; try { r = await fetch(p.kind === 'gemini' ? `${b}/models?pageSize=200` : `${b}/models`, { headers: headers(p, key) }); } catch (e) { throw netErr(p, e); }
  await check(r, p); const j = await r.json();
  let ids = p.kind === 'gemini' ? (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, '')) : (j.data || j.models || []).map(m => m.id || m.name);
  if (p.filter) ids = ids.filter(i => p.filter.test(i) && !/audio|realtime|transcribe|tts|image|search|embedding|moderation|instruct$/i.test(i));
  ids = ids.filter(i => !/embed|whisper|dall-e|tts|moderation|imagen|aqa|vision-only/i.test(i));
  ids.sort((a, b) => (p.prefer && p.prefer.test(b) ? 1 : 0) - (p.prefer && p.prefer.test(a) ? 1 : 0) || (a < b ? 1 : -1));
  if (!ids.length) throw new AIError('The key works, but no chat models were listed for it.', 'models');
  return ids.slice(0, 80);
}

/* Streams an answer. messages: [{role:'user'|'assistant', content}]. Returns the full text. */
export async function chat({ system, messages, onText, signal, maxTokens = 900 }) {
  const a = state.settings.ai, p = provById(a.provider); if (!aiReady()) throw new AIError('Connect an AI in Data & AI first.', 'setup');
  const b = baseOf(p, a); let url, body;
  if (p.kind === 'anthropic') { url = `${b}/messages`; body = { model: a.model, system, messages, max_tokens: maxTokens, stream: true }; }
  else if (p.kind === 'gemini') { url = `${b}/models/${encodeURIComponent(a.model)}:streamGenerateContent?alt=sse`; body = { systemInstruction: { parts: [{ text: system }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: maxTokens * 2 } }; }
  else { url = `${b}/chat/completions`; body = { model: a.model, messages: [{ role: 'system', content: system }, ...messages], stream: true }; }
  let r; try { r = await fetch(url, { method: 'POST', headers: headers(p, a.key), body: JSON.stringify(body), signal }); } catch (e) { throw netErr(p, e); }
  await check(r, p);
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '';
  for (; ;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:')) continue; const d = line.slice(5).trim(); if (!d || d === '[DONE]') continue;
      let j; try { j = JSON.parse(d); } catch { continue; }
      let piece = '';
      if (p.kind === 'anthropic') { if (j.type === 'content_block_delta') piece = j.delta?.text || ''; if (j.type === 'error') throw new AIError(j.error?.message || 'The provider returned an error.', 'http'); }
      else if (p.kind === 'gemini') piece = (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
      else piece = j.choices?.[0]?.delta?.content || '';
      if (piece) { text += piece; onText && onText(text); }
    }
  }
  if (!text) throw new AIError('No answer came back. Try again, or pick another model.', 'empty');
  return text;
}

/* A tiny request to prove the key and model work. */
export async function testModel() { return chat({ system: 'Reply with the single word OK.', messages: [{ role: 'user', content: 'Say OK' }], maxTokens: 20 }); }

/* OpenAI text-to-speech, used for briefings when an OpenAI key is connected. */
export async function speakOpenAI(text, signal) {
  const a = state.settings.ai, p = provById(a.provider);
  const r = await fetch(`${p.base}/audio/speech`, { method: 'POST', headers: headers(p, a.key), body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'sage', input: text, instructions: 'Speak in a calm, warm, measured and humble tone, like a careful bookkeeper giving a short update.' }), signal });
  await check(r, p); return await r.blob();
}
