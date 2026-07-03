import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useUser } from '../context/UserContext';
import logoImg from '../assets/logo.jpeg';

const AppNavbar = ({ backTo, backLabel = 'Dashboard', rightSlot }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useUser();
  const onProfile = location.pathname === '/profile';

  return (
    <nav className="app-navbar">
      {/* Logo */}
      <div
        className="navbar-logo"
        onClick={() => navigate('/dashboard')}
        style={{ cursor: 'pointer' }}
        title="Ir al Dashboard"
      >
        <img src={logoImg} alt="MystherAI" className="navbar-logo-img" />
        <span className="navbar-logo-text">MystherAI</span>
      </div>

      <div className="navbar-spacer" />

      {rightSlot}

      {/* Profile chip — hidden on /profile page itself */}
      {user && !onProfile && (
        <button
          onClick={() => navigate('/profile')}
          title="Ver perfil"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '6px 14px 6px 6px',
            borderRadius: '24px',
            background: 'rgba(192,192,192,0.07)',
            border: '1px solid rgba(192,192,192,0.14)',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '13px', fontWeight: '600',
            cursor: 'pointer', letterSpacing: '0.3px',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(192,192,192,0.13)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(192,192,192,0.07)'}
        >
          {/* Avatar circle */}
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            overflow: 'hidden', flexShrink: 0,
            background: 'linear-gradient(135deg,#3a3a3a,#777)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: '800', color: '#fff',
            border: '1.5px solid rgba(255,255,255,0.15)',
          }}>
            {user.avatar
              ? <img src={user.avatar} alt={user.display_name}
                     style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (user.display_name || 'U').slice(0, 2).toUpperCase()
            }
          </div>
          {user.display_name}
        </button>
      )}

      {/* Back button */}
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
