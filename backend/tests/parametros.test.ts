import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validarValorParametro } from '../services/parametros';
import { ErrorAplicacion } from '../services/errores';

test('[BACK-1] acepta enteros dentro de [min, max], como número o texto', () => {
    assert.equal(validarValorParametro(4, 'intentos_bloqueo', 1, 10), 4);
    assert.equal(validarValorParametro('7', 'intentos_bloqueo', 1, 10), 7);
    assert.equal(validarValorParametro(1, 'intentos_bloqueo', 1, 10), 1, 'el mínimo es inclusivo');
    assert.equal(validarValorParametro(10, 'intentos_bloqueo', 1, 10), 10, 'el máximo es inclusivo');
});

test('[BACK-1] rechaza valores fuera de [min, max] con 400', () => {
    for (const valor of [0, 11, -1]) {
        assert.throws(
            () => validarValorParametro(valor, 'intentos_bloqueo', 1, 10),
            (error: unknown) =>
                error instanceof ErrorAplicacion &&
                error.estado === 400 &&
                error.message === 'El valor de intentos_bloqueo debe estar entre 1 y 10'
        );
    }
});

test('[BACK-1] rechaza decimales, texto no numérico y no finitos', () => {
    for (const valor of [2.5, 'abc', '', null, undefined, NaN, Infinity, '1e3']) {
        assert.throws(
            () => validarValorParametro(valor, 'intentos_bloqueo', 1, 10),
            (error: unknown) => error instanceof ErrorAplicacion && error.estado === 400
        );
    }
});
