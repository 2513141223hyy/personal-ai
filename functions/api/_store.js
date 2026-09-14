const fallback={messages:[],observations:[],facts:[],documents:[]};
let memoryStore=structuredClone(fallback);
const kv = (env) => env['PERSONAL-AI'] || env.ZHIWO_KV;
export async function getStore(env){const store=kv(env);if(store){const value=await store.get('store');return value?JSON.parse(value):structuredClone(fallback)}return structuredClone(memoryStore)}
export async function putStore(env,data){const store=kv(env);if(store)await store.put('store',JSON.stringify(data));else memoryStore=structuredClone(data);return data}
export function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8'}})}
