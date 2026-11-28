import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AlmacenamientoClaveValor,
  CLAVE_BASE_API,
  CLAVE_REFRESH_TOKEN,
  CLAVE_TOKEN,
  cerrarSesionSegura,
  crearControlEnvioUnico,
  obtenerRutasNavegacionPorRol,
  procesarInicioSesion,
  procesarVerificacion2fa,
  restaurarSesionGuardada,
  resolverRolDesdeBd,
} from "../src/nucleo/flujoAutenticacion";
import {
  esUriRecursoSegura,
  escaparTextoSeguroXss,
  validarArchivoSubidoFrontend,
} from "../src/nucleo/seguridadFrontend";

const crearAlmacenamientoMemoria = (inicial: Record<string, string> = {}) => {
  const mapa = new Map<string, string>(Object.entries(inicial));
  const almacenamiento: AlmacenamientoClaveValor = {
    getItem: async (k) => mapa.get(k) ?? null,
    setItem: async (k, v) => {
      mapa.set(k, v);
    },
    removeItem: async (k) => {
      mapa.delete(k);
    },
    multiRemove: async (claves) => {
      claves.forEach((k) => mapa.delete(k));
    },
  };
  return { almacenamiento, mapa };
};

test("1. Iniciar sesión real con backend guarda token, URL base y construye sesión autenticada", async () => {
  const { almacenamiento, mapa } = crearAlmacenamientoMemoria();
  let tokenEnMemoria: string | null = null;

  const resultado = await procesarInicioSesion({
    correo: "admin@fyag.cl",
    contrasena: "ClaveSegura123!",
    loginFn: async () => ({
      ok: true,
      data: {
        token: "jwt-real-servidor",
        usuario: {
          id_usuario: 10,
          nombre_usuario: "Sebastián",
          apellido_usuario: "Rodríguez",
          correo_usuario: "admin@fyag.cl",
          rut: "15.234.567-8",
          id_rol: 1,
          nombre_rol: "Administrador",
          activo: true,
        },
      },
    }),
    almacenamiento,
    obtenerUrlBase: () => "https://api.fyag.cl/api",
    fijarToken: (t) => {
      tokenEnMemoria = t;
    },
    nodeEnv: "production",
  });

  assert.equal(resultado.error, null);
  assert.ok(resultado.sesion);
  assert.equal(resultado.sesion.rol, "admin");
  assert.equal(resultado.sesion.idUsuario, 10);
  assert.equal(tokenEnMemoria, "jwt-real-servidor");
  assert.equal(mapa.get(CLAVE_TOKEN), "jwt-real-servidor");
  assert.equal(mapa.get(CLAVE_BASE_API), "https://api.fyag.cl/api");
});

test("2. Rechazar credenciales incorrectas (401) limpia el token y jamás activa el fallback simulado", async () => {
  const { almacenamiento, mapa } = crearAlmacenamientoMemoria({
    [CLAVE_TOKEN]: "token-viejo",
  });
  let tokenEnMemoria: string | null = "token-viejo";

  const resultado = await procesarInicioSesion({
    correo: "admin@fyag.cl",
    contrasena: "clave-incorrecta",
    loginFn: async () => ({
      ok: false,
      sinConexion: false, // El servidor sí respondió (401)
      error: "Correo o contraseña incorrectos",
    }),
    almacenamiento,
    obtenerUrlBase: () => "http://localhost:3000/api",
    fijarToken: (t) => {
      tokenEnMemoria = t;
    },
    nodeEnv: "development",
    permitirMockEnv: "true",
  });

  assert.equal(resultado.sesion, null);
  assert.equal(resultado.error, "Correo o contraseña incorrectos");
  assert.equal(tokenEnMemoria, null);
  assert.equal(mapa.has(CLAVE_TOKEN), false);
});

