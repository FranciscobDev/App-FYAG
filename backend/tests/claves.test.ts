import test from 'node:test';
import assert from 'node:assert/strict';
import { validarFortalezaClave } from '../services/claves';

test('[Contraseñas] acepta una clave que cumple la política', () => {
    assert.equal(validarFortalezaClave('ClaveSegura123'), null);
    assert.equal(validarFortalezaClave('AdminPrueba1'), null);
});

test('[Contraseñas] rechaza claves cortas, sin mayúscula o sin número', () => {
    assert.match(validarFortalezaClave('Corta1') ?? '', /10 caracteres/);
    assert.match(validarFortalezaClave('sinmayuscula123') ?? '', /mayúscula/);
    assert.match(validarFortalezaClave('SinNumeroAlguno') ?? '', /número/);
});
