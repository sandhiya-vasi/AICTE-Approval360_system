import type { Config, Context } from '@netlify/functions';
import { handle } from '../../server/api';
export default async (req:Request,context:Context)=>{
 const response=await handle(req,context);
 response.headers.set('Cache-Control','private, no-store');
 response.headers.set('X-Content-Type-Options','nosniff');
 return response;
};
export const config:Config={path:'/api/*'};