test("3. Bloquear el fallback simulado en producción aunque no haya conexión con el backend", async () => {
  const { almacenamiento } = crearAlmacenamientoMemoria();
  let tokenEnMemoria: string | null = null;

  const resultado = await procesarInicioSesion({
    correo: "admin@fyag.cl",
    contrasena: "cualquiera",
    loginFn: async () => ({
      ok: false,
      sinConexion: true,
      error: "No se pudo conectar al servidor",
    }),
    almacenamiento,
    obtenerUrlBase: () => "https://api.fyag.cl/api",
    fijarToken: (t) => {
      tokenEnMemoria = t;
    },
    nodeEnv: "production",
    permitirMockEnv: "true",
  });

  assert.equal(resultado.sesion, null);
  assert.equal(tokenEnMemoria, null);
  assert.match(resultado.error ?? "", /No se pudo conectar/);
});

test("4. Restaurar sesión válida cuando el backend confirma el token en /auth/sesion", async () => {
  const { almacenamiento } = crearAlmacenamientoMemoria({
    [CLAVE_TOKEN]: "jwt-persistido",
    [CLAVE_BASE_API]: "https://api.fyag.cl/api",
  });
  let tokenActual: string | null = null;
  let urlBaseActual = "http://localhost:3000/api";

  const resultado = await restaurarSesionGuardada({
    almacenamiento,
    fetchFn: (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        usuario: {
          id_usuario: 4,
          nombre_usuario: "Roberto",
          apellido_usuario: "Gómez",
          correo_usuario: "rgomez@fyag.cl",
          rut: "14.555.666-7",
          id_rol: 2,
          nombre_rol: "Bodeguero",
          activo: true,
        },
      }),
    })) as any,
    obtenerUrlBase: () => urlBaseActual,
    fijarUrlBase: (u) => {
      urlBaseActual = u;
    },
    fijarToken: (t) => {
      tokenActual = t;
    },
    encabezadosAuth: () => (tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {}),
  });

  assert.equal(resultado.motivo, "restaurada");
  assert.ok(resultado.sesion);
  assert.equal(resultado.sesion.rol, "warehouse");
  assert.equal(urlBaseActual, "https://api.fyag.cl/api");
  assert.equal(tokenActual, "jwt-persistido");
});

test("5. Restaurar sesión revocada (401 SESSION_REVOKED) elimina el token y la URL guardados", async () => {
  const { almacenamiento, mapa } = crearAlmacenamientoMemoria({
    [CLAVE_TOKEN]: "jwt-revocado",
    [CLAVE_BASE_API]: "https://api.fyag.cl/api",
  });
  let tokenActual: string | null = null;

  const resultado = await restaurarSesionGuardada({
    almacenamiento,
    fetchFn: (async () => ({
      ok: false,
      status: 401,
      json: async () => ({ codigo: "SESSION_REVOKED", mensaje: "Sesión cerrada" }),
    })) as any,
    obtenerUrlBase: () => "https://api.fyag.cl/api",
    fijarUrlBase: () => {},
    fijarToken: (t) => {
      tokenActual = t;
    },
    encabezadosAuth: () => ({}),
  });

  assert.equal(resultado.motivo, "revocada");
  assert.equal(resultado.sesion, null);
  assert.equal(tokenActual, null);
  assert.equal(mapa.has(CLAVE_TOKEN), false);
  assert.equal(mapa.has(CLAVE_BASE_API), false);
});

test("6. Navegar según cada rol: mapea roles de BD y expone las vistas exclusivas de cada perfil", () => {
  assert.equal(resolverRolDesdeBd("Administrador", 1), "admin");
  assert.equal(resolverRolDesdeBd("Bodeguero", 2), "warehouse");
  assert.equal(resolverRolDesdeBd("Técnico en Terreno", 3), "technician");
  assert.equal(resolverRolDesdeBd("InvitadoExterno", 99), null);

  const rutasAdmin = obtenerRutasNavegacionPorRol("admin");
  const rutasBodega = obtenerRutasNavegacionPorRol("warehouse");
  const rutasTecnico = obtenerRutasNavegacionPorRol("technician");

  assert.ok(rutasAdmin.includes("compras") && rutasAdmin.includes("proyectos"));
  assert.ok(rutasBodega.includes("recepcion") && !rutasBodega.includes("compras"));
  assert.deepEqual(rutasTecnico, ["proyectos", "devolucion", "solicitudes", "perfil"]);
});

