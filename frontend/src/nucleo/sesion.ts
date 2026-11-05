let tokenActual: string | null = null;

export const establecerToken = (token: string | null) => {
  tokenActual = token;
};

export const encabezadosAuth = (): Record<string, string> =>
  tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {};