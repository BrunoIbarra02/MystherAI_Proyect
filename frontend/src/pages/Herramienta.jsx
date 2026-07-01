import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, CheckCircle, AlertCircle } from "lucide-react";
import { useApiKey } from "../context/ApiKeyContext";
import { useTheme } from "../context/ThemeContext";
import AppNavbar from "../components/AppNavbar";
import api from "../utils/api";

/**
 * Herramienta de Texturizado IA — Requiere API Key de WaveSpeed.
 * Modal rediseñado con paleta del logo y soporte dark/light.
 */
const Herramienta = () => {
  const navigate = useNavigate();
  const { apiKey, setApiKey } = useApiKey();
  const { theme } = useTheme();
  const [tempKey, setTempKey] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);

  const handleSaveKey = async (e) => {
    e.preventDefault();
    setError("");

    const key = tempKey.trim();
    if (!key || key.length < 10) {
      setError("La API Key debe tener al menos 10 caracteres.");
      return;
    }

    setChecking(true);
    try {
      const res = await api.post("/tool/validate-key/", { api_key: key });
      if (res.data && res.data.valid) {
        setApiKey(key);
        setError("");
      } else {
        setError("La API Key no es válida para WaveSpeed.");
      }
    } catch (err) {
      setError("Error al validar la API Key con WaveSpeed.");
    } finally {
      setChecking(false);
    }
  };

  const showModal = !apiKey;
  // Estilos calculados según el tema activo
  const s = getStyles(theme);

  return (
    <div style={s.root}>
      {/* Navbar global con botón de tema */}
      <AppNavbar
        backTo="/dashboard"
        backLabel="Dashboard"
        rightSlot={
          apiKey && (
            <div style={s.keyBadge}>
              <CheckCircle size={14} color="var(--color-success)" />
              <span>API Key activa</span>
            </div>
          )
        }
      />

      {/* Área de la herramienta */}
      <div style={s.toolArea}>
        {/* Launcher de WaveSpeed (abre en nueva pestaña con la key cargada) */}
        {apiKey && (
          <div style={s.launchArea}>
            <div style={s.launchCard}>
              <div style={s.launchIcon}>🌊</div>
              <h2 style={s.launchTitle}>WaveSpeed Pro</h2>
              <p style={s.launchSubtitle}>
                La herramienta se abre en una nueva pestaña con tu API Key cargada automáticamente.
              </p>
              <button
                className="neon-button"
                style={{ padding: "14px 32px", fontSize: "15px" }}
                onClick={() =>
                  window.open(
                    `http://mysther-ai-alb-1734290767.eu-central-1.elb.amazonaws.com:7860/?api_key=${encodeURIComponent(apiKey)}`,
                    "_blank"
                  )
                }
              >
                Abrir herramienta WaveSpeed →
              </button>
              <p style={s.launchHint}>
                Se abrirá en una nueva pestaña con tu sesión activa.
              </p>
            </div>
          </div>
        )}

        {/* Modal de API Key */}
        {showModal && (
          <div style={s.modalOverlay}>
            <div style={s.modalCard}>
              {/* Encabezado del modal */}
              <div style={s.modalHeader}>
                <div style={s.keyIconWrapper}>
                  <KeyRound size={28} color="var(--silver-mid)" />
                </div>
                <div>
                  <h2 style={s.modalTitle}>WaveSpeed API Key</h2>
                  <p style={s.modalSubtitle}>
                    Introduce tu clave privada para acceder a la herramienta.
                    Se validará con WaveSpeed antes de cargar.
                  </p>
                </div>
              </div>

              {/* Formulario */}
              <form onSubmit={handleSaveKey}>
                <div style={s.inputWrapper}>
                  <KeyRound size={15} color="var(--silver-dim)" style={s.inputIcon} />
                  <input
                    type={keyVisible ? "text" : "password"}
                    placeholder="ws_xxxxxxxxxxxxxxxxxxxxxxxx"
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    style={s.keyInput}
                    onFocus={(e) => Object.assign(e.target.style, s.keyInputFocus)}
                    onBlur={(e) => Object.assign(e.target.style, s.keyInputBlur)}
                    autoFocus
                    autoComplete="off"
                  />
                  {/* Toggle visibilidad */}
                  <button
                    type="button"
                    onClick={() => setKeyVisible(!keyVisible)}
                    style={s.eyeBtn}
                    tabIndex={-1}
                    aria-label={keyVisible ? "Ocultar clave" : "Mostrar clave"}
                  >
                    {keyVisible ? "🙈" : "👁️"}
                  </button>
                </div>

                {/* Error */}
                {error && (
                  <div style={s.errorBox}>
                    <AlertCircle size={14} color="#f87171" />
                    {error}
                  </div>
                )}

                {/* Botón */}
                <button
                  type="submit"
                  className="neon-button"
                  disabled={checking}
                  style={{ width: "100%", justifyContent: "center", padding: "13px" }}
                >
                  {checking ? (
                    <span style={s.loadingRow}>
                      <span style={s.spinner} />
                      Validando...
                    </span>
                  ) : (
                    "Validar y continuar"
                  )}
                </button>
              </form>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================
   ESTILOS DINÁMICOS — cambian según el tema (dark / light)
   ============================================================ */
const getStyles = (theme) => {
  const isDark = theme === "dark";
  return {
    root: {
      minHeight: "100vh",
      background: isDark ? "var(--bg-dark)" : "#f0f0f0",
      color: "var(--text-primary)",
      fontFamily: "var(--font-body)",
      transition: "background 0.4s ease",
    },
    toolArea: {
      width: "100%",
      height: "calc(100vh - 64px)",
      marginTop: "64px",
      position: "relative",
    },
    launchArea: {
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: isDark ? "var(--bg-dark)" : "#f0f0f0",
    },
    launchCard: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
      padding: "48px",
      background: isDark ? "rgba(20,20,20,0.9)" : "rgba(255,255,255,0.9)",
      border: isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(0,0,0,0.08)",
      borderRadius: "24px",
      boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.6)" : "0 24px 64px rgba(0,0,0,0.08)",
      maxWidth: "440px",
      textAlign: "center",
    },
    launchIcon: {
      fontSize: "52px",
      lineHeight: 1,
    },
    launchTitle: {
      fontSize: "1.5rem",
      fontWeight: "700",
      margin: 0,
      fontFamily: "var(--font-display)",
      color: isDark ? "#f0f0f0" : "#111",
    },
    launchSubtitle: {
      fontSize: "0.88rem",
      color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
      margin: 0,
      lineHeight: 1.6,
    },
    launchHint: {
      fontSize: "11px",
      color: isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.35)",
      margin: 0,
    },
    keyBadge: {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "12px",
      color: "var(--color-success)",
      background: "rgba(74,222,128,0.06)",
      border: "1px solid rgba(74,222,128,0.15)",
      borderRadius: "20px",
      padding: "5px 12px",
    },
    /* Modal overlay */
    modalOverlay: {
      position: "absolute",
      inset: 0,
      background: isDark ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.35)",
      backdropFilter: "blur(12px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 50,
      padding: "20px",
    },
    /* Tarjeta del modal */
    modalCard: {
      background: isDark ? "rgba(10,10,10,0.95)" : "rgba(255,255,255,0.97)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      border: isDark
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.10)",
      borderRadius: "20px",
      padding: "36px",
      width: "100%",
      maxWidth: "420px",
      boxShadow: isDark
        ? "0 32px 80px rgba(0,0,0,0.9)"
        : "0 32px 80px rgba(0,0,0,0.12)",
      animation: "modalSlideIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275)",
      transition: "background 0.4s ease, border-color 0.4s ease",
    },
    modalHeader: {
      display: "flex",
      alignItems: "flex-start",
      gap: "16px",
      marginBottom: "24px",
    },
    keyIconWrapper: {
      flexShrink: 0,
      padding: "12px",
      background: isDark ? "rgba(192,192,192,0.06)" : "rgba(0,0,0,0.05)",
      borderRadius: "12px",
      border: isDark
        ? "1px solid rgba(192,192,192,0.12)"
        : "1px solid rgba(0,0,0,0.10)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    modalTitle: {
      fontSize: "1.2rem",
      fontWeight: "700",
      color: isDark ? "#f0f0f0" : "#111111",
      margin: "0 0 6px",
      fontFamily: "var(--font-display)",
      transition: "color 0.3s ease",
    },
    modalSubtitle: {
      fontSize: "0.83rem",
      color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.5)",
      margin: 0,
      lineHeight: "1.5",
      transition: "color 0.3s ease",
    },
    inputWrapper: {
      position: "relative",
      marginBottom: "12px",
    },
    inputIcon: {
      position: "absolute",
      left: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      pointerEvents: "none",
    },
    keyInput: {
      width: "100%",
      padding: "12px 44px 12px 36px",
      borderRadius: "10px",
      border: isDark
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(0,0,0,0.12)",
      background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
      color: isDark ? "#f0f0f0" : "#111111",
      fontSize: "13px",
      fontFamily: "var(--font-body)",
      outline: "none",
      boxSizing: "border-box",
      transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
    },
    keyInputFocus: {
      borderColor: isDark ? "rgba(192,192,192,0.35)" : "rgba(0,0,0,0.28)",
      boxShadow: isDark
        ? "0 0 0 3px rgba(192,192,192,0.07)"
        : "0 0 0 3px rgba(0,0,0,0.05)",
      background: isDark ? "rgba(255,255,255,0.05)" : "#fafafa",
    },
    keyInputBlur: {
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)",
      boxShadow: "none",
      background: isDark ? "rgba(255,255,255,0.03)" : "#ffffff",
    },
    eyeBtn: {
      position: "absolute",
      right: "10px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: "14px",
      padding: "4px",
    },
    errorBox: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "rgba(248,113,113,0.07)",
      border: "1px solid rgba(248,113,113,0.18)",
      borderRadius: "8px",
      padding: "10px 12px",
      color: "#fca5a5",
      fontSize: "12px",
      marginBottom: "12px",
    },
    loadingRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    },
    spinner: {
      display: "inline-block",
      width: "15px",
      height: "15px",
      border: isDark ? "2px solid rgba(0,0,0,0.3)" : "2px solid rgba(255,255,255,0.3)",
      borderTop: isDark ? "2px solid #000" : "2px solid #fff",
      borderRadius: "50%",
      animation: "spin 0.75s linear infinite",
    },
    hint: {
      textAlign: "center",
      color: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.45)",
      fontSize: "12px",
      marginTop: "20px",
      marginBottom: 0,
      transition: "color 0.3s ease",
    },
  };
};

export default Herramienta;
