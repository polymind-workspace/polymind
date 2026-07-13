export interface TokenStore {
  get: () => string | null;
  set: (token: string) => void;
  clear: () => void;
}

export interface AddrStore {
  get: () => string | null;
  set: (addr: string) => void;
  clear: () => void;
}

interface StringStore {
  get: () => string | null;
  set: (value: string) => void;
  clear: () => void;
}

function createStringStore(key: string): StringStore {
  return {
    get: () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set: (value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };
}

export function createTokenStore(key: string): TokenStore {
  return createStringStore(key);
}

export function createAddrStore(key: string): AddrStore {
  return createStringStore(key);
}
