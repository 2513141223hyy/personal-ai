export function onRequestGet({env}){return Response.json({ok:true,configured:Boolean(env.ARK_API_KEY&&env.ARK_MODEL)})}
