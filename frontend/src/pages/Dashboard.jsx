import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiKey } from '../context/ApiKeyContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { clearApiKey } = useApiKey();

  return (
    <div className="dashboard-container">
      <h1 className="neon-title">Centro de Operaciones</h1>
      
      <div className="cards-wrapper">
        <div className="op-card glass-panel" onClick={() => navigate('/censo')}>
          <div className="card-icon">📁</div>
          <h2>Censo</h2>
          <p>Explorar el dataset de videos originales, metadatos de cámara y especies.</p>
        </div>

        <div className="op-card glass-panel" onClick={() => navigate('/registro')}>
          <div className="card-icon">⚡</div>
          <h2>Registro Mateo</h2>
          <p>Control de versiones finales, prompts de IA y parámetros de estilizado.</p>
        </div>

        <div className="op-card glass-panel" onClick={() => navigate('/herramienta')}>
          <div className="card-icon">🛠️</div>
          <h2>Herramienta IA</h2>
          <p>Acceso directo al motor WaveSpeed para texturización y edición avanzada.</p>
        </div>

        <div className="op-card glass-panel" onClick={() => navigate('/resumen')}>
          <div className="card-icon">📊</div>
          <h2>Resumen</h2>
          <p>Análisis del censo de videos, distribución por especie, mapas y aspectos técnicos.</p>
        </div>

        <div className="op-card glass-panel" onClick={() => navigate('/estadisticas')} style={{ borderTop: '2px solid #bc13fe' }}>
          <div className="card-icon">🎨</div>
          <h2>Estadísticas</h2>
          <p>Balance del dataset de Fase 2: Anime, Cartoon, Lego y Ciberpunk — análisis de estilizado.</p>
        </div>
      </div>

      <div style={{textAlign: 'center'}}>
        <button className="logout-btn" onClick={() => { clearApiKey(); navigate('/'); }}>
          CERRAR SESIÓN
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
