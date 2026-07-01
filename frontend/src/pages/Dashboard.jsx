import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiKey } from '../context/ApiKeyContext';
import AppNavbar from '../components/AppNavbar';
import logoImg from '../assets/logo.jpeg';

/* Gradio official logo (stacked blocks, orange-yellow gradient) */
const GradioLogo = () => (
  <svg viewBox="0 0 200 160" width="52" height="42" aria-label="Gradio" style={{ display: 'block', margin: '0 auto' }}>
    <defs>
      <linearGradient id="gr-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF7C00" />
        <stop offset="100%" stopColor="#FFD21E" />
      </linearGradient>
    </defs>
    <rect x="5"  y="115" width="190" height="38" rx="13" fill="url(#gr-grad)" />
    <rect x="25" y="68"  width="150" height="36" rx="11" fill="url(#gr-grad)" opacity="0.88" />
    <rect x="52" y="24"  width="96"  height="34" rx="10" fill="url(#gr-grad)" opacity="0.76" />
  </svg>
);

const Dashboard = () => {
  const navigate    = useNavigate();
  const { clearApiKey } = useApiKey();

  const handleLogout = () => {
    clearApiKey();
    navigate('/');
  };

  const topCards = [
    {
      id:    'card-censo',
      ruta:  '/censo',
      icon:  '📁',
      titulo: 'Censo',
      desc:  'Explora el dataset de videos originales con metadatos de cámara, mapas, género y especie.',
      tag:   'Dataset',
    },
    {
      id:    'card-registro',
      ruta:  '/registro',
      icon:  '⚡',
      titulo: 'Registro Grabaciones',
      desc:  'Control de versiones finales, prompts de IA y parámetros de estilizado por miembro.',
      tag:   'Pipeline',
    },
  ];

  const bottomCards = [
    {
      id:    'card-resumen',
      ruta:  '/resumen',
      icon:  '📊',
      titulo: 'Resumen',
      desc:  'Análisis del censo: distribución por especie, mapas y aspectos técnicos.',
      tag:   'Analytics',
    },
    {
      id:    'card-estadisticas',
      ruta:  '/estadisticas',
      icon:  '🎨',
      titulo: 'Estadísticas',
      desc:  'Balance del dataset Fase 2: Anime, Cartoon, Lego y Ciberpunk.',
      tag:   'Analytics',
    },
    {
      id:    'card-herramienta',
      ruta:  '/herramienta',
      icon:  <GradioLogo />,
      titulo: 'Servidor Gradio',
      desc:  'Motor WaveSpeed para texturización y edición de video con IA.',
      tag:   'Herramienta',
      accent: true,
    },
  ];

  const renderCard = (card, idx, delay = 0) => (
    <div
      key={card.id}
      id={card.id}
      className={`op-card glass-panel animate-in${card.accent ? ' op-card--gradio' : ''}`}
      onClick={() => navigate(card.ruta)}
      style={{ animationDelay: `${(idx + delay) * 0.07}s` }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(card.ruta)}
    >
      <span className="card-tag">{card.tag}</span>
      <span className="card-icon">{card.icon}</span>
      <h2>{card.titulo}</h2>
      <p>{card.desc}</p>
      <span className="card-arrow">→</span>
    </div>
  );

  return (
    <>
      <AppNavbar />

      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="dashboard-logo-wrapper">
            <img
              src={logoImg}
              alt="MystherAI Logo"
              className="dashboard-logo"
              title="¡Hover para ver caminar al conejo!"
            />
          </div>
          <h1 className="neon-title">Centro de Operaciones</h1>
          <p className="page-subtitle">Selecciona un módulo para continuar</p>
        </div>

        {/* Top row — 2 large cards */}
        <div className="cards-wrapper cards-wrapper--top">
          {topCards.map((card, idx) => renderCard(card, idx))}
        </div>

        {/* Bottom row — 3 compact cards */}
        <div className="cards-wrapper cards-wrapper--bottom">
          {bottomCards.map((card, idx) => renderCard(card, idx, topCards.length))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button id="logout-btn" className="logout-btn" onClick={handleLogout}>
            Cerrar Sesión
          </button>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
