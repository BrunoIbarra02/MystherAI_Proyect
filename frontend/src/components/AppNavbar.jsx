import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import logoImg from '../assets/logo.jpeg';

/**
 * AppNavbar — Barra de navegación global de MystherAI.
 * Incluye el logo, botón de cambio de tema (dark/light) y un botón de retroceso opcional.
 *
 * Props:
 *  - backTo     {string}     Ruta a la que navegará el botón de retroceso (opcional).
 *  - backLabel  {string}     Etiqueta del botón de retroceso. Por defecto: 'Dashboard'.
 *  - rightSlot  {ReactNode}  Contenido adicional que se coloca a la derecha del spacer.
 */
const AppNavbar = ({ backTo, backLabel = 'Dashboard', rightSlot }) => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useUser();
  const onProfile  = location.pathname === '/profile';

  return (
    <nav className="app-navbar">
      {/* Logo + nombre — clic para ir al dashboard */}
      <div
        className="navbar-logo"
        onClick={() => navigate('/dashboard')}
        style={{ cursor: 'pointer' }}
        title="Ir al Dashboard"
      >
        <img src={logoImg} alt="MystherAI" className="navbar-logo-img" />
        <span className="navbar-logo-text">MystherAI</span>
      </div>

      {/* Spacer flexible */}
      <div className="navbar-spacer" />

      {/* Slot para contenido personalizado por cada página */}
      {rightSlot}

      {/* Usuario logueado — ocultar en la propia página de perfil */}
      {user && !onProfile && (
        <button
          onClick={() => navigate('/profile')}
          title="Ver perfil"
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '7px 14px', borderRadius: '20px',
            background: 'rgba(192,192,192,0.07)',
            border: '1px solid rgba(192,192,192,0.14)',
            color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: '600',
            cursor: 'pointer', letterSpacing: '0.3px',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,192,192,0.13)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(192,192,192,0.07)'}
        >
          <User size={13} strokeWidth={2.2} />
          {user.display_name}
        </button>
      )}

      {/* Botón de cambio de tema */}
      <button
        id="theme-toggle-btn"
        className="theme-toggle-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Cambiar a modo claro ☀️' : 'Cambiar a modo oscuro 🌙'}
        aria-label="Alternar tema"
      >
        {/* Contenedor deslizante con icono activo */}
        <span className="theme-toggle-track">
          <span className="theme-toggle-thumb">
            {theme === 'dark'
              ? <Moon size={13} strokeWidth={2.2} />
              : <Sun  size={13} strokeWidth={2.2} />
            }
          </span>
        </span>
        <span className="theme-toggle-label">
          {theme === 'dark' ? 'Dark' : 'Light'}
        </span>
      </button>

      {/* Botón de retroceso (solo si se proporciona backTo) */}
      {backTo && (
        <button
          className="navbar-back-btn"
          onClick={() => navigate(backTo)}
        >
          <ArrowLeft size={15} />
          {backLabel}
        </button>
      )}
    </nav>
  );
};

export default AppNavbar;
