// ФБШ-19: access token зөвхөн санах ойд (localStorage/cookie-д биш),
// хуудас дахин ачаалахад refresh cookie-гоор сэргээнэ (client.ts-ийн bootstrap).
let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  for (const listener of listeners) listener(token);
}

export function subscribeAccessToken(listener: (token: string | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