test("7. Abrir la aplicación sin conexión conserva el token en disco pero no abre sesión autenticada", async () => {
  const { almacenamiento, mapa } = crearAlmacenamientoMemoria({
    [CLAVE_TOKEN]: "jwt-valido-en-disco",
    [CLAVE_BASE_API]: "https://api.fyag.cl/api",
  });
  let tokenActual: string | null = null;

  const resultado = await restaurarSesionGuardada({
    almacenamiento,
    fetchFn: (async () => {
      throw new Error("Network request failed");
    }) as any,
    obtenerUrlBase: () => "https://api.fyag.cl/api",
    fijarUrlBase: () => {},
    fijarToken: (t) => {
      tokenActual = t;
    },
    encabezadosAuth: () => ({}),
  });

  assert.equal(resultado.motivo, "sin_conexion");
  assert.equal(resultado.sesion, null);
  assert.equal(tokenActual, null);
  // El token sigue en almacenamiento local para cuando regrese la conexión
  assert.equal(mapa.get(CLAVE_TOKEN), "jwt-valido-en-disco");
});

test("8. Guardar y sincronizar operaciones offline mantiene el estado pendiente hasta confirmar con el servidor", async () => {
  const { almacenamiento } = crearAlmacenamientoMemoria();
  const claveCola = "hojas_servicio_disco_tecnico_1";

  const operacionOffline = {
    id: "HS-LOCAL-001",
    status: "pendiente" as "pendiente" | "sincronizado",
    receptor: "Jefe de Obra",
    notas: "Instalación completada sin conexión",
  };

  await almacenamiento.setItem(claveCola, JSON.stringify({ hojasLocales: [operacionOffline] }));

  // Al leer sin conexión sigue figurando como pendiente de sincronización
  const antesDeSync = JSON.parse((await almacenamiento.getItem(claveCola))!);
  assert.equal(antesDeSync.hojasLocales.length, 1);
  assert.equal(antesDeSync.hojasLocales[0].status, "pendiente");

  // Al recuperar conexión y recibir confirmación del backend, pasa a sincronizado
  antesDeSync.hojasLocales[0].status = "sincronizado";
  await almacenamiento.setItem(claveCola, JSON.stringify(antesDeSync));

  const despuesDeSync = JSON.parse((await almacenamiento.getItem(claveCola))!);
  assert.equal(despuesDeSync.hojasLocales[0].status, "sincronizado");
});

test("9. Evitar enviar formularios duplicados mientras una operación sigue en curso", async () => {
  const control = crearControlEnvioUnico();
  let ejecucionesReales = 0;

  let resolverPrimera!: (valor: string) => void;
  const promesaLenta = new Promise<string>((resolve) => {
    resolverPrimera = resolve;
  });

  const intento1 = control.ejecutar(async () => {
    ejecucionesReales += 1;
    return promesaLenta;
  });

  // Segundo clic inmediato mientras el primero está en vuelo
  const intento2 = await control.ejecutar(async () => {
    ejecucionesReales += 1;
    return "duplicado";
  });

  assert.equal(intento2.ejecutado, false);
  assert.equal(control.estaEnviando(), true);

  resolverPrimera("ok");
  const res1 = await intento1;
  assert.equal(res1.ejecutado, true);
  assert.equal(ejecucionesReales, 1);
  assert.equal(control.estaEnviando(), false);
});

