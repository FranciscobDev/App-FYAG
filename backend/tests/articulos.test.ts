import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Request, Response } from 'express';
import { CATEGORIAS_ARTICULO, crearArticulo, validarCategoriaArticulo } from '../controllers/articuloController';

const capturarRespuesta = () => {
    let status = 0;
    let cuerpo: unknown;
    const res = {
        status: (c: number) => { status = c; return res; },
        json: (b: unknown) => { cuerpo = b; return res; },
    } as unknown as Response;
    return { res, estado: () => status, cuerpo: () => cuerpo };
};

test('[BACK-1] acepta solo las 5 categorías fijas de la base', () => {
    for (const c of CATEGORIAS_ARTICULO) {
        assert.equal(validarCategoriaArticulo(c), null);
    }
    assert.notEqual(validarCategoriaArticulo('Eléctrica'), null);
    assert.notEqual(validarCategoriaArticulo(''), null);
    assert.notEqual(validarCategoriaArticulo(undefined), null);
});

test('[BACK-1] crear artículo con categoría inválida responde 400 sin tocar la base', async () => {
    const captura = capturarRespuesta();
    await crearArticulo(
        { body: { nombre_articulo: 'Cable', categoria: 'Eléctrica' } } as unknown as Request<Record<string, string>, unknown, never>,
        captura.res
    );
    assert.equal(captura.estado(), 400);
    assert.match((captura.cuerpo() as { mensaje: string }).mensaje, /Herramientas, Materiales/);
});
