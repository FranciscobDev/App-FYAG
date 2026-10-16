import { Platform } from "react-native";

/**
 * FYAG MULTISYSTEM - PALETA INDUSTRIAL AMBER & DARK TITANIUM
 *
 * Fuente única de verdad para tokens de diseño:
 * - Paleta Industrial de Alta Precisión: Ámbar Industrial 600 (#d97706), Titanio/Carbón (#1c1917) y Blanco Hueso (#fafaf9).
 * - Cero azules y morados genéricos: Estética técnica de faena, maquinaria e ingeniería de precisión.
 * - Tipografía de Alta Legibilidad: Escala (11, 12, 14, 16, 20, 24, 32) con pesos 400, 500, 600 y 700.
 * - Espaciados en múltiplos de 4 y 8 px.
 * - Radios suaves (8 a 12 px) y bordes finos de 1px con sombras ultra sutiles.
 */

export const theme = {
  colors: {
    // 1. Primario: Ámbar Industrial (Visibilidad, precisión y energía de obra)
    primary: "#d97706",       // Amber 600 principal
    primaryDark: "#b45309",   // Amber 700 para contraste sobre fondo claro (>4.5:1)
    primaryDeep: "#78350f",   // Amber 900
    primaryLight: "#fef3c7",  // Amber 100 para fondos suaves de badges y alertas
    primaryBorder: "#fde68a", // Amber 200 para bordes de acento
    accent: "#f59e0b",        // Amber 500 vivo para cronómetros e indicadores activos

    // 2. Neutros: Stone / Titanio y Blanco Hueso Técnico (Sin brillo clínico azulado)
    background: "#fafaf9",    // Stone 50 (Blanco Hueso cálido técnico)
    card: "#ffffff",          // Blanco puro para tarjetas
    surface: "#ffffff",       // Blanco de superficie
    surfaceAlt: "#f5f5f4",    // Stone 100 suave
    border: "#e7e5e4",        // Stone 200 fino (1px)
    borderLight: "#f5f5f4",   // Stone 100 ultraligero
    borderDark: "#d6d3d1",    // Stone 300
    borderFocus: "#d97706",   // Foco accesible ámbar industrial

    // Tipografía con contraste AA > 4.5:1
    text: "#1c1917",          // Stone 900 (Carbón cálido profundo, contraste 16.5:1)
    textSecondary: "#44403c", // Stone 700 (Contraste 8.5:1)
    textMuted: "#78716c",     // Stone 500 (Contraste 4.6:1)
    textLight: "#a8a29e",     // Stone 400 (Placeholder / Deshabilitado)
    textInverse: "#ffffff",   // Blanco sobre fondos oscuros

    // 3. Estados Semánticos Armonizados (Sin azules ni morados)
    // Verde (Éxito): Aprobada, Conforme, Activo, Recibida, Entregada, Resuelta, Disponible
    ok: "#15803d",            // Green 700
    okDark: "#166534",        // Green 800
    okLight: "#dcfce7",       // Green 100 suave
    okBorder: "#bbf7d0",      // Green 200 fino

    // Ámbar Dorado (Advertencia): Pendiente, Recibida parcial, En mantención, Pendiente resolución
    warn: "#b45309",          // Amber 700
    warnDark: "#92400e",      // Amber 800
    warnLight: "#fef3c7",     // Amber 100 suave
    warnBorder: "#fde68a",    // Amber 200 fino

    // Rojo Carmesí (Peligro): Rechazada, Defectuoso, Vencido, Faltante
    danger: "#b91c1c",        // Red 700
    dangerDark: "#991b1b",    // Red 800
    dangerLight: "#fee2e2",   // Red 100 suave
    dangerBorder: "#fecaca",  // Red 200 fino

    // Carbón Titanio (En tránsito / Movimiento de insumos)
    transit: "#292524",       // Stone 800
    transitDark: "#1c1917",   // Stone 900
    transitLight: "#f5f5f4",  // Stone 100 suave
    transitBorder: "#e7e5e4", // Stone 200 fino

    // Planificado / Asignada: Ámbar Industrial Cálido
    celeste: "#d97706",       // Amber 600
    celesteDark: "#b45309",   // Amber 700
    celesteLight: "#fef3c7",  // Amber 100 suave
    celesteBorder: "#fde68a", // Amber 200 fino

    // Gris Mineral (Cerrado, Anulada, Borrador, Dada de baja)
    mute: "#57534e",          // Stone 600
    muteDark: "#44403c",      // Stone 700
    muteLight: "#f5f5f4",     // Stone 100 suave
    muteBorder: "#e7e5e4",    // Stone 200 fino

    // Información / KPIs / Rentabilidad
    info: "#b45309",          // Amber 700
    infoDark: "#78350f",      // Amber 900
    infoLight: "#fef3c7",     // Amber 100 suave
    infoBorder: "#fde68a",    // Amber 200 fino
  },

  // Espaciado consistente en múltiplos de 4 y 8 px
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    huge: 32,
  },

  // Radios suaves (8 a 12 px)
  radius: {
    xs: 4,
    sm: 6,
    md: 8,      // 8px suave (predeterminado para inputs/chips)
    lg: 10,     // 10px suave (tarjetas pequeñas)
    xl: 12,     // 12px suave (tarjetas principales y modales)
    full: 9999, // Pastillas (Pills)
  },

  // Escala tipográfica definida: 11, 12, 14, 16, 20, 24, 32
  fontSize: {
    caption: 11, // micro-etiqueta para subíndices
    xs: 12,     // 12px (etiquetas y badges)
    sm: 14,     // 14px (texto secundario y botones compactos)
    base: 16,   // 16px (cuerpo de texto principal)
    md: 16,     // 16px (alias retrocompatible)
    lg: 20,     // 20px (subtítulos y números clave)
    xl: 24,     // 24px (títulos de sección)
    xxl: 32,    // 32px (título principal)
  },

  // Pesos tipográficos estandarizados: 400, 500, 600 y 700
  fontWeight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },

  fontFamily: {
    sans: Platform.select({
      ios: "System",
      android: "Roboto",
      web: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      default: "System",
    }),
    heading: Platform.select({
      ios: "System",
      android: "Roboto",
      web: "'Space Grotesk', 'Inter', -apple-system, sans-serif",
      default: "System",
    }),
    mono: Platform.select({
      ios: "Courier",
      android: "monospace",
      web: "'JetBrains Mono', 'Fira Code', monospace",
      default: "monospace",
    }),
  },

  // Tipografías preconfiguradas
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: "700" as const,
      lineHeight: 38,
      color: "#1c1917",
    },
    h2: {
      fontSize: 24,
      fontWeight: "600" as const,
      lineHeight: 30,
      color: "#1c1917",
    },
    h3: {
      fontSize: 20,
      fontWeight: "600" as const,
      lineHeight: 26,
      color: "#1c1917",
    },
    body: {
      fontSize: 16,
      fontWeight: "400" as const,
      lineHeight: 24,
      color: "#1c1917",
    },
    bodyBold: {
      fontSize: 16,
      fontWeight: "600" as const,
      lineHeight: 24,
      color: "#1c1917",
    },
    callout: {
      fontSize: 14,
      fontWeight: "500" as const,
      lineHeight: 20,
      color: "#44403c",
    },
    caption: {
      fontSize: 12,
      fontWeight: "400" as const,
      lineHeight: 16,
      color: "#78716c",
    },
    label: {
      fontSize: 12,
      fontWeight: "600" as const,
      lineHeight: 16,
      color: "#1c1917",
    },
    overline: {
      fontSize: 11,
      fontWeight: "600" as const,
      lineHeight: 14,
      letterSpacing: 0.5,
      textTransform: "uppercase" as const,
      color: "#78716c",
    },
  },

  // Sombras ultra sutiles y bordes limpios
  shadows: {
    none: {
      shadowColor: "transparent",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    subtle: {
      shadowColor: "#1c1917",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: "#1c1917",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: "#1c1917",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
    },
    lg: {
      shadowColor: "#1c1917",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 3,
    },
  },

  // Bordes finos
  borders: {
    thin: 1,
    focus: 2,
  },

  // Tamaños táctiles mínimos para botones (Mínimo 44 px en tablet y celular)
  touchTargets: {
    minHeight: 44, // Accesibilidad WCAG AA
    tabletHeight: 48,
    largeHeight: 52,
  },

  // Microinteracciones y transiciones breves (Paso 7: 150 a 250 ms)
  transitions: {
    fast: 150,     // 150 ms para hover y micro-feedback
    normal: 200,   // 200 ms para tabs, modales y drawers
    slow: 250,     // 250 ms para transiciones de pantalla completa
  },
};

export type Tone =
  | "ok"
  | "warn"
  | "danger"
  | "transit"
  | "celeste"
  | "mute"
  | "info"
  | "primary";
