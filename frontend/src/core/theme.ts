/**
 * FYAG MULTISYSTEM - SISTEMA DE DISEÑO MINIMALISTA (PASO 1)
 *
 * Fuente única de verdad para tokens de diseño:
 * - Paleta minimalista: Azul sobrio, neutros claros y semánticos suaves con WCAG AA.
 * - Tipografía: Escala definida (12, 14, 16, 20, 24, 32) con pesos 400, 500 y 600.
 * - Espaciados en múltiplos de 4 u 8 px.
 * - Radios suaves (8 a 12 px) y bordes finos con sombras ultra sutiles.
 */

export const theme = {
  colors: {
    // 1. Primario Azul Sobrio
    primary: "#0284c7",       // Sky 600 principal
    primaryDark: "#0369a1",   // Sky 700 para contraste sobre fondo claro (>4.5:1)
    primaryDeep: "#0c4a6e",   // Sky 900
    primaryLight: "#e0f2fe",  // Sky 100 para fondos suaves
    primaryBorder: "#bae6fd", // Sky 200

    // 2. Neutros Grises Claros (Canvas, Tarjetas, Bordes y Texto)
    background: "#f8fafc",    // Casi blanco (Slate 50)
    card: "#ffffff",          // Blanco puro para tarjetas
    surface: "#ffffff",       // Blanco de superficie
    surfaceAlt: "#f1f5f9",    // Slate 100 sutil
    border: "#e2e8f0",        // Slate 200 fino (1px)
    borderLight: "#f1f5f9",   // Slate 100 ultraligero
    borderDark: "#cbd5e1",    // Slate 300
    borderFocus: "#0284c7",   // Foco accesible

    // Tipografía con contraste AA > 4.5:1
    text: "#0f172a",          // Slate 900 (Contraste 16:1)
    textSecondary: "#334155", // Slate 700 (Contraste 8.5:1)
    textMuted: "#64748b",     // Slate 500 (Contraste 4.6:1)
    textLight: "#94a3b8",     // Slate 400 (Placeholder / Deshabilitado)
    textInverse: "#ffffff",   // Blanco sobre fondos oscuros

    // 3. Estados Semánticos Suaves (Color + Texto)
    // Verde (Éxito): Aprobada, Conforme, Activo, Recibida, Entregada, Resuelta, Disponible
    ok: "#15803d",            // Green 700
    okDark: "#166534",        // Green 800
    okLight: "#dcfce7",       // Green 100 suave
    okBorder: "#bbf7d0",      // Green 200 fino

    // Ámbar (Advertencia): Pendiente, Recibida parcial, En mantención, Pendiente resolución
    warn: "#b45309",          // Amber 700
    warnDark: "#92400e",      // Amber 800
    warnLight: "#fef3c7",     // Amber 100 suave
    warnBorder: "#fde68a",    // Amber 200 fino

    // Rojo (Peligro): Rechazada, Defectuoso, Vencido, Faltante
    danger: "#b91c1c",        // Red 700
    dangerDark: "#991b1b",    // Red 800
    dangerLight: "#fee2e2",   // Red 100 suave
    dangerBorder: "#fecaca",  // Red 200 fino

    // Azul (En tránsito)
    transit: "#1d4ed8",       // Blue 700
    transitDark: "#1e40af",   // Blue 800
    transitLight: "#dbeafe",  // Blue 100 suave
    transitBorder: "#bfdbfe", // Blue 200 fino

    // Celeste (Planificado, Asignada)
    celeste: "#0284c7",       // Sky 600
    celesteDark: "#0369a1",   // Sky 700
    celesteLight: "#e0f2fe",  // Sky 100 suave
    celesteBorder: "#bae6fd", // Sky 200 fino

    // Gris (Cerrado, Anulada, Borrador, Dada de baja)
    mute: "#475569",          // Slate 600
    muteDark: "#334155",      // Slate 700
    muteLight: "#f1f5f9",     // Slate 100 suave
    muteBorder: "#e2e8f0",    // Slate 200 fino

    // Información
    info: "#0284c7",
    infoDark: "#0369a1",
    infoLight: "#e0f2fe",
    infoBorder: "#bae6fd",
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

  // Escala tipográfica definida: 12, 14, 16, 20, 24, 32
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

  // Pesos tipográficos estandarizados: 400, 500 y 600
  fontWeight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "600" as const, // Máximo peso 600 para estética limpia
  },

  fontFamily: {
    sans: "System",
  },

  // Tipografías preconfiguradas
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: "600" as const,
      lineHeight: 38,
      color: "#0f172a",
    },
    h2: {
      fontSize: 24,
      fontWeight: "600" as const,
      lineHeight: 30,
      color: "#0f172a",
    },
    h3: {
      fontSize: 20,
      fontWeight: "600" as const,
      lineHeight: 26,
      color: "#0f172a",
    },
    body: {
      fontSize: 16,
      fontWeight: "400" as const,
      lineHeight: 24,
      color: "#0f172a",
    },
    bodyBold: {
      fontSize: 16,
      fontWeight: "600" as const,
      lineHeight: 24,
      color: "#0f172a",
    },
    callout: {
      fontSize: 14,
      fontWeight: "500" as const,
      lineHeight: 20,
      color: "#334155",
    },
    caption: {
      fontSize: 12,
      fontWeight: "400" as const,
      lineHeight: 16,
      color: "#64748b",
    },
    label: {
      fontSize: 12,
      fontWeight: "600" as const,
      lineHeight: 16,
      color: "#0f172a",
    },
    overline: {
      fontSize: 11,
      fontWeight: "600" as const,
      lineHeight: 14,
      letterSpacing: 0.5,
      textTransform: "uppercase" as const,
      color: "#64748b",
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
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.03,
      shadowRadius: 2,
      elevation: 1,
    },
    sm: {
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
    },
    lg: {
      shadowColor: "#0f172a",
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
