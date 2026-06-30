import { api } from './api.js';

function rootPrefix() {
  const path = window.location.pathname.replace(/\\/g, '/');
  if (path.includes('/pages/player/') || path.includes('/pages/scout/')) return '../..';
  if (path.includes('/pages/')) return '..';
  return '.';
}

const ROLE_PAGES = {
  player: '/pages/player/dashboard.html',
  scout: '/pages/scout/dashboard.html',
};

export function indexPath() {
  return `${rootPrefix()}/index.html`;
}

export function getRole() {
  return localStorage.getItem('role');
}

export function getToken() {
  return localStorage.getItem('token');
}

export function isLoggedIn() {
  return !!getToken();
}

export function redirectByRole(role) {
  const root = rootPrefix();
  const page = ROLE_PAGES[role];
  window.location.href = page ? `${root}${page}` : `${root}/index.html`;
}

export function requireGuest() {
  if (isLoggedIn()) redirectByRole(getRole());
}

export function requireRole(...roles) {
  if (!isLoggedIn()) {
    window.location.href = indexPath();
    return false;
  }
  const role = getRole();
  if (!roles.includes(role)) {
    redirectByRole(role);
    return false;
  }
  return true;
}

export function logout() {
  localStorage.clear();
  window.location.href = indexPath();
}

export async function login(username, password, role) {
  const res = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  });
  localStorage.setItem('token', res.token);
  localStorage.setItem('role', res.role);
  localStorage.setItem('username', res.username);
  localStorage.setItem('userId', String(res.id));
  if (res.avatar) localStorage.setItem('avatar', res.avatar);
  return res;
}

export async function register({ username, password, email, role, city }) {
  return api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, email, role, city }),
  });
}

export async function resetPassword({ username, email, newPassword }) {
  return api('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ username, email, newPassword }),
  });
}