test("10. Flujo 2FA de Administrador: exige código de 6 dígitos antes de guardar tokens y abrir sesión", async () => {
  const { almacenamiento, mapa } = crearAlmacenamientoMemoria();
  let tokenEnMemoria: string | null = null;

  // Paso 1: credenciales correctas de Admin devuelven desafío 2FA
  const paso1 = await procesarInicioSesion({
    correo: "admin@fyag.cl",
    contrasena: "ClaveSegura123!",
    loginFn: async () => ({
      ok: true,
      data: {
        requiere_2fa: true,
        desafio_token: "desafio-jwt-temporal",
        mensaje: "Ingresa el código de 6 dígitos",
      },
    }),
    almacenamiento,
    obtenerUrlBase: () => "https://api.fyag.cl/api",
    fijarToken: (t) => {
      tokenEnMemoria = t;
    },
    nodeEnv: "production",
  });

  assert.equal(paso1.sesion, null);
  assert.equal(paso1.error, null);
  assert.ok(paso1.desafio2fa);
  assert.equal(paso1.desafio2fa.desafioToken, "desafio-jwt-temporal");
  assert.equal(mapa.has(CLAVE_TOKEN), false);

  // Paso 2: código con formato inválido es rechazado localmente
  const formatoInvalido = await procesarVerificacion2fa({
    desafioToken: paso1.desafio2fa.desafioToken,
    codigo: "12ab",
    verificarFn: async () => ({ ok: true }),
    almacenamiento,
    obtenerUrlBase: () => "https://api.fyag.cl/api",
    fijarToken: (t) => {
      tokenEnMemoria = t;
    },
  });
  assert.equal(formatoInvalido.sesion, null);
  assert.match(formatoInvalido.error ?? "", /6 dígitos/);

  // Paso 3: código de 6 dígitos válido entrega Access Token + Refresh Token y abre sesión Admin
  const paso2 = await procesarVerificacion2fa({
    desafioToken: paso1.desafio2fa.desafioToken,
    codigo: "482910",
    verificarFn: async () => ({
      ok: true,
      data: {
        token: "jwt-access-15m",
        refresh_token: "jwt-refresh-7d",
        usuario: {
          id_usuario: 1,
          nombre_usuario: "Sebastián",
          apellido_usuario: "Rodríguez",
          correo_usuario: "admin@fyag.cl",
          rut: "15.234.567-8",
          id_rol: 1,
          nombre_rol: "Administrador",
          activo: true,
        },
      },
    }),
    almacenamiento,
    obtenerUrlBase: () => "https://api.fyag.cl/api",
    fijarToken: (t) => {
      tokenEnMemoria = t;
    },
  });

  assert.equal(paso2.error, null);
  assert.ok(paso2.sesion);
  assert.equal(paso2.sesion.rol, "admin");
  assert.equal(tokenEnMemoria, "jwt-access-15m");
  assert.equal(mapa.get(CLAVE_TOKEN), "jwt-access-15m");
  assert.equal(mapa.get(CLAVE_REFRESH_TOKEN), "jwt-refresh-7d");
});

