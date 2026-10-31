import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_BASE_URL||'/api',withCredentials:true,timeout:30000});
export function message(error:unknown){return axios.isAxiosError(error)?error.response?.data?.error||'The server is unavailable. Please try again.':error instanceof Error?error.message:'Something went wrong.';}
export function csv(name:string,rows:Record<string,unknown>[]){
 const headers=Object.keys(rows[0]||{});const cell=(value:unknown)=>{let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 const content=[headers.map(cell).join(','),...rows.map(row=>headers.map(key=>cell(row[key])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
