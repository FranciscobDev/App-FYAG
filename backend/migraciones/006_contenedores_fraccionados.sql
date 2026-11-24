-- =============================================================================
-- 006 · Contenedores fraccionables (rollos, bobinas) con remanente en 3 decimales
-- Idempotente. Se aplica automáticamente al iniciar el backend.
-- =============================================================================
CREATE TABLE IF NOT EXISTS contenedor_stock (
    id_contenedor SERIAL PRIMARY KEY,
    id_articulo INT NOT NULL REFERENCES insumos(id_insumo),
    capacidad_inicial NUMERIC(12,3) NOT NULL CHECK (capacidad_inicial > 0),
    cantidad_restante NUMERIC(12,3) NOT NULL CHECK (cantidad_restante >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE
);
