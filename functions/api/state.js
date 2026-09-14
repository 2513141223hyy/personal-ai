import{getStore,json}from'./_store.js';export async function onRequestGet({env}){return json(await getStore(env))}
