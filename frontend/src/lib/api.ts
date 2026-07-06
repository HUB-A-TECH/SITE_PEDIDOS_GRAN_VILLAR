import axios from 'axios';

// baseURL relativo: em dev o Vite faz proxy de /api -> backend.
// withCredentials garante o envio do cookie de sessão (HttpOnly).
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});
