/**
 * Categorías permitidas para artículos del inventario.
 * Deben coincidir con el enum `categoria_enum` de la base de datos (backend).
 */
export const CATEGORIAS_ARTICULO = [
  "Herramientas",
  "Materiales",
  "Equipos",
  "Consumibles",
  "Seguridad",
] as const;

export type CategoriaArticulo = (typeof CATEGORIAS_ARTICULO)[number];

export const CATEGORIA_POR_DEFECTO: CategoriaArticulo = "Herramientas";
