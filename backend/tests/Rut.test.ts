import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarRut, formatearRut } from '../utils/rut';
import { aplicarOcultamientoBancario } from '../services/ocultarDatosBancarios';

test('RUT válido con DV numérico', () => {
  assert.equal(validarRut('12.345.678-5'), true);
});

test('RUT válido con DV K', () => {
  assert.equal(validarRut('1.000.005-K'), true);
});

test('RUT con DV erróneo es rechazado', () => {
  assert.equal(validarRut('12.345.678-9'), false);
  assert.equal(validarRut('1.000.005-5'), false);
});

test('Formato inválido es rechazado', () => {
  assert.equal(validarRut(''), false);
  assert.equal(validarRut('abc'), false);
});

test('formatearRut produce 12.345.678-5', () => {
  assert.equal(formatearRut('123456785'), '12.345.678-5');
});

test('Bodeguero no recibe datos bancarios', () => {
  const p = { id_proveedor: 1, nombre_proveedor: 'X', datos_bancarios: { cuenta_banco: '1', banco_proveedor: 'Y' } };
  const r = aplicarOcultamientoBancario(p, 'Bodeguero') as any;
  assert.equal('datos_bancarios' in r, false);
});

test('Administrador sí recibe datos bancarios', () => {
  const p = { id_proveedor: 1, datos_bancarios: { cuenta_banco: '1', banco_proveedor: 'Y' } };
  const r = aplicarOcultamientoBancario(p, 'Administrador') as any;
  assert.deepEqual(r.datos_bancarios, { cuenta_banco: '1', banco_proveedor: 'Y' });
});