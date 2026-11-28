import { Router, Request, Response } from 'express';
import type { Pool } from 'pg';
import { validarRut, formatearRut } from '../utils/rut';
import { aplicarOcultamientoBancario, puedeVerDatosBancarios } from './ocultarDatosBancarios';

// Rol del usuario autenticado. Se asume que el middleware de auth deja req.usuario = { id, rol }.
function rolDe(req: Request): string | undefined {
  return (req as any).usuario?.rol;
}

const CAMPOS_BASE = `p.id_proveedor, p.nombre_proveedor, p.rut_proveedor,
  p.correo_contacto, p.telefono, p.direccion`;

export function createProveedoresRouter(pool: Pool): Router {
  const router = Router();

  // Consulta base. Los datos bancarios solo se piden a la base si el rol puede verlos.
  async function obtenerProveedores(rol: string | undefined, where = '', params: unknown[] = []) {
    const conBanco = puedeVerDatosBancarios(rol);
    const sql = conBanco
      ? `SELECT ${CAMPOS_BASE}, db.cuenta_banco, db.banco_proveedor
           FROM proveedor p
           LEFT JOIN datos_bancarios_proveedor db ON db.id_proveedor = p.id_proveedor ${where}
           ORDER BY p.id_proveedor`
      : `SELECT ${CAMPOS_BASE} FROM proveedor p ${where} ORDER BY p.id_proveedor`;
    const { rows } = await pool.query(sql, params);
    return rows.map((fila) => {
      if (!conBanco) return fila;
      const { cuenta_banco, banco_proveedor, ...resto } = fila;
      return { ...resto, datos_bancarios: { cuenta_banco, banco_proveedor } };
    });
  }

  // GET /proveedores
  router.get('/', async (req, res) => {
    try {
      const rol = rolDe(req);
      const filas = await obtenerProveedores(rol);
      res.json(filas.map((p) => aplicarOcultamientoBancario(p, rol)));
    } catch (err) {
      res.status(500).json({ error: 'Error al listar proveedores' });
    }
  });

  // GET /proveedores/:id
  router.get('/:id', async (req, res) => {
    try {
      const rol = rolDe(req);
      const filas = await obtenerProveedores(rol, 'WHERE p.id_proveedor = $1', [req.params.id]);
      if (filas.length === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
      res.json(aplicarOcultamientoBancario(filas[0], rol));
    } catch (err) {
      res.status(500).json({ error: 'Error al obtener proveedor' });
    }
  });

  // POST /proveedores
  router.post('/', async (req: Request, res: Response) => {
    const { nombre_proveedor, rut_proveedor, correo_contacto, telefono, direccion } = req.body ?? {};
    if (!nombre_proveedor) return res.status(400).json({ error: 'nombre_proveedor es obligatorio' });
    if (rut_proveedor && !validarRut(rut_proveedor)) {
      return res.status(400).json({ error: 'RUT inválido: el dígito verificador no corresponde' });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO proveedor (nombre_proveedor, rut_proveedor, correo_contacto, telefono, direccion)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_proveedor`,
        [nombre_proveedor, rut_proveedor ? formatearRut(rut_proveedor) : null, correo_contacto, telefono, direccion]
      );
      res.status(201).json({ id_proveedor: rows[0].id_proveedor });
    } catch (err) {
      res.status(500).json({ error: 'Error al crear proveedor' });
    }
  });

  // PUT /proveedores/:id
  router.put('/:id', async (req: Request, res: Response) => {
    const { nombre_proveedor, rut_proveedor, correo_contacto, telefono, direccion } = req.body ?? {};
    if (rut_proveedor !== undefined && rut_proveedor !== null && !validarRut(rut_proveedor)) {
      return res.status(400).json({ error: 'RUT inválido: el dígito verificador no corresponde' });
    }
    try {
      const { rowCount } = await pool.query(
        `UPDATE proveedor SET
           nombre_proveedor = COALESCE($2, nombre_proveedor),
           rut_proveedor    = COALESCE($3, rut_proveedor),
           correo_contacto  = COALESCE($4, correo_contacto),
           telefono         = COALESCE($5, telefono),
           direccion        = COALESCE($6, direccion)
         WHERE id_proveedor = $1`,
        [
          req.params.id,
          nombre_proveedor ?? null,
          rut_proveedor ? formatearRut(rut_proveedor) : null,
          correo_contacto ?? null,
          telefono ?? null,
          direccion ?? null,
        ]
      );
      if (rowCount === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
  });

  // DELETE /proveedores/:id
  router.delete('/:id', async (req, res) => {
    try {
      const { rowCount } = await pool.query('DELETE FROM proveedor WHERE id_proveedor = $1', [req.params.id]);
      if (rowCount === 0) return res.status(404).json({ error: 'Proveedor no encontrado' });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
  });

  return router;
}