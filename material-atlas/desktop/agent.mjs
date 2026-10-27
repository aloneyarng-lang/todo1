import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function normalizeAgentConfig(value = {}) {
  let url;
  try { url = new URL(String(value.baseUrl || 'https://api.openai.com/v1').trim()); } catch { throw new Error('请输入有效的 API 地址。'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) throw new Error('API 地址需要 HTTPS；本机服务可用 HTTP。地址中不能包含密钥、查询参数或账号。');
  const model = String(value.model || '').trim();
  if (!model || model.length > 200) throw new Error('请填写服务支持的模型名称。');
  const protocol = value.protocol || 'chat';
  if (!['chat', 'responses'].includes(protocol)) throw new Error('API 协议无效。');
  const apiKey = String(value.apiKey || '').trim();
  if (apiKey.length > 4096 || /[\r\n]/.test(apiKey)) throw new Error('API 密钥格式无效。');
  const baseUrl = url.href.replace(/\/(?:chat\/completions|responses)\/?$/, '').replace(/\/$/, '');
  return { baseUrl, model, protocol, apiKey, rememberKey: Boolean(value.rememberKey) };
}

// Kept in the desktop profile, outside library.json and library backups.
export class AgentSettings {
  constructor(profile, encryption) { this.file = path.join(profile, 'ai-agent.json'); this.encryption = encryption; this.config = null; this.queue = Promise.resolve(); this.canRememberKey = false; }
  async encryptionAvailable() { this.canRememberKey = Boolean(await (this.encryption?.isAsyncEncryptionAvailable?.() ?? this.encryption?.isEncryptionAvailable?.())); return this.canRememberKey; }
  async load() {
    await this.encryptionAvailable();
    let saved;
    try { saved = JSON.parse(await readFile(this.file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw new Error('AI 配置文件无法读取，请检查桌面配置目录。'); }
    if (saved?.model) {
      this.config = normalizeAgentConfig({ ...saved, apiKey: '' });
      if (saved.encryptedKey && this.canRememberKey) {
        try { const encrypted=Buffer.from(saved.encryptedKey,'base64'); const decoded=await (this.encryption.decryptStringAsync ? this.encryption.decryptStringAsync(encrypted) : this.encryption.decryptString(encrypted)); this.config.apiKey=typeof decoded==='string'?decoded:decoded.result; } catch { this.config.rememberKey = false; }
      }
      if (!this.config.apiKey) this.config.rememberKey = false;
    }
    return this.publicConfig();
  }
  publicConfig() {
    const { apiKey, ...config } = this.config || { baseUrl: 'https://api.openai.com/v1', model: '', protocol: 'chat', apiKey: '', rememberKey: false };
    return { ...config, hasKey: Boolean(apiKey), canRememberKey: this.canRememberKey };
  }
  save(value) {
    const operation = this.queue.then(async () => {
      const previous = this.config;
      const clean = normalizeAgentConfig(value);
      const next = { ...clean, apiKey: value.clearKey ? '' : (clean.apiKey || (previous?.baseUrl === clean.baseUrl ? previous.apiKey : '')) };
      if (next.rememberKey && !await this.encryptionAvailable()) throw new Error('系统加密不可用。请取消“记住密钥”，仅在本次运行使用。');
      const { apiKey, ...stored } = next;
      if (apiKey && next.rememberKey) stored.encryptedKey = (await (this.encryption.encryptStringAsync ? this.encryption.encryptStringAsync(apiKey) : this.encryption.encryptString(apiKey))).toString('base64');
      await mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(stored, null, 2), { mode: 0o600 });
      await rename(temp, this.file);
      this.config = next;
      return this.publicConfig();
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}

function providerBody(config, messages, tools) {
  if (config.protocol === 'chat') return { model: config.model, messages: messages.map(({providerOutput,...message})=>message), tools: tools.map(tool => ({ type: 'function', function: tool })), tool_choice: 'auto', stream: false };
  const input = [];
  for (const message of messages) {
    if (message.role === 'tool') input.push({ type: 'function_call_output', call_id: message.tool_call_id, output: message.content });
    else if (message.role === 'assistant' && Array.isArray(message.providerOutput)) input.push(...message.providerOutput.filter(item => ['reasoning','message','function_call'].includes(item.type)));
    else {
      if (message.content) input.push({ role: message.role === 'system' ? 'developer' : message.role, content: message.content });
      for (const call of message.tool_calls || []) input.push({ type: 'function_call', call_id: call.id, name: call.function.name, arguments: call.function.arguments });
    }
  }
  return { model: config.model, input, tools: tools.map(tool => ({ type: 'function', ...tool, strict: false })), tool_choice: 'auto', store: false, include: ['reasoning.encrypted_content'], stream: false };
}

export async function completeWithProvider(configValue, { messages, tools, signal }, fetcher = fetch) {
  const config = normalizeAgentConfig(configValue);
  const abort = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(90000)]);
  let response;
  try {
    response = await fetcher(`${config.baseUrl}/${config.protocol === 'responses' ? 'responses' : 'chat/completions'}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}) }, body: JSON.stringify(providerBody(config, messages, tools)), signal: abort, redirect: 'error' });
  } catch (error) {
    if (signal?.aborted) throw new DOMException('已停止生成。', 'AbortError');
    if (abort.aborted) throw new Error('AI 服务响应超时，请重试。');
    throw new Error('无法连接 AI 服务，请检查 API 地址、网络和证书。');
  }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`AI 服务返回 HTTP ${response.status}。${response.status === 401 || response.status === 403 ? '请检查密钥和模型访问权限。' : response.status === 429 ? '请求限流或额度不足。' : '请检查地址、模型名称和 API 协议；模型需要支持工具调用。'}`); }
  const reader = response.body.getReader(); let size = 0, raw = ''; const decoder = new TextDecoder();
  try {
    while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length; if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('AI 服务返回的内容过大。'); } raw += decoder.decode(value, { stream: true }); }
    raw += decoder.decode();
  } catch (error) { if (signal?.aborted) throw new DOMException('已停止生成。','AbortError'); if (abort.aborted) throw new Error('AI 服务响应超时，请重试。'); throw error; }
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('AI 服务未返回 JSON，请检查 API 地址及协议。'); }
  if (config.protocol === 'chat') {
    const choice = data.choices?.[0];
    if (!choice?.message || choice.finish_reason === 'length') throw new Error('模型返回不完整，请缩小问题范围或更换模型。');
    return choice.message;
  }
  if (!Array.isArray(data.output) || data.status === 'incomplete' || data.error) throw new Error('Responses API 返回不完整，请检查模型与服务支持。');
  return { content: data.output.filter(o => o.type === 'message').flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n'), tool_calls: data.output.filter(o => o.type === 'function_call').map(o => ({ id: o.call_id, type: 'function', function: { name: o.name, arguments: o.arguments } })), providerOutput: data.output };
}
