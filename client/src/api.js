// Cookies remain HttpOnly; React never reads or stores the session token.
export async function api(path, method = 'GET', body) {
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
