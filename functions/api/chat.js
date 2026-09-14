import { getStore, putStore, json } from './_store.js';
export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || '').trim();
  if (!text) return json({ error: '内容不能为空' }, 400);
  if (!env.ARK_API_KEY || !env.ARK_MODEL) return json({ error: '请在 Cloudflare Pages 设置 ARK_API_KEY 和 ARK_MODEL' }, 503);
  const d = await getStore(env);
  d.messages.push({ id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date().toISOString() });
  const upstream = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ARK_API_KEY}` }, body: JSON.stringify({ model: env.ARK_MODEL, messages: d.messages.slice(-24).map(({ role, content }) => ({ role, content })), stream: true }) });
  if (!upstream.ok) return json({ error: '豆包请求失败，请检查模型开通状态和 API Key' }, upstream.status);
  const reader = upstream.body.getReader(), decoder = new TextDecoder();
  let answer = '', buffer = '';
  const stream = new ReadableStream({ async start(controller) { try { while (true) { const { done, value } = await reader.read(); if (done) break; const chunk = decoder.decode(value, { stream: true }); buffer += chunk; const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) { if (!line.startsWith('data:') || line.includes('[DONE]')) continue; try { answer += JSON.parse(line.slice(5)).choices?.[0]?.delta?.content || ''; } catch {} } controller.enqueue(new TextEncoder().encode(chunk)); } d.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: answer, createdAt: new Date().toISOString() }); await putStore(env, d); controller.close(); } catch (error) { controller.error(error); } } });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' } });
}
