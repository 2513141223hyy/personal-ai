const fallback={messages:[],observations:[],facts:[],documents:[]};
export async function getStore(env){if(env.ZHIWO_KV){const value=await env.ZHIWO_KV.get('store');return value?JSON.parse(value):structuredClone(fallback)}return structuredClone(fallback)}
export async function putStore(env,data){if(env.ZHIWO_KV)await env.ZHIWO_KV.put('store',JSON.stringify(data));return data}
export function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8'}})}
