import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff } from 'lucide-react';
import logoImg from '../assets/logo.jpeg';
import api from '../utils/api';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

/**
 * Página de Login — Diseño rediseñado con paleta del logo (negro/plata).
 * Soporta modo dark y light mediante ThemeContext.
 * Incluye: logo animado, glassmorphism, mostrar/ocultar contraseña y partículas de fondo.
 */
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { setUser } = useUser();

  // Animación de entrada al montar
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login/', { email: username, password });
      if (response.status === 200) {
        setUser(response.data.user);
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Correo o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  // Estilos calculados según el tema activo
  const s = getStyles(theme);

  return (
    <div style={s.page}>
      {/* Fondo de orbs decorativos */}
      <div style={s.bgOrb1} />
      <div style={s.bgOrb2} />
      <div style={s.bgOrb3} />

      {/* Tarjeta de login */}
      <div style={{
        ...s.card,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
        transition: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}>

        {/* Encabezado con logo */}
        <div style={s.header}>
          <div style={s.logoWrapper}>
            <img
              src={logoImg}
              alt="MystherAI Logo"
              style={s.logoImg}
            />
            {/* Anillo animado alrededor del logo */}
            <div style={s.logoRing} />
          </div>

          <h1 style={s.title}>
            Mysther<span style={s.titleAccent}>AI</span>
          </h1>
          <p style={s.subtitle}>Sistema de Gestión de Contenidos</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} style={s.form}>
          {/* Campo de correo */}
          <div style={s.fieldGroup}>
            <label style={s.label}>Correo Electrónico</label>
            <div style={s.inputWrapper}>
              <Mail size={16} color="var(--silver-dim)" style={s.inputIcon} />
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={s.input}
                onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                onBlur={(e) => Object.assign(e.target.style, s.inputBlur)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Campo de contraseña */}
          <div style={s.fieldGroup}>
            <label style={s.label}>Contraseña</label>
            <div style={s.inputWrapper}>
              <Lock size={16} color="var(--silver-dim)" style={s.inputIcon} />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...s.input, paddingRight: '44px' }}
                onFocus={(e) => Object.assign(e.target.style, s.inputFocus)}
                onBlur={(e) => Object.assign(e.target.style, s.inputBlur)}
                required
                autoComplete="current-password"
              />
              {/* Botón mostrar/ocultar contraseña */}
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={s.eyeBtn}
                tabIndex={-1}
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPass
                  ? <EyeOff size={16} color="var(--silver-dim)" />
                  : <Eye size={16} color="var(--silver-dim)" />
                }
              </button>
            </div>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div style={s.errorBox}>
              <span style={s.errorDot}>●</span>
              {error}
            </div>
          )}

          {/* Botón de envío */}
          <button
            type="submit"
            id="login-submit-btn"
            disabled={loading}
            style={{
              ...s.submitBtn,
              opacity: loading ? 0.7 : 1,
              transform: loading ? 'scale(0.98)' : 'scale(1)',
            }}
            onMouseEnter={(e) => !loading && Object.assign(e.target.style, s.submitBtnHover)}
            onMouseLeave={(e) => !loading && Object.assign(e.target.style, s.submitBtnBase)}
          >
            {loading ? (
              <span style={s.loadingRow}>
                <span style={s.spinner} />
                Verificando...
              </span>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        {/* Pie de página */}
        <p style={s.footer}>
          © {new Date().getFullYear()} MystherAI — Acceso restringido
        </p>
      </div>
    </div>
  );
};

/* ============================================================
   ESTILOS DINÁMICOS — cambian según el tema (dark / light)
   ============================================================ */
