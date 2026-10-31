import type { Config } from '@netlify/functions';
// Same-origin gateway keeps Identity and demo cookies on the frontend domain.
export default async (req:Request)=>{
 const requestOrigin=req.headers.get('origin');
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&requestOrigin&&requestOrigin!==new URL(req.url).origin)return Response.json({error:'Request origin is not permitted.'},{status:403});
 const origin=Netlify.env.get('PYTHON_API_ORIGIN');
 if(!origin)return Response.json({error:'The Flask service is not connected. Configure PYTHON_API_ORIGIN or use the default hosted API.'},{status:503});
 const target=new URL(origin);
 if(target.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(target.hostname))return Response.json({error:'The Flask service must use HTTPS.'},{status:503});
 const url=new URL(req.url);target.pathname='/api/'+url.pathname.replace(/^\/python-api\/?/,'');target.search=url.search;
 try{
  const headers=new Headers();for(const name of ['cookie','authorization','content-type']){const value=req.headers.get(name);if(value)headers.set(name,value);}
  const response=await fetch(target,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:await req.arrayBuffer(),redirect:'manual',signal:AbortSignal.timeout(29000)});
  const outputHeaders=new Headers();for(const name of ['content-type','content-disposition','content-security-policy']){const value=response.headers.get(name);if(value)outputHeaders.set(name,value);}
  for(const value of response.headers.getSetCookie())outputHeaders.append('set-cookie',value);
  outputHeaders.set('Cache-Control','private, no-store');outputHeaders.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,headers:outputHeaders});
 }catch{return Response.json({error:'The Flask service is unavailable or timed out.'},{status:503});}
};
export const config:Config={path:'/python-api/*'};
