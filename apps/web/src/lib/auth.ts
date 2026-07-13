import { runAuthHandshake, createTokenStore, type SiwsApi } from "@polymind/wallet";

export const tokenStore = createTokenStore("polymind_web_jwt");

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8300";

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${normalized}`;
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { ret: number; msg?: string; data: T };
  if (json.ret !== 200) {
    throw new Error(json.msg || `request failed: ${json.ret}`);
  }
  return json.data;
}

export const webSiwsApi: SiwsApi = {
  async nonce(address: string) {
    const res = await fetch(buildUrl("/api/v1/auth/nonce"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    return unwrap<{ nonce: string; message: string }>(res);
  },
  async verify(body) {
    const res = await fetch(buildUrl("/api/v1/auth/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return unwrap<{ token: string; expires_at: number }>(res);
  },
};

export { runAuthHandshake };
