import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Clock, ShieldAlert } from "lucide-react";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "./AuthContext";

interface SessionTimeoutValue {
  resetTimer: () => void;
  simulateTimeoutWarning: () => void;
}

const SessionTimeoutContext = createContext<SessionTimeoutValue | null>(null);

// 30 minutos en milisegundos = 30 * 60 * 1000 = 1,800,000 ms
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
// Aviso preventivo: se muestra 2 minutos antes (a los 28 min)
const WARNING_BEFORE_MS = 2 * 60 * 1000;

export function SessionTimeoutProvider({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [warningOpen, setWarningOpen] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(120);

  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Reiniciar actividad ante interacción del usuario
  const resetTimer = () => {
    lastActivityRef.current = Date.now();
    if (warningOpen) {
      setWarningOpen(false);
    }
  };

  // Simular para pruebas inmediatas
  const simulateTimeoutWarning = () => {
    setCountdownSeconds(30);
    setWarningOpen(true);
  };

  // Escuchar eventos de interacción solo si hay usuario logueado
  useEffect(() => {
    if (!user) {
      setWarningOpen(false);
      return;
    }

    const onUserAction = () => {
      // Si no está el modal abierto, actualiza el timestamp
      if (!warningOpen) {
        lastActivityRef.current = Date.now();
      }
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((ev) => window.addEventListener(ev, onUserAction, { passive: true }));

    // Chequeo periódico cada 5 segundos
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const timeRemaining = INACTIVITY_LIMIT_MS - elapsed;

      if (timeRemaining <= 0) {
        // Expiró completamente
        setWarningOpen(false);
        signOut();
        sessionStorage.setItem("fyag.session_expired", "true");
      } else if (timeRemaining <= WARNING_BEFORE_MS && !warningOpen) {
        // Mostrar aviso preventivo
        setCountdownSeconds(Math.ceil(timeRemaining / 1000));
        setWarningOpen(true);
      }
    }, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onUserAction));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, warningOpen, signOut]);

  // Manejo de la cuenta regresiva visible dentro del modal
  useEffect(() => {
    if (!warningOpen) {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    countdownIntervalRef.current = window.setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          setWarningOpen(false);
          signOut();
          sessionStorage.setItem("fyag.session_expired", "true");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [warningOpen, signOut]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <SessionTimeoutContext.Provider value={{ resetTimer, simulateTimeoutWarning }}>
      {children}

      {/* Modal de aviso por expiración de sesión (30 min de inactividad, web) */}
      <Modal
        open={warningOpen}
        onClose={resetTimer}
        title="Sesión a punto de expirar"
        description="Aviso de inactividad por seguridad"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setWarningOpen(false);
                signOut();
              }}
            >
              Cerrar sesión ahora
            </Button>
            <Button variant="primary" onClick={resetTimer}>
              Mantener sesión activa
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-xl bg-warn-soft p-3 text-warn">
            <ShieldAlert size={22} className="shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-body-sm">
              <p className="font-bold">Inactividad detectada</p>
              <p className="text-xs mt-0.5">
                Por política de seguridad de FYAG, las sesiones web se cierran tras 30 minutos sin interacción.
              </p>
            </div>
          </div>

          <div className="text-center py-2">
            <p className="text-xs text-ink-500 uppercase tracking-wider font-semibold">
              Tu sesión se cerrará en
            </p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <Clock size={24} className="text-warn animate-pulse" aria-hidden="true" />
              <span className="font-mono text-3xl font-bold tabular-nums text-ink-900" aria-live="assertive">
                {formatCountdown(countdownSeconds)}
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </SessionTimeoutContext.Provider>
  );
}

export function useSessionTimeout() {
  const ctx = useContext(SessionTimeoutContext);
  if (!ctx) throw new Error("useSessionTimeout debe usarse dentro de <SessionTimeoutProvider>");
  return ctx;
}
