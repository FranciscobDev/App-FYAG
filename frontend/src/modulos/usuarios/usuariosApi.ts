import { encabezadosAuth, obtenerBaseUrlApi } from "@/nucleo/sesion";

const obtenerRuta = () => `${obtenerBaseUrlApi()}/usuarios`;

export interface Rol {
  id_rol: number;
  nombre_rol: string;
  descripcion: string | null;
}

export interface Usuario {
  id_usuario: number;
  nombre_usuario: string;
  apellido_usuario: string;
  correo_usuario: string;
  rut: string | null;
  id_rol: number;
  nombre_rol: string | null;
  especializacion: string | null;
  activo: boolean;
  ultimo_acceso?: string | null;
}

export interface FormularioUsuario {
  nombre_usuario: string;
  apellido_usuario: string;
  correo_usuario: string;
  rut: string | null;
  id_rol?: number | null;
  rol_codigo?: "admin" | "warehouse" | "technician";
  especializacion: string | null;
  contrasena?: string;
  activo: boolean;
}

export interface Resultado<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function peticion<T>(url: string, opciones?: RequestInit): Promise<Resultado<T>> {
  try {
    const res = await fetch(url, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        ...encabezadosAuth(),
      },
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json.mensaje ?? json.error ?? "Error en el servidor" };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}
export const listarUsuarios = () => peticion<Usuario[]>(obtenerRuta());

export const listarRoles = () => peticion<Rol[]>(`${obtenerRuta()}/roles`);

export const crearUsuario = (datos: FormularioUsuario) =>
  peticion<{ mensaje: string; usuario: Usuario }>(obtenerRuta(), {
    method: "POST",
    body: JSON.stringify(datos),
  });

export const actualizarUsuario = (id: number, datos: Partial<FormularioUsuario>) =>
  peticion<{ mensaje: string; usuario: Usuario }>(`${obtenerRuta()}/${id}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });

export const deshabilitarUsuario = (id: number) =>
  peticion<{ mensaje: string }>(`${obtenerRuta()}/${id}/deshabilitar`, {
    method: "PATCH",
  });

export const eliminarUsuario = (id: number) =>
  peticion<{ mensaje: string }>(`${obtenerRuta()}/${id}`, {
    method: "DELETE",
  });