# FYAG Multisystem - React Native & Expo Go

Aplicación móvil y multisistema de gestión integral para FYAG, desarrollada en **React Native con TypeScript**, estilizada con **`StyleSheet.create`** puro y compatible directamente con **Expo Go**.

---

## 🚀 Cómo Ejecutar la Aplicación

### 1. Iniciar el Servidor de Desarrollo Metro
Desde la carpeta `frontend/`:
```bash
npm start
# o bien:
npx expo start
```

### 2. Probar en Dispositivo Móvil (Expo Go)
1. Instala la app **Expo Go** desde Google Play Store (Android) o App Store (iOS).
2. Conecta tu teléfono a la misma red Wi-Fi de tu computadora.
3. Escanea el código QR que aparece en la terminal o en la interfaz web de Metro con la cámara (iOS) o desde la app Expo Go (Android).

### 3. Probar en Navegador Web
Si deseas probar la app en tu navegador web:
```bash
npm run web
```

---

## 📱 Módulos y Roles Implementados (PASOS 1 al 10)

### 1. Sistema Multi-Rol con Cambio Rápido
- **Administrador:** Panel de KPIs, gestión de costos, proyectos, inventario, compras, autorizaciones y bloqueos de cierre.
- **Bodeguero:** Egreso de pedidos aprobados, recepción con checklist de calidad (conforme / defectuoso / faltante), ingreso de facturas con descuentos en cascada e IVA (19%), y confirmación física de devoluciones.
- **Técnico:** Proyectos asignados con semáforo de días restantes, solicitud de materiales contra stock/kits y devolución de sobrantes con validación de cantidad máxima.

### 2. Inventario y Cardex
- Catálogo con búsqueda reactiva por SKU o nombre.
- Resalte automático si `disponible ≤ stock_mínimo`.
- Botón **"Nuevo insumo"** (solo Admin) con validación de SKU único. Acciones: Editar y Deshabilitar (nunca eliminar).
- Cardex con trazabilidad histórica: Fecha, tipo, entrada/salida, saldo y PMP posterior al movimiento.
- Solicitudes con pestañas (Pendientes, Aprobadas, Rechazadas, Todas), bloqueo si no hay stock suficiente, línea de tiempo, aprobación por Admin y motivo de rechazo obligatorio.

### 3. Compras y Terceros
- Órdenes de compra: Borrador, Enviada, Recibida parcial, Recibida, Cerrada, Anulada; marca para las generadas automáticamente por stock mínimo; modal de calificación de proveedores con estrellas (1 a 5) en Tiempo, Calidad y Precio al cerrar.
- Facturas de compra con descuentos en cascada (hasta 3 descuentos consecutivos), IVA (19%) y recálculo en vivo de PMP.
- Recepción conforme con checklist por línea; lo defectuoso se deriva a cuarentena.
- Proveedores y Clientes con validación de RUT chileno (módulo 11), detección de duplicados y datos bancarios.

### 4. Proyectos
- Lista con semáforo de costo:
  - 🟢 **Verde:** `< 80%` del presupuesto
  - 🟡 **Amarillo:** `80% a 100%`
  - 🔴 **Rojo:** `> 100%` (Sobregiro)
- Detalle con pestañas: Resumen y margen, Técnicos asignados (sin duplicados), Insumos y egresos, Horas hombre, y Rentabilidad liquidada (habilitada cuando el proyecto está cerrado).
- Modal de cierre con validación de bloqueos (solicitudes pendientes o devoluciones en tránsito).

### 5. Devoluciones y Herramientas
- Técnico: Formulario de devolución de sobrante ($Q_{\text{máx}} = Q_{\text{retirado}} - Q_{\text{usado}}$) con seguimiento `En tránsito` $\rightarrow$ `Recibida`.
- Bodeguero: Confirmación física de cantidad real devuelta (alerta si difiere de lo declarado) y devolución de insumos defectuosos a proveedor con N° de guía.
- Herramientas: Catálogo con estado (`disponible`, `asignada`, `en_mantencion`, `dada_de_baja`), alerta resaltada de próxima mantención vencida, préstamo a técnico, devolución con estado Bueno (`disponible`) o Dañado (`en_mantencion`), historial de préstamos y registro de mantenciones.
