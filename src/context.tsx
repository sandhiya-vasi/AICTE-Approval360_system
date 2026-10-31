import { createContext, useContext } from 'react';
import type { Data, Application } from './types';
export type Field={name:string;label:string;type?:string;options?:{value:string;label:string}[];value?:string|number;min?:number;max?:number;required?:boolean};
export type FormSpec={title:string;description?:string;fields:Field[];submit:string;onSubmit:(values:Record<string,string>)=>Promise<void>};
export type Workspace={data:Data;reload:()=>Promise<void>;notify:(text:string,error?:boolean)=>void;openForm:(form:FormSpec)=>void;openApplication:(app:Application)=>void;openLogin:()=>void;perform:(url:string,body?:unknown,method?:string)=>Promise<void>};
export const WorkspaceContext=createContext<Workspace>(null!);
export const useWorkspace=()=>useContext(WorkspaceContext);