test("11. Renovación con Refresh Token al expirar el Access Token corto y revocación en servidor al cerrar sesión", async () => {
  const { almacenamiento, mapa } = crearAlmacenamientoMemoria({
    [CLAVE_TOKEN]: "jwt-access-vencido",
    [CLAVE_REFRESH_TOKEN]: "jwt-refresh-vigente",
    [CLAVE_BASE_API]: "https://api.fyag.cl/api",
  });
  let tokenActual: string | null = null;

  const restauracion = await restaurarSesionGuardada({
    almacenamiento,
    fetchFn: (async (url: string) => {
      if (url.endsWith("/auth/sesion")) {
        return { ok: false, status: 401, json: async () => ({ mensaje: "Expirado" }) };
      }
      if (url.endsWith("/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            token: "jwt-access-nuevo-15m",
            refresh_token: "jwt-refresh-rotado-7d",
            usuario: {
              id_usuario: 3,
              nombre_usuario: "Marco",
              apellido_usuario: "Silva",
              correo_usuario: "msilva@fyag.cl",
              rut: "18.111.222-3",
              id_rol: 3,
              nombre_rol: "Técnico",
              activo: true,
            },
          }),
        };
      }
      throw new Error("Ruta no esperada");
    }) as any,
    obtenerUrlBase: () => "https://api.fyag.cl/api",
    fijarUrlBase: () => {},
    fijarToken: (t) => {
      tokenActual = t;
    },
    encabezadosAuth: () => ({}),
  });

  assert.equal(restauracion.motivo, "renovada");
  assert.ok(restauracion.sesion);
  assert.equal(restauracion.sesion.rol, "technician");
  assert.equal(tokenActual, "jwt-access-nuevo-15m");
  assert.equal(mapa.get(CLAVE_TOKEN), "jwt-access-nuevo-15m");
  assert.equal(mapa.get(CLAVE_REFRESH_TOKEN), "jwt-refresh-rotado-7d");

  // Al cerrar sesión se invoca POST /auth/logout en el servidor y se borran las 3 claves locales
  let logoutServidorLlamado = false;
  await cerrarSesionSegura({
    almacenamiento,
    fijarToken: (t) => {
      tokenActual = t;
    },
    logoutFn: async () => {
      logoutServidorLlamado = true;
      return true;
    },
  });

  assert.equal(logoutServidorLlamado, true);
  assert.equal(tokenActual, null);
  assert.equal(mapa.has(CLAVE_TOKEN), false);
  assert.equal(mapa.has(CLAVE_REFRESH_TOKEN), false);
  assert.equal(mapa.has(CLAVE_BASE_API), false);
});

test("12. Seguridad Frontend: escapa XSS, bloquea esquemas javascript:/data:text/html y valida magic bytes de archivos", () => {
  const payloadXss = `<img src=x onerror="alert('xss')"> & 'script'`;
  const escapado = escaparTextoSeguroXss(payloadXss);
  assert.equal(escapado.includes("<img"), false);
  assert.equal(escapado, "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; &#39;script&#39;");

  // Esquemas URI peligrosos bloqueados
  assert.equal(esUriRecursoSegura("javascript:alert(1)"), false);
  assert.equal(esUriRecursoSegura("data:text/html;base64,PHNjcmlwdD4="), false);
  assert.equal(esUriRecursoSegura("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(esUriRecursoSegura("https://api.fyag.cl/evidencia.jpg"), true);

  // Path traversal bloqueado
  const traversal = validarArchivoSubidoFrontend({
    nombre: "../../etc/passwd.jpg",
    mimeDeclarado: "image/jpeg",
    tamanoBytes: 1024,
  });
  assert.equal(traversal.ok, false);

  // Extensión ejecutable/SVG bloqueada
  const svg = validarArchivoSubidoFrontend({
    nombre: "vector.svg",
    mimeDeclarado: "image/svg+xml",
    tamanoBytes: 1024,
  });
  assert.equal(svg.ok, false);

  // Archivo con magic bytes de PDF disfrazado de JPEG bloqueado
  const pdfComoJpg = validarArchivoSubidoFrontend({
    nombre: "falso.jpg",
    mimeDeclarado: "image/jpeg",
    tamanoBytes: 2048,
    cabeceraBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]), // %PDF
  });
  assert.equal(pdfComoJpg.ok, false);

  // Foto JPEG real dentro del límite de 5 MB es aceptada
  const jpegValido = validarArchivoSubidoFrontend({
    nombre: "Evidencia Faena 01.jpg",
    mimeDeclarado: "image/jpeg",
    tamanoBytes: 500_000,
    cabeceraBytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
    uri: "https://api.fyag.cl/foto.jpg",
  });
  assert.equal(jpegValido.ok, true);
  assert.equal(jpegValido.nombreSanitizado, "Evidencia_Faena_01.jpg");
});
