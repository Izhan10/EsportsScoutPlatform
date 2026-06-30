import { api, API_URL } from './api.js';

export async function claimProfile(profileId) {
  return api(`/verification/claim/${profileId}`, { method: 'POST' });
}

export async function getClaimStatus(profileId) {
  return api(`/verification/claim/${profileId}/status`);
}

export async function verifySocial(profileId, provider, profileUrl) {
  return api(`/verification/claim/${profileId}/social/verify`, {
    method: 'POST',
    body: JSON.stringify({ provider, profile_url: profileUrl }),
  });
}

export async function confirmSocial(profileId, provider, code) {
  return api(`/verification/claim/${profileId}/social/confirm`, {
    method: 'POST',
    body: JSON.stringify({ provider, code }),
  });
}

export async function uploadSelfie(profileId, imageBlob) {
  const formData = new FormData();
  formData.append('selfie', imageBlob, 'selfie.webp');
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/verification/claim/${profileId}/selfie`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Selfie upload failed');
  return data;
}
