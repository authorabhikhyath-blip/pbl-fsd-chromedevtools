import React,{createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';import axios from 'axios';import {api,configureAuth} from './api';
const Auth=createContext(null),base=import.meta.env.VITE_API_URL||'http://localhost:4000';
export function AuthProvider({children}){const [session,setSession]=useState(null),[ready,setReady]=useState(false),[now,setNow]=useState(Date.now()),timer=useRef(null);
const logout=useCallback(async(callServer=true)=>{clearTimeout(timer.current);if(callServer)try{await axios.post(`${base}/v1/auth/logout`,{}, {withCredentials:true});}catch{}setSession(null);setReady(true);if(location.pathname!=='/login'&&location.pathname!=='/before')location.assign('/login');},[]);
const accept=useCallback(payload=>{const expiresAt=Date.now()+payload.expiresIn*1000;setSession({...payload,expiresAt});return payload.accessToken;},[]);
const refresh=useCallback(async()=>{const {data}=await axios.post(`${base}/v1/auth/refresh`,{}, {withCredentials:true});setSession({...data,expiresAt:Date.now()+data.expiresIn*1000});setReady(true);return data.accessToken;},[]);
useEffect(()=>{configureAuth({getToken:()=>session?.accessToken,refresh,logout:()=>logout(false)});},[session,refresh,logout]);
useEffect(()=>{let alive=true;axios.post(`${base}/v1/auth/refresh`,{}, {withCredentials:true}).then(({data})=>{if(alive){setSession({...data,expiresAt:Date.now()+data.expiresIn*1000});setReady(true);}}).catch(()=>{if(alive)setReady(true);});return()=>{alive=false;}},[]);
useEffect(()=>{if(!session)return;clearTimeout(timer.current);const delay=Math.max(0,session.expiresAt-Date.now()-20000);timer.current=setTimeout(()=>refresh().catch(()=>logout(false)),delay);return()=>clearTimeout(timer.current);},[session,refresh,logout]);
useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(id);},[]);
const login=useCallback(async(email,password)=>{const {data}=await api.post('/v1/auth/login',{email,password});setSession({...data,expiresAt:Date.now()+data.expiresIn*1000});setReady(true);return data.user;},[]);
const value=useMemo(()=>({session,user:session?.user||null,ready,login,logout,remaining:session?Math.max(0,Math.ceil((session.expiresAt-now)/1000)):null}),[session,ready,login,logout,now]);return <Auth.Provider value={value}>{children}</Auth.Provider>;}
export function useAuth(){return useContext(Auth);}
