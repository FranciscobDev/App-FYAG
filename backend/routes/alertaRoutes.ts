import { Router } from 'express';
import {
    actualizarConfiguracionCorreoAlerta,
    crearAlertaSistema,
    listarAlertasUsuario,
    marcarAlertaComoLeida,
    marcarTodasAlertasComoLeidas,
    obtenerConfiguracionCorreoAlertas,
    obtenerContadorAlertasNoLeidas,
} from '../controllers/alertaController';
import { verificarRoles } from '../middleware/authMiddleware';

const router = Router();
const todosLosRoles = verificarRoles('admin', 'warehouse', 'technician');

// [BACK-1] Bandeja de alertas filtrada estrictamente por el rol y usuario en sesión
router.get('/', todosLosRoles, listarAlertasUsuario);

// [BACK-1] Contador de alertas no leídas en tiempo real (filtrado por rol/usuario)
router.get('/contador', todosLosRoles, obtenerContadorAlertasNoLeidas);
router.get('/no-leidas/contador', todosLosRoles, obtenerContadorAlertasNoLeidas);

// [BACK-1] Configuración de envío opcional por correo según tipo de alerta
router.get('/configuracion-correo', verificarRoles('admin'), obtenerConfiguracionCorreoAlertas);
router.put('/configuracion-correo/:tipo', verificarRoles('admin'), actualizarConfiguracionCorreoAlerta);
router.patch('/configuracion-correo/:tipo', verificarRoles('admin'), actualizarConfiguracionCorreoAlerta);

// [BACK-1] Marcado de lectura individual y masivo (restringido a las alertas visibles para el rol)
router.post('/leer-todas', todosLosRoles, marcarTodasAlertasComoLeidas);
router.patch('/leer-todas', todosLosRoles, marcarTodasAlertasComoLeidas);
router.post('/:id/leer', todosLosRoles, marcarAlertaComoLeida);
router.patch('/:id/leer', todosLosRoles, marcarAlertaComoLeida);

// Emisión de alerta con despacho opcional por correo electrónico
router.post('/', verificarRoles('admin', 'warehouse'), crearAlertaSistema);

export default router;
