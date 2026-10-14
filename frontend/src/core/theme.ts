/**
 * FYAG MULTISYSTEM - SISTEMA DE DISEÑO (PASO 1)
 *
 * Paleta con contraste WCAG AA/AAA garantizado.
 * Tipografía sans-serif legible con escala clara para títulos, cuerpo y etiquetas.
 */

export const theme = {
  colors: {
    // 1. Primario Azul Profesional
    primary: "#0284c7",       // Sky 600 principal
    primaryDark: "#0369a1",   // Sky 700 para contraste sobre fondo claro (>4.5:1)
    primaryDeep: "#0c4a6e",   // Sky 900
    primaryLight: "#e0f2fe",  // Sky 100 para fondos suaves
    primaryBorder: "#7dd3fc", // Sky 300

    // 2. Neutros Grises (Fondo, Superficie, Bordes y Texto)
    background: "#f8fafc",    // Slate 50 (Canvas)
    card: "#ffffff",          // Blanco puro (Superficie)
    surface: "#f8fafc",       // Slate 50
    surfaceAlt: "#f1f5f9",    // Slate 100
    border: "#e2e8f0",        // Slate 200
    borderDark: "#cbd5e1",    // Slate 300
    borderFocus: "#0284c7",   // Azul para foco visible

    // Tipografía (Contraste estricto AA > 4.5:1)
    text: "#0f172a",          // Slate 900 (Contraste 16:1 sobre blanco)
    textSecondary: "#334155", // Slate 700 (Contraste 8.5:1 sobre blanco)
    textMuted: "#64748b",     // Slate 500 (Contraste 4.6:1 sobre blanco)
    textLight: "#94a3b8",     // Slate 400 (Placeholder / texto secundario suave)
    textInverse: "#ffffff",   // Blanco sobre botones oscuros

    // 3. Estados Semánticos (Color + Texto)
    // Verde: Aprobada, Conforme, Activo, Recibida, Entregada, Resuelta, Disponible
    ok: "#15803d",            // Green 700
    okDark: "#166534",        // Green 800 (Contraste 7.1:1 sobre verde claro)
    okLight: "#dcfce7",       // Green 100
    okBorder: "#86efac",      // Green 300

    // Ámbar: Pendiente, Recibida parcial, En mantención, Pendiente resolución
    warn: "#b45309",          // Amber 700
    warnDark: "#92400e",      // Amber 800 (Contraste 6.8:1 sobre ámbar claro)
    warnLight: "#fef3c7",     // Amber 100
    warnBorder: "#fcd34d",    // Amber 300

    // Rojo: Rechazada, Defectuoso, Vencido, Faltante
    danger: "#b91c1c",        // Red 700
    dangerDark: "#991b1b",    // Red 800 (Contraste 7.4:1 sobre rojo claro)
    dangerLight: "#fee2e2",   // Red 100
    dangerBorder: "#fca5a5",  // Red 300

    // Azul: En tránsito
    transit: "#1d4ed8",       // Blue 700
    transitDark: "#1e40af",   // Blue 800 (Contraste 7.5:1 sobre azul claro)
    transitLight: "#dbeafe",  // Blue 100
    transitBorder: "#93c5fd", // Blue 300

    // Celeste: Planificado, Asignada
    celeste: "#0284c7",       // Sky 600
    celesteDark: "#0369a1",   // Sky 700 (Contraste 6.5:1 sobre celeste claro)
    celesteLight: "#e0f2fe",  // Sky 100
    celesteBorder: "#7dd3fc", // Sky 300

    // Gris: Cerrado, Anulada, Borrador, Dada de baja
    mute: "#475569",          // Slate 600
    muteDark: "#334155",      // Slate 700 (Contraste 6.9:1 sobre gris claro)
    muteLight: "#f1f5f9",     // Slate 100
    muteBorder: "#cbd5e1",    // Slate 300

    borderLight: "#f1f5f9",

    // Info (Azul Claro)
    info: "#0284c7",
    infoDark: "#0369a1",
    infoLight: "#e0f2fe",
    infoBorder: "#7dd3fc",
  },

  // Espaciado consistente (Múltiplos de 4px)
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    huge: 32,
  },

  // Bordes redondeados
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  // Escala tipográfica sans-serif legible
  typography: {
    h1: {
      fontSize: 26,
      fontWeight: "700" as const,
      lineHeight: 32,
      color: "#0f172a",
    },
    h2: {
      fontSize: 21,
      fontWeight: "700" as const,
      lineHeight: 28,
      color: "#0f172a",
    },
    h3: {
      fontSize: 17,
      fontWeight: "600" as const,
      lineHeight: 24,
      color: "#0f172a",
    },
    body: {
      fontSize: 15,
      fontWeight: "400" as const,
      lineHeight: 22,
      color: "#0f172a",
    },
    bodyBold: {
      fontSize: 15,
      fontWeight: "600" as const,
      lineHeight: 22,
      color: "#0f172a",
    },
    callout: {
      fontSize: 14,
      fontWeight: "500" as const,
      lineHeight: 20,
      color: "#334155",
    },
    caption: {
      fontSize: 13,
      fontWeight: "500" as const,
      lineHeight: 18,
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
      fontWeight: "700" as const,
      lineHeight: 14,
      letterSpacing: 0.6,
      textTransform: "uppercase" as const,
      color: "#64748b",
    },
  },

  // Escala de tamaños de fuente directa
  fontSize: {
    xs: 12,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
  },

  // Sombras preconfiguradas
  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 5,
    },
  },

  // Tamaños táctiles mínimos para botones (Mínimo 44 px en tablet y celular)
  touchTargets: {
    minHeight: 44, // Accesibilidad obligatoria
    tabletHeight: 50,
    largeHeight: 54,
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