const getStyles = (theme) => {
  const isDark = theme === 'dark';

  return {
    page: {
      minHeight: '100vh',
      background: isDark ? '#000000' : '#f0f0f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      position: 'relative',
      overflow: 'hidden',
      padding: '20px',
      transition: 'background 0.4s ease',
    },

    /* Orbs decorativos de fondo */
    bgOrb1: {
      position: 'absolute',
      top: '-15%',
      left: '-10%',
      width: '500px',
      height: '500px',
      borderRadius: '50%',
      background: isDark
        ? 'radial-gradient(circle, rgba(192,192,192,0.04) 0%, transparent 70%)'
        : 'radial-gradient(circle, rgba(0,0,0,0.04) 0%, transparent 70%)',
      pointerEvents: 'none',
    },
    bgOrb2: {
      position: 'absolute',
      bottom: '-20%',
      right: '-10%',
      width: '600px',
      height: '600px',
      borderRadius: '50%',
      background: isDark
        ? 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)'
        : 'radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)',
      pointerEvents: 'none',
    },
    bgOrb3: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '800px',
      height: '800px',
      borderRadius: '50%',
      background: isDark
        ? 'radial-gradient(circle, rgba(100,100,100,0.02) 0%, transparent 60%)'
        : 'radial-gradient(circle, rgba(0,0,0,0.02) 0%, transparent 60%)',
      pointerEvents: 'none',
    },

    /* Tarjeta principal */
    card: {
      position: 'relative',
      zIndex: 1,
      background: isDark ? 'rgba(10,10,10,0.85)' : 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: isDark
        ? '1px solid rgba(255,255,255,0.08)'
        : '1px solid rgba(0,0,0,0.08)',
      borderRadius: '24px',
      padding: '44px 40px',
      width: '100%',
      maxWidth: '420px',
      boxShadow: isDark
        ? '0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)'
        : '0 24px 80px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
      transition: 'background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease',
    },

    header: {
      textAlign: 'center',
      marginBottom: '36px',
    },

    /* Contenedor del logo con anillo animado */
    logoWrapper: {
      position: 'relative',
      display: 'inline-block',
      marginBottom: '20px',
    },

    logoImg: {
      width: '80px',
      height: '80px',
      borderRadius: '18px',
      objectFit: 'cover',
      border: '1px solid rgba(192,192,192,0.2)',
      display: 'block',
      boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.8)' : '0 8px 32px rgba(0,0,0,0.12)',
      animation: 'logoFloat 4s ease-in-out infinite',
    },

    /* Anillo de luz alrededor del logo */
    logoRing: {
      position: 'absolute',
      inset: '-6px',
      borderRadius: '22px',
      border: isDark
        ? '1px solid rgba(192,192,192,0.12)'
        : '1px solid rgba(0,0,0,0.10)',
      animation: 'silverPulse 3s ease-in-out infinite',
      pointerEvents: 'none',
    },

    title: {
      fontSize: '26px',
      fontWeight: '800',
      color: isDark ? '#f0f0f0' : '#111111',
      margin: '0 0 6px',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      letterSpacing: '1px',
      transition: 'color 0.3s ease',
    },
    titleAccent: {
      background: 'linear-gradient(135deg, #888, #fff, #aaa)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    subtitle: {
      color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
      fontSize: '13px',
      margin: 0,
      letterSpacing: '0.5px',
      transition: 'color 0.3s ease',
    },

    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
    },

    fieldGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '7px',
    },

    label: {
      fontSize: '12px',
      fontWeight: '600',
      color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)',
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
    },

    inputWrapper: {
      position: 'relative',
    },

    inputIcon: {
      position: 'absolute',
      left: '14px',
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
    },

    input: {
      width: '100%',
      padding: '13px 14px 13px 40px',
      borderRadius: '10px',
      border: isDark
        ? '1px solid rgba(255,255,255,0.08)'
        : '1px solid rgba(0,0,0,0.10)',
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
      color: isDark ? '#f0f0f0' : '#111111',
      fontSize: '14px',
      fontFamily: "'Inter', system-ui, sans-serif",
      outline: 'none',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    },

    /* Se aplican con onFocus / onBlur */
    inputFocus: {
      borderColor: isDark ? 'rgba(192,192,192,0.35)' : 'rgba(0,0,0,0.25)',
      boxShadow: isDark
        ? '0 0 0 3px rgba(192,192,192,0.07)'
        : '0 0 0 3px rgba(0,0,0,0.06)',
      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    },
    inputBlur: {
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)',
      boxShadow: 'none',
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
    },

    eyeBtn: {
      position: 'absolute',
      right: '12px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: '4px',
      display: 'flex',
      alignItems: 'center',
    },

    errorBox: {
      background: 'rgba(248,113,113,0.08)',
      border: '1px solid rgba(248,113,113,0.2)',
      borderRadius: '8px',
      padding: '10px 14px',
      color: '#fca5a5',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    errorDot: {
      fontSize: '8px',
      color: '#f87171',
    },

    submitBtn: {
      width: '100%',
      padding: '14px',
      borderRadius: '10px',
      background: 'linear-gradient(135deg, #666, #c0c0c0)',
      color: '#000',
      fontWeight: '700',
      fontSize: '15px',
      fontFamily: "'Inter', system-ui, sans-serif",
      border: 'none',
      cursor: 'pointer',
      letterSpacing: '0.3px',
      transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
      marginTop: '6px',
    },
    submitBtnBase: {
      transform: 'scale(1)',
      boxShadow: 'none',
      background: 'linear-gradient(135deg, #666, #c0c0c0)',
    },
    submitBtnHover: {
      transform: 'translateY(-2px) scale(1)',
      boxShadow: '0 8px 24px rgba(192,192,192,0.2)',
      background: 'linear-gradient(135deg, #888, #e8e8e8)',
    },

    loadingRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
    },

    spinner: {
      display: 'inline-block',
      width: '16px',
      height: '16px',
      border: '2px solid rgba(0,0,0,0.3)',
      borderTop: '2px solid #000',
      borderRadius: '50%',
      animation: 'spin 0.75s linear infinite',
    },

    footer: {
      textAlign: 'center',
      color: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)',
      fontSize: '11px',
      marginTop: '28px',
      marginBottom: 0,
      letterSpacing: '0.3px',
      transition: 'color 0.3s ease',
    },
  };
};

export default Login;