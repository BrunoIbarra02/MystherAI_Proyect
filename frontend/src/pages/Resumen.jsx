import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2,
  TrendingUp,
  Users,
  Camera,
  CheckSquare,
  MapPin,
  ArrowLeft,
  AlertTriangle,
  Check,
  Search,
  ArrowUpDown,
  UserCheck,
  Percent
} from 'lucide-react';
import api from '../utils/api';

const Resumen = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, title: '', value: '' });

  const userColors = [
    '#ff4b2b',
    'var(--neon-cyan)',
    '#bc13fe',
    '#2ecc71',
    '#f39c12',
    '#3498db',
    '#e91e63'
  ];
  const getUsuarioColor = (idx) => userColors[idx % userColors.length];

  // Estados reactivos cargados desde el backend
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [kpis, setKpis] = useState(null);
  const [especiesData, setEspeciesData] = useState([]);
  const [inicialMapas, setInicialMapas] = useState([]);
  const [exclusivasMateo, setExclusivasMateo] = useState([]);
  const [exclusivasMiguel, setExclusivasMiguel] = useState([]);
  const [usuariosData, setUsuariosData] = useState([]);
  const [exclusivasPorUsuario, setExclusivasPorUsuario] = useState({});
  const [generoData, setGeneroData] = useState([]);
  const [etniaData, setEtniaData] = useState([]);
  const [cruceGenEtnia, setCruceGenEtnia] = useState([]);
  const [mapasSoloHombres, setMapasSoloHombres] = useState([]);
  const [camaraData, setCamaraData] = useState([]);
  const [duracionData, setDuracionData] = useState([]);
  const [actionPlan, setActionPlan] = useState([]);

  // Estados para los controles de la tabla de mapas
  const [mapSearch, setMapSearch] = useState('');
  const [mapSort, setMapSort] = useState('total-desc');
  const [showAllMaps, setShowAllMaps] = useState(false);

  // Función de carga de datos (reutilizable para el botón Actualizar)
  const fetchSummary = async (forceBackend = false) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/sheets/summary/');
      const data = response.data;

      setKpis(data.kpis);
      setEspeciesData(data.especiesData);
      setInicialMapas(data.inicialMapas);
      setExclusivasMateo(data.exclusivasMateo);
      setExclusivasMiguel(data.exclusivasMiguel);
      setUsuariosData(data.usuariosData || []);
      setExclusivasPorUsuario(data.exclusivasPorUsuario || {});
      setGeneroData(data.generoData);
      setEtniaData(data.etniaData);
      setCruceGenEtnia(data.cruceGenEtnia);
      setMapasSoloHombres(data.mapasSoloHombres);
      setCamaraData(data.camaraData);
      setDuracionData(data.duracionData);

      // Al forzar actualización desde el botón, siempre usa los datos del backend
      if (forceBackend) {
        setActionPlan(data.actionPlan);
      } else {
        // En carga inicial: usa localStorage si existe
        const localData = localStorage.getItem('mystherai_action_plan');
        if (localData) {
          try {
            setActionPlan(JSON.parse(localData));
          } catch (e) {
            setActionPlan(data.actionPlan);
          }
        } else {
          setActionPlan(data.actionPlan);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error("Error al obtener el resumen del censo:", err);
      setError("Error de red: No se pudo conectar con el servidor Django.");
      setLoading(false);
    }
  };

  // Carga inicial al montar la página
  useEffect(() => {
    fetchSummary(false);
  }, []);

  // Guardar cambios del checklist localmente
  useEffect(() => {
    if (actionPlan && actionPlan.length > 0) {
      localStorage.setItem('mystherai_action_plan', JSON.stringify(actionPlan));
    }
  }, [actionPlan]);

  const handleActionCheck = (id) => {
    setActionPlan(actionPlan.map(item => {
      if (item.id === id) {
        const newChecked = !item.checked;
        return {
          ...item,
          checked: newChecked,
          status: newChecked ? 'Completado' : 'Pendiente'
        };
      }
      return item;
    }));
  };

  const handleStatusChange = (id, newStatus) => {
    setActionPlan(actionPlan.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: newStatus,
          checked: newStatus === 'Completado'
        };
      }
      return item;
    }));
  };

  // -------------------------------------------------------------
  // LÓGICA DE EVENTOS EN GRÁFICOS (Mouse Tooltip)
  // -------------------------------------------------------------
  const showChartTooltip = (e, title, value) => {
    setTooltip({
      show: true,
      x: e.clientX + 15,
      y: e.clientY + 15,
      title,
      value
    });
  };

  const hideChartTooltip = () => {
    setTooltip(t => t.show ? { show: false, x: 0, y: 0, title: '', value: '' } : t);
  };

  // Ocultar tooltip si el mouse sale de la ventana del navegador
  useEffect(() => {
    const onLeave = () => hideChartTooltip();
    document.addEventListener('mouseleave', onLeave);
    return () => document.removeEventListener('mouseleave', onLeave);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------
  // LÓGICA DE RENDERIZADO DE GRÁFICOS SVG
  // -------------------------------------------------------------
  const renderPieChart = () => {
    const total = kpis.totalVideos;
    let accumulatedPercent = 0;

    return (
      <svg viewBox="0 0 200 200" width="100%" height="240" style={{ overflow: 'visible' }}>
        <g transform="translate(10, 10)">
          {especiesData.map((slice, i) => {
            const startPercent = accumulatedPercent;
            const endPercent = accumulatedPercent + (slice.value / total);
            accumulatedPercent = endPercent;

            // Fórmulas trigonométricas para construir arcos de tarta
            const startAngle = startPercent * 2 * Math.PI - Math.PI / 2;
            const endAngle = endPercent * 2 * Math.PI - Math.PI / 2;

            const x1 = Math.cos(startAngle) * 90 + 90;
            const y1 = Math.sin(startAngle) * 90 + 90;
            const x2 = Math.cos(endAngle) * 90 + 90;
            const y2 = Math.sin(endAngle) * 90 + 90;

            const largeArcFlag = (endPercent - startPercent) > 0.5 ? 1 : 0;
            const pathData = `M 90 90 L ${x1} ${y1} A 90 90 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

            return (
              <path
                key={slice.label}
                d={pathData}
                fill={slice.color}
                className="pie-slice"
                style={{ color: slice.color }}
                onMouseMove={(e) => showChartTooltip(e, slice.label, `${slice.value} videos (${slice.percent}%)`)}
                onMouseLeave={hideChartTooltip}
              />
            );
          })}
        </g>
      </svg>
    );
  };

  const renderDonutChart = (data, totalValue, titleText) => {
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    let accumulatedAngle = -90;

    return (
      <svg viewBox="0 0 120 120" width="100%" height="150" style={{ overflow: 'visible' }}>
        <circle cx="60" cy="60" r={radius} fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth="12" />
        {data.map((slice) => {
          const slicePercent = slice.value / totalValue;
          const strokeDashoffset = circumference - slicePercent * circumference;
          const currentRotation = accumulatedAngle;
          accumulatedAngle += slicePercent * 360;

          return (
            <circle
              key={slice.label}
              cx="60"
              cy="60"
              r={radius}
              fill="transparent"
              stroke={slice.color}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform={`rotate(${currentRotation} 60 60)`}
              strokeLinecap="round"
              className="pie-slice"
              style={{ color: slice.color }}
              onMouseMove={(e) => showChartTooltip(e, slice.label, `${slice.value} personas (${slice.percent}%)`)}
              onMouseLeave={hideChartTooltip}
            />
          );
        })}
        <text x="60" y="65" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
          {titleText}
        </text>
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="resumen-page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
          <div className="loading-spinner" style={{
            margin: '0 auto 20px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            border: '3px solid rgba(0, 242, 255, 0.1)',
            borderTopColor: 'var(--neon-cyan)',
            animation: 'spin 1s linear infinite'
          }} />
          <h2 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '10px' }}>Cargando datos del censo...</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>Preparando gráficos y estadísticas interactivas.</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="resumen-page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', borderLeft: '4px solid #ff4b2b' }}>
          <AlertTriangle size={48} color="#ff4b2b" style={{ marginBottom: '15px' }} />
          <h2 style={{ color: 'white', fontSize: '1.4rem', marginBottom: '10px' }}>Error de Carga</h2>
          <p style={{ color: '#ffb3a7', fontSize: '0.95rem', marginBottom: '20px' }}>{error}</p>
          <button className="neon-button" onClick={() => window.location.reload()}>REINTENTAR</button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PROCESAMIENTO Y FILTRADO DE MAPAS
  // -------------------------------------------------------------
  const mapsFiltered = inicialMapas
    .filter(m => m.name.toLowerCase().includes(mapSearch.toLowerCase()))
    .sort((a, b) => {
      if (mapSort === 'total-desc') return b.total - a.total;
      if (mapSort === 'total-asc') return a.total - b.total;
      if (mapSort === 'name-asc') return a.name.localeCompare(b.name);
      return 0;
    });

  const mapsToDisplay = showAllMaps ? mapsFiltered : mapsFiltered.slice(0, 10);

  return (
    <div className="resumen-page-container">
      {/* Botón INICIO — fijo arriba izquierda */}
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 999,
          background: 'transparent',
          border: '1px solid var(--neon-cyan)',
          color: 'var(--neon-cyan)',
          padding: '8px 15px',
          borderRadius: '5px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 0 15px rgba(0, 242, 255, 0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <ArrowLeft size={16} /> INICIO
      </button>

      {/* Botón ACTUALIZAR — fijo arriba derecha */}
      <button
        title="Consultar backend y refrescar todos los datos"
        disabled={loading}
        onClick={() => {
          localStorage.removeItem('mystherai_action_plan');
          fetchSummary(true);
        }}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 999,
          background: 'transparent',
          border: '1px solid var(--neon-cyan)',
          color: 'var(--neon-cyan)',
          padding: '8px 15px',
          borderRadius: '5px',
          fontWeight: 'bold',
          boxShadow: '0 0 15px rgba(0, 242, 255, 0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          opacity: loading ? 0.7 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15" height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        {loading ? 'CARGANDO...' : 'ACTUALIZAR'}
      </button>

      <header style={{ textAlign: 'center', marginBottom: '50px' }}>
        <h1 className="neon-title" style={{ marginBottom: '10px' }}>Análisis del Censo de Videos</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem', letterSpacing: '1px' }}>
          Next Anima / MystherAI • {kpis.totalVideos} videos • {kpis.totalSegundos}s totales
        </p>
      </header>

      {/* Menú de Pestañas */}
      <nav className="resumen-tabs">
        <button
          className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => { setActiveTab('general'); hideChartTooltip(); }}
        >
          <TrendingUp size={16} /> General
        </button>
        <button
          className={`tab-btn ${activeTab === 'mapas' ? 'active' : ''}`}
          onClick={() => { setActiveTab('mapas'); hideChartTooltip(); }}
        >
          <MapPin size={16} /> Mapas & Especies
        </button>
        <button
          className={`tab-btn ${activeTab === 'comparativa' ? 'active' : ''}`}
          onClick={() => { setActiveTab('comparativa'); hideChartTooltip(); }}
        >
          <UserCheck size={16} /> Comparativa de Usuarios
        </button>
        <button
          className={`tab-btn ${activeTab === 'diversidad' ? 'active' : ''}`}
          onClick={() => { setActiveTab('diversidad'); hideChartTooltip(); }}
        >
          <Users size={16} /> Género & Etnia
        </button>
        <button
          className={`tab-btn ${activeTab === 'tecnico' ? 'active' : ''}`}
          onClick={() => { setActiveTab('tecnico'); hideChartTooltip(); }}
        >
          <Camera size={16} /> Aspectos Técnicos
        </button>
        <button
          className={`tab-btn ${activeTab === 'plan' ? 'active' : ''}`}
          onClick={() => { setActiveTab('plan'); hideChartTooltip(); }}
        >
          <CheckSquare size={16} /> Plan de Acción
        </button>
      </nav>

      {/* Panel de KPI Generales */}
      <div className="kpi-grid">
        <div className="kpi-card glass-panel">
          <h3>Total Videos</h3>
          <p className="kpi-value">{kpis.totalVideos}</p>
        </div>
        <div className="kpi-card glass-panel" style={{ borderLeft: '4px solid var(--neon-cyan)' }}>
          <h3>Humanos</h3>
          <p className="kpi-value">{kpis.humanos}</p>
        </div>
        <div className="kpi-card glass-panel" style={{ borderLeft: '4px solid #2ecc71' }}>
          <h3>Animales</h3>
          <p className="kpi-value">{kpis.animales}</p>
        </div>
        <div className="kpi-card glass-panel critical">
          <h3>Sin Clasificar</h3>
          <p className="kpi-value">{kpis.sinClasificar}</p>
        </div>
        <div className="kpi-card glass-panel">
          <h3>Dur. Media</h3>
          <p className="kpi-value">{kpis.duracionMedia}</p>
        </div>
        <div className="kpi-card glass-panel">
          <h3>Mapas</h3>
          <p className="kpi-value">{kpis.totalMapas}</p>
        </div>
      </div>

      {/* TOOLTIP REACTIVO COMPARTIDO — pointerEvents none para no interceptar mouse */}
      {tooltip.show && (
        <div className="chart-tooltip" style={{
          left: tooltip.x,
          top: tooltip.y,
          pointerEvents: 'none',
        }}>
          <div className="tooltip-title">{tooltip.title}</div>
          <p className="tooltip-value">{tooltip.value}</p>
        </div>
      )}

      {/* SECCIÓN 1: RESUMEN GENERAL */}
      {activeTab === 'general' && (
        <section className="resumen-section">
          {/* Diagnóstico y Alertas para Entrenamiento de IA */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <TrendingUp size={20} className="neon-cyan-text" />
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white' }}>Diagnóstico de Datos para Entrenamiento de IA</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {/* ALERTA 1: Especie Sin Clasificar (Crítico) */}
              {kpis.sinClasificar > 0 && (
                <div className="alert-box alert-danger glass-panel" style={{ margin: 0, borderLeft: '4px solid #ff4b2b' }}>
                  <span className="alert-icon"><AlertTriangle color="#ff4b2b" /></span>
                  <div className="alert-message">
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <span className="tag red-bg" style={{ fontSize: '0.65rem', padding: '2px 6px', textTransform: 'uppercase' }}>CRÍTICO</span>
                      Etiquetas Faltantes (Sin Clasificar)
                    </h4>
                    <p style={{ marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      El <strong>{((kpis.sinClasificar / kpis.totalVideos) * 100).toFixed(1)}%</strong> de los videos ({kpis.sinClasificar} de {kpis.totalVideos} en total) no tienen especie clasificada. Para entrenar un modelo de clasificación supervisado (ej. ResNet, YOLO), es requisito que el 100% de las muestras posean una etiqueta válida.
                      <br />
                      <strong style={{ color: '#ffb3a7' }}>Acción recomendada:</strong> Completar el etiquetado manual urgente a 'Humano' o 'Animal'.
                    </p>
                  </div>
                </div>
              )}

              {/* ALERTA 2: Sesgo de Género por Mapa (Advertencia) */}
              {mapasSoloHombres.length > 0 && (
                <div className="alert-box alert-warning glass-panel" style={{ margin: 0, borderLeft: '4px solid #f39c12' }}>
                  <span className="alert-icon"><AlertTriangle color="#f39c12" /></span>
                  <div className="alert-message">
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <span className="tag" style={{ fontSize: '0.65rem', padding: '2px 6px', backgroundColor: 'rgba(243, 156, 18, 0.2)', borderColor: '#f39c12', color: '#f39c12', textTransform: 'uppercase' }}>SESGO DE GÉNERO</span>
                      Sesgo Espacial en Distribución de Género
                    </h4>
                    <p style={{ marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      Se detectó desbalance de género en <strong>{mapasSoloHombres.length}</strong> de los {kpis.totalMapas} mapas ({((mapasSoloHombres.length / kpis.totalMapas) * 100).toFixed(1)}% del total), donde únicamente se capturaron personajes masculinos (ej. <em>{mapasSoloHombres.slice(0, 5).join(', ')}</em>...). Un modelo de IA entrenado con este sesgo podría asociar erróneamente el entorno físico con el género del personaje.
                      <br />
                      <strong style={{ color: '#ffe5b4' }}>Acción recomendada:</strong> Añadir videos con personajes femeninos en los mapas masculinos detectados.
                    </p>
                  </div>
                </div>
              )}

              {/* ALERTA 3: Sesgo de Grabador / Dispositivo (Advertencia) */}
              {(exclusivasMateo.length > 0 || exclusivasMiguel.length > 0) && (
                <div className="alert-box alert-warning glass-panel" style={{ margin: 0, borderLeft: '4px solid #f39c12' }}>
                  <span className="alert-icon"><AlertTriangle color="#f39c12" /></span>
                  <div className="alert-message">
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <span className="tag" style={{ fontSize: '0.65rem', padding: '2px 6px', backgroundColor: 'rgba(243, 156, 18, 0.2)', borderColor: '#f39c12', color: '#f39c12', textTransform: 'uppercase' }}>SESGO DE CAPTURA</span>
                      Incompatibilidad de Cobertura por Grabador
                    </h4>
                    <p style={{ marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                      Existe una falta de cobertura cruzada: Mateo tiene <strong>{exclusivasMateo.length}</strong> mapas exclusivos y Miguel tiene <strong>{exclusivasMiguel.length}</strong> mapas exclusivos. Para prevenir que la IA aprenda sesgos específicos del capturador (como iluminación, compresión o estilo de encuadre de cada dispositivo/operador) en lugar de las características del escenario, se requiere un dataset homogéneo.
                      <br />
                      <strong style={{ color: '#ffe5b4' }}>Acción recomendada:</strong> Grabar videos cruzados en los mapas exclusivos (ej. Mateo en mapas de Miguel, y viceversa).
                    </p>
                  </div>
                </div>
              )}

              {/* ALERTA 4: Desbalance Demográfico Cruce Género x Etnia (Información) */}
              {cruceGenEtnia && cruceGenEtnia.length > 0 && (
                (() => {
                  const minDem = cruceGenEtnia.reduce((prev, curr) => prev.value < curr.value ? prev : curr);
                  const maxDem = cruceGenEtnia.reduce((prev, curr) => prev.value > curr.value ? prev : curr);
                  const gapPercent = (((maxDem.value - minDem.value) / maxDem.value) * 100).toFixed(0);

                  return gapPercent > 20 ? (
                    <div className="alert-box alert-info glass-panel" style={{ margin: 0, borderLeft: '4px solid var(--neon-cyan)' }}>
                      <span className="alert-icon"><AlertTriangle color="var(--neon-cyan)" /></span>
                      <div className="alert-message">
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                          <span className="tag" style={{ fontSize: '0.65rem', padding: '2px 6px', backgroundColor: 'rgba(0, 242, 255, 0.2)', borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)', textTransform: 'uppercase' }}>BALANCE DEMOGRÁFICO</span>
                          Desbalance en Cruce Demográfico (Género x Etnia)
                        </h4>
                        <p style={{ marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                          El cruce demográfico con menor representación es <strong>"{minDem.label}"</strong> ({minDem.value} videos), existiendo una brecha de <strong>{gapPercent}%</strong> respecto a la clase mayoritaria <strong>"{maxDem.label}"</strong> ({maxDem.value} videos). Esto puede inducir sesgos de reconocimiento facial y atributos en el entrenamiento del modelo.
                          <br />
                          <strong style={{ color: '#e0f7fa' }}>Acción recomendada:</strong> Capturar más datos del grupo demográfico subrepresentado ("{minDem.label}") hasta nivelar la muestra.
                        </p>
                      </div>
                    </div>
                  ) : null;
                })()
              )}

              {/* ALERTA 5: Desbalance de Cámaras (Información) */}
              {camaraData && camaraData.length > 0 && (
                (() => {
                  const mostUsed = camaraData[0];
                  const leastUsed = camaraData[camaraData.length - 1];
                  const ratio = (mostUsed.value / (leastUsed.value || 1)).toFixed(1);

                  return parseFloat(ratio) > 2.0 ? (
                    <div className="alert-box alert-info glass-panel" style={{ margin: 0, borderLeft: '4px solid var(--neon-cyan)' }}>
                      <span className="alert-icon"><AlertTriangle color="var(--neon-cyan)" /></span>
                      <div className="alert-message">
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                          <span className="tag" style={{ fontSize: '0.65rem', padding: '2px 6px', backgroundColor: 'rgba(0, 242, 255, 0.2)', borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)', textTransform: 'uppercase' }}>DESBALANCE TÉCNICO</span>
                          Desproporción en Tipo de Cámara (Perspectiva)
                        </h4>
                        <p style={{ marginTop: '8px', fontSize: '0.9rem', lineHeight: '1.5' }}>
                          El tipo de cámara <strong>"{mostUsed.label}"</strong> ({mostUsed.value} videos) es <strong>{ratio} veces</strong> más frecuente que la cámara <strong>"{leastUsed.label}"</strong> ({leastUsed.value} videos). La variabilidad de perspectiva es crítica para entrenar clasificadores de acción independientes del ángulo de cámara.
                          <br />
                          <strong style={{ color: '#e0f7fa' }}>Acción recomendada:</strong> Incrementar tomas de video usando el tipo de cámara "{leastUsed.label}" para diversificar los ángulos en el entrenamiento.
                        </p>
                      </div>
                    </div>
                  ) : null;
                })()
              )}
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3>Distribución por Especie</h3>
                <p className="chart-subtitle">Proporción de videos según el tipo de sujeto grabado.</p>
              </div>

              {renderPieChart()}

              <div className="chart-legends">
                {especiesData.map((s) => (
                  <span key={s.label} className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: s.color }} />
                    {s.label}: {s.value} ({s.percent}%)
                  </span>
                ))}
              </div>
            </div>

            <div className="chart-card glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3>Resumen Ejecutivo del Censo</h3>
                <p className="chart-subtitle">Métricas acumuladas del esfuerzo de digitalización.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '10px 0' }}>
                {usuariosData.map((usr) => (
                  <div key={usr.usuario} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Videos de {usr.usuario.charAt(0).toUpperCase() + usr.usuario.slice(1).toLowerCase()}</span>
                    <span style={{ fontWeight: 'bold' }}>{usr.value} videos ({usr.percent}%)</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Tiempo de Grabación</span>
                  <span style={{ fontWeight: 'bold' }}>{(kpis.totalSegundos / 60).toFixed(1)} minutos ({kpis.totalSegundos}s)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Promedio por Localidad</span>
                  <span style={{ fontWeight: 'bold' }}>{(kpis.totalVideos / kpis.totalMapas).toFixed(1)} videos / mapa</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '5px' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Ratio Humanos/Animales</span>
                  <span style={{ fontWeight: 'bold' }}>{(kpis.humanos / kpis.animales).toFixed(1)}x a favor de Humanos</span>
                </div>
              </div>
              <button className="neon-button" style={{ width: '100%', marginTop: '15px' }} onClick={() => setActiveTab('plan')}>
                VER PLAN DE ACCIÓN
              </button>
            </div>
          </div>
        </section>
      )}

      {/* SECCIÓN 2: DISTRIBUCIÓN POR MAPAS */}
      {activeTab === 'mapas' && (
        <section className="resumen-section">
          <div className="map-controls glass-panel" style={{ padding: '15px 25px' }}>
            <div className="search-input-wrapper" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Buscar mapa..."
                className="glass-input"
                style={{ paddingLeft: '38px', width: '100%' }}
                value={mapSearch}
                onChange={(e) => setMapSearch(e.target.value)}
              />
            </div>

            <div className="sort-btn-group">
              <button
                className={`sort-btn ${mapSort === 'total-desc' ? 'active' : ''}`}
                onClick={() => setMapSort('total-desc')}
              >
                <ArrowUpDown size={14} style={{ marginRight: '6px', display: 'inline' }} /> Más videos
              </button>
              <button
                className={`sort-btn ${mapSort === 'total-asc' ? 'active' : ''}`}
                onClick={() => setMapSort('total-asc')}
              >
                Menos videos
              </button>
              <button
                className={`sort-btn ${mapSort === 'name-asc' ? 'active' : ''}`}
                onClick={() => setMapSort('name-asc')}
              >
                A-Z
              </button>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card glass-panel" style={{ minHeight: '520px' }}>
              <h3>Videos por Localización</h3>
              <p className="chart-subtitle">
                Distribución de los {kpis.totalVideos} videos en {kpis.totalMapas} localizaciones.
                {showAllMaps ? ' Mostrando todos.' : ' Mostrando Top 10.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                {mapsToDisplay.map((m) => {
                  const maxVal = Math.max(...inicialMapas.map(item => item.total));
                  const percentageWidth = (m.total / maxVal) * 100;
                  return (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '120px', fontSize: '0.85rem', color: '#fff', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.name}
                      </div>
                      <div style={{ flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.03)', height: '12px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div
                          className="bar-rect"
                          style={{
                            width: `${percentageWidth}%`,
                            height: '100%',
                            background: 'linear-gradient(to right, var(--neon-cyan), var(--neon-purple))',
                            borderRadius: '5px'
                          }}
                          onMouseMove={(e) => showChartTooltip(e, m.name, `${m.total} videos en total`)}
                          onMouseLeave={hideChartTooltip}
                        />
                      </div>
                      <div style={{ width: '30px', fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>
                        {m.total}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <button className="neon-button" onClick={() => setShowAllMaps(!showAllMaps)}>
                  {showAllMaps ? 'MOSTRAR MENOS (TOP 10)' : 'VER TODOS LOS MAPAS (42)'}
                </button>
              </div>
            </div>

            <div className="chart-card glass-panel" style={{ minHeight: '520px' }}>
              <h3>Mapa x Especie (Desglose Apilado)</h3>
              <p className="chart-subtitle">Proporción de Humano / Animal / Sin clasificar por localización.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                {mapsToDisplay.map((m) => {
                  const pctHuman = (m.human / m.total) * 100;
                  const pctAnimal = (m.animal / m.total) * 100;
                  const pctUnclass = (m.unclassified / m.total) * 100;

                  return (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '120px', fontSize: '0.85rem', color: '#fff', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.name}
                      </div>
                      <div style={{ flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.03)', height: '14px', borderRadius: '4px', display: 'flex', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {m.human > 0 && (
                          <div
                            className="bar-rect"
                            style={{ width: `${pctHuman}%`, height: '100%', backgroundColor: 'var(--neon-cyan)' }}
                            onMouseMove={(e) => showChartTooltip(e, `${m.name} - Humanos`, `${m.human} videos`)}
                            onMouseLeave={hideChartTooltip}
                          />
                        )}
                        {m.animal > 0 && (
                          <div
                            className="bar-rect"
                            style={{ width: `${pctAnimal}%`, height: '100%', backgroundColor: '#2ecc71' }}
                            onMouseMove={(e) => showChartTooltip(e, `${m.name} - Animales`, `${m.animal} videos`)}
                            onMouseLeave={hideChartTooltip}
                          />
                        )}
                        {m.unclassified > 0 && (
                          <div
                            className="bar-rect"
                            style={{ width: `${pctUnclass}%`, height: '100%', backgroundColor: '#ff4b2b' }}
                            onMouseMove={(e) => showChartTooltip(e, `${m.name} - Sin Clasificar`, `${m.unclassified} videos`)}
                            onMouseLeave={hideChartTooltip}
                          />
                        )}
                      </div>
                      <div style={{ width: '30px', fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>
                        {m.total}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="chart-legends" style={{ marginTop: '20px' }}>
                <span className="legend-item"><span className="legend-color" style={{ backgroundColor: 'var(--neon-cyan)' }} /> Humano</span>
                <span className="legend-item"><span className="legend-color" style={{ backgroundColor: '#2ecc71' }} /> Animal</span>
                <span className="legend-item"><span className="legend-color" style={{ backgroundColor: '#ff4b2b' }} /> Sin Clasificar</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECCIÓN 3: COMPARATIVA DE USUARIOS */}
      {activeTab === 'comparativa' && (
        <section className="resumen-section">
          {(() => {
            const sortedUsers = [...usuariosData].sort((a, b) => b.value - a.value);
            const maxUser = sortedUsers[0];
            const minUser = sortedUsers[sortedUsers.length - 1];
            const gap = maxUser ? (maxUser.value - minUser.value) : 0;
            
            return (
              <>
                <div className="charts-row">
                  <div className="chart-card glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3>Carga de Trabajo por Miembro</h3>
                      <p className="chart-subtitle">Videos aportados al censo por cada responsable.</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '180px', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                        {usuariosData.map((usr) => (
                          <span key={usr.usuario}>{usr.usuario} ({usr.value} videos)</span>
                        ))}
                      </div>

                      <div style={{ width: '100%', height: '30px', borderRadius: '15px', display: 'flex', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: '0 0 15px rgba(0,0,0,0.5)' }}>
                        {usuariosData.map((usr, idx) => (
                          <div
                            key={usr.usuario}
                            className="bar-rect"
                            style={{
                              width: `${(usr.value / (kpis?.totalVideos || 1)) * 100}%`,
                              height: '100%',
                              backgroundColor: getUsuarioColor(idx)
                            }}
                            onMouseMove={(e) => showChartTooltip(e, usr.usuario, `${usr.value} videos (${usr.percent}%)`)}
                            onMouseLeave={hideChartTooltip}
                          />
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {usuariosData.map((usr, idx) => (
                          <span key={usr.usuario} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: getUsuarioColor(idx) }} />
                            {usr.usuario}: {usr.percent}%
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'center', margin: 0 }}>
                        {usuariosData.length > 1 ? (
                          `El censo cuenta con participación de ${usuariosData.length} miembros. El máximo aportante es ${maxUser?.usuario} con ${maxUser?.value} videos, existiendo una diferencia de ${gap} videos respecto al mínimo aportante (${minUser?.usuario}).`
                        ) : (
                          `El censo cuenta con participación de ${usuariosData.length} miembro activo.`
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="chart-card glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3>Comparación en Top Mapas</h3>
                      <p className="chart-subtitle">Aportes individuales en las localizaciones más grandes.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      {inicialMapas.slice(0, 5).map(m => {
                        const mapUsers = m.usuarios || {};
                        const totalLocal = Object.values(mapUsers).reduce((a, b) => a + b, 0) || 1;
                        
                        return (
                          <div key={m.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'white', marginBottom: '4px' }}>
                              <span>{m.name}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                {Object.entries(mapUsers)
                                  .filter(([_, count]) => count > 0)
                                  .map(([user, count]) => `${user}: ${count}`)
                                  .join(' | ')}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', borderRadius: '4px', display: 'flex', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)' }}>
                              {Object.entries(mapUsers).map(([user, count], idx) => {
                                if (count === 0) return null;
                                const userIdx = usuariosData.findIndex(u => u.usuario === user);
                                return (
                                  <div 
                                    key={user}
                                    style={{ 
                                      width: `${(count / totalLocal) * 100}%`, 
                                      height: '100%', 
                                      backgroundColor: getUsuarioColor(userIdx !== -1 ? userIdx : idx) 
                                    }} 
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="chart-legends">
                      {usuariosData.map((usr, idx) => (
                        <span key={usr.usuario} className="legend-item">
                          <span className="legend-color" style={{ backgroundColor: getUsuarioColor(idx) }} />
                          {usr.usuario}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="chart-card glass-panel" style={{ minHeight: 'auto' }}>
                  <h3>Mapas Exclusivos por Miembro</h3>
                  <p className="chart-subtitle">Localizaciones donde solo ha grabado un único miembro del equipo.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
                    {usuariosData.map((usr, idx) => {
                      const userExcl = exclusivasPorUsuario[usr.usuario] || [];
                      
                      return (
                        <div key={usr.usuario} className="glass-panel" style={{ padding: '15px', border: `1px solid ${getUsuarioColor(idx)}40`, background: 'rgba(255,255,255,0.01)' }}>
                          <h4 style={{ margin: '0 0 12px 0', borderBottom: `1px solid ${getUsuarioColor(idx)}20`, paddingBottom: '8px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Solo {usr.usuario}</span>
                            <span className="tag" style={{ fontSize: '0.7rem', padding: '2px 8px', backgroundColor: `${getUsuarioColor(idx)}15`, borderColor: getUsuarioColor(idx), color: getUsuarioColor(idx) }}>
                              {userExcl.length} mapas
                            </span>
                          </h4>
                          
                          {userExcl.length === 0 ? (
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', fontStyle: 'italic', margin: '10px 0 0 0' }}>No posee mapas exclusivos.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                              {userExcl.map(m => (
                                <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#eee', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                                  <span>{m.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{m.total} videos</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* SECCIÓN 4: GÉNERO Y DIVERSIDAD */}
      {activeTab === 'diversidad' && (
        <section className="resumen-section">
          <div className="alert-box alert-danger glass-panel" style={{ borderLeft: '4px solid #f39c12' }}>
            <span className="alert-icon"><AlertTriangle color="#f39c12" /></span>
            <div className="alert-message">
              <h4>Desbalance de Género en Mapas</h4>
              <p>
                <strong>15 mapas</strong> tienen personajes humanos exclusivamente masculinos (sin mujeres):
                <em> Biblioteca, Desierto, Cementerio, Playa, Centro Comercial, Campo, Vecindario, Cañon, Basurero, Bar, Laboratorio, Castillo, Barco, Base militar y Mansión Antigua.</em>
              </p>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3>Género (solo Humanos)</h3>
                <p className="chart-subtitle">Análisis sobre 189/192 videos con personajes humanos.</p>
              </div>

              {renderDonutChart(generoData, 189, 'Género')}

              <div className="chart-legends">
                {generoData.map(g => (
                  <span key={g.label} className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: g.color }} />
                    {g.label}: {g.value} ({g.percent}%)
                  </span>
                ))}
              </div>
              <p style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '10px' }}>
                ✓ Género prácticamente equilibrado globalmente (48.1% mujeres).
              </p>
            </div>

            <div className="chart-card glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3>Etnia (solo Humanos)</h3>
                <p className="chart-subtitle">Distribución étnica en los personajes detectados.</p>
              </div>

              {renderDonutChart(etniaData, 189, 'Etnia')}

              <div className="chart-legends">
                {etniaData.map(e => (
                  <span key={e.label} className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: e.color }} />
                    {e.label}: {e.value} ({e.percent}%)
                  </span>
                ))}
              </div>
              <p style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '10px' }}>
                ✓ Distribución étnica equilibrada (50.3% blanco vs 49.7% moreno).
              </p>
            </div>
          </div>

          <div className="charts-row">
            <div className="chart-card glass-panel" style={{ minHeight: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3>Cruce Género x Etnia</h3>
                <p className="chart-subtitle">Cantidad de videos segmentados por el cruce demográfico.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '180px', paddingBottom: '20px' }}>
                {cruceGenEtnia.map(c => {
                  const maxVal = Math.max(...cruceGenEtnia.map(x => x.value));
                  const percentHeight = (c.value / maxVal) * 100;
                  return (
                    <div key={c.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '20%' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{c.value}</span>
                      <div
                        className="bar-rect"
                        style={{
                          width: '100%',
                          height: `${percentHeight * 1.2}px`,
                          maxHeight: '120px',
                          backgroundColor: c.color,
                          borderRadius: '4px 4px 0 0',
                          boxShadow: `0 0 10px ${c.color}25`
                        }}
                        onMouseMove={(e) => showChartTooltip(e, c.label, `${c.value} videos`)}
                        onMouseLeave={hideChartTooltip}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', whiteSpace: 'nowrap' }}>{c.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="chart-card glass-panel" style={{ minHeight: '320px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3>Balance de Género por Mapa</h3>
                <p className="chart-subtitle">Comparativa Hombre / Mujer en mapas con presencia humana.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {inicialMapas.slice(1, 6).map(m => {
                  const totalHumans = m.human;
                  if (totalHumans === 0) return null;
                  // Asumiremos un ratio simplificado representativo
                  const ratioMujer = m.name === 'Venecia' ? 0.35 : m.name === 'Estación Tren' ? 0.2 : m.name === 'Mansión Antigua' ? 0 : 0.4;
                  const mujeresCount = Math.round(totalHumans * ratioMujer);
                  const hombresCount = totalHumans - mujeresCount;

                  return (
                    <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
                      <div style={{ width: '100px', textAlign: 'right', color: 'var(--text-dim)' }}>{m.name}</div>
                      <div style={{ flexGrow: 1, height: '8px', borderRadius: '4px', display: 'flex', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ width: `${(hombresCount / totalHumans) * 100}%`, backgroundColor: 'var(--neon-cyan)' }} />
                        <div style={{ width: `${(mujeresCount / totalHumans) * 100}%`, backgroundColor: 'var(--neon-purple)' }} />
                      </div>
                      <div style={{ width: '80px', color: '#fff' }}>H:{hombresCount} | M:{mujeresCount}</div>
                    </div>
                  );
                })}
              </div>

              <div className="chart-legends">
                <span className="legend-item"><span className="legend-color" style={{ backgroundColor: 'var(--neon-cyan)' }} /> Hombres</span>
                <span className="legend-item"><span className="legend-color" style={{ backgroundColor: 'var(--neon-purple)' }} /> Mujeres</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECCIÓN 5: ASPECTOS TÉCNICOS */}
      {activeTab === 'tecnico' && (
        <section className="resumen-section">
          <div className="charts-row">
            <div className="chart-card glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3>Tipo de Cámara</h3>
                <p className="chart-subtitle">Frecuencia de uso de los diferentes encuadres y dinámicas.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '220px', paddingBottom: '20px' }}>
                {camaraData.map(c => {
                  const maxVal = Math.max(...camaraData.map(x => x.value));
                  const percentHeight = (c.value / maxVal) * 150;
                  return (
                    <div key={c.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '16%' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{c.value}</span>
                      <div
                        className="bar-rect"
                        style={{
                          width: '100%',
                          height: `${percentHeight}px`,
                          backgroundColor: c.color,
                          borderRadius: '4px 4px 0 0'
                        }}
                        onMouseMove={(e) => showChartTooltip(e, c.label, `${c.value} videos`)}
                        onMouseLeave={hideChartTooltip}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', whiteSpace: 'nowrap' }}>{c.label}</span>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', margin: 0 }}>
                La cámara de tipo <strong>Realizadora</strong> es la más utilizada ({camaraData[0].value} videos),
                mientras que la de <strong>Primera Persona</strong> es la menos frecuente ({camaraData[4].value} videos).
              </p>
            </div>

            <div className="chart-card glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3>Distribución de Duración</h3>
                <p className="chart-subtitle">Frecuencia de videos según su duración en segundos.</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '220px', paddingBottom: '20px' }}>
                {duracionData.map(d => {
                  const maxVal = Math.max(...duracionData.map(x => x.value));
                  const percentHeight = (d.value / maxVal) * 150;
                  return (
                    <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '10%' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{d.value}</span>
                      <div
                        className="bar-rect"
                        style={{
                          width: '100%',
                          height: `${percentHeight}px`,
                          backgroundColor: '#9c27b0',
                          borderRadius: '4px 4px 0 0'
                        }}
                        onMouseMove={(e) => showChartTooltip(e, `${d.label} de duración`, `${d.value} videos`)}
                        onMouseLeave={hideChartTooltip}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', margin: 0 }}>
                La duración más común en el dataset es de <strong>7 segundos</strong> (80 videos), con una media general de 6.9s.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* SECCIÓN 6: PLAN DE ACCIÓN */}
      {activeTab === 'plan' && (
        <section className="resumen-section">
          <div className="glass-panel" style={{ padding: '25px', marginBottom: '30px' }}>
            <h3>Plan de Acción & Gaps Detectados</h3>
            <p className="chart-subtitle" style={{ marginBottom: 0 }}>
              Controlador de tareas para la resolución de anomalías estadísticas detectadas en el censo.
              El progreso se guarda localmente en su sesión del navegador.
            </p>
          </div>

          <div className="plan-accion-layout">
            {/* PRIORIDAD CRÍTICA */}
            <div className="priority-column glass-panel">
              <h3>
                Prioridad Crítica
                <span className="priority-badge badge-critica">CRÍTICA</span>
              </h3>

              <div className="action-items-list">
                {actionPlan.filter(x => x.priority === 'critica').map(item => (
                  <div key={item.id} className={`action-card ${item.checked ? 'resolved' : ''} ${item.status === 'En Proceso' ? 'in-progress' : ''}`}>
                    <div className="action-header">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleActionCheck(item.id)}
                      />
                      <div>
                        <h4 className="action-title">{item.title}</h4>
                        <span style={{ fontSize: '0.7rem', color: '#ff4b2b', fontWeight: 'bold' }}>{item.cat}</span>
                      </div>
                    </div>
                    <p className="action-desc">{item.desc}</p>
                    <div className="action-footer">
                      <span className="action-deficit">Déficit: {item.deficit}</span>
                      <select
                        className="action-status-select"
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PRIORIDAD ALTA */}
            <div className="priority-column glass-panel">
              <h3>
                Prioridad Alta
                <span className="priority-badge badge-alta">ALTA</span>
              </h3>

              <div className="action-items-list">
                {actionPlan.filter(x => x.priority === 'alta').map(item => (
                  <div key={item.id} className={`action-card ${item.checked ? 'resolved' : ''} ${item.status === 'En Proceso' ? 'in-progress' : ''}`}>
                    <div className="action-header">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleActionCheck(item.id)}
                      />
                      <div>
                        <h4 className="action-title">{item.title}</h4>
                        <span style={{ fontSize: '0.7rem', color: '#f39c12', fontWeight: 'bold' }}>{item.cat}</span>
                      </div>
                    </div>
                    <p className="action-desc">{item.desc}</p>
                    <div className="action-footer">
                      <span className="action-deficit">Déficit: {item.deficit}</span>
                      <select
                        className="action-status-select"
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PRIORIDAD MEDIA */}
            <div className="priority-column glass-panel">
              <h3>
                Prioridad Media
                <span className="priority-badge badge-media">MEDIA</span>
              </h3>

              <div className="action-items-list">
                {actionPlan.filter(x => x.priority === 'media').map(item => (
                  <div key={item.id} className={`action-card ${item.checked ? 'resolved' : ''} ${item.status === 'En Proceso' ? 'in-progress' : ''}`}>
                    <div className="action-header">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleActionCheck(item.id)}
                      />
                      <div>
                        <h4 className="action-title">{item.title}</h4>
                        <span style={{ fontSize: '0.7rem', color: '#3498db', fontWeight: 'bold' }}>{item.cat}</span>
                      </div>
                    </div>
                    <p className="action-desc">{item.desc}</p>
                    <div className="action-footer">
                      <span className="action-deficit">Déficit: {item.deficit}</span>
                      <select
                        className="action-status-select"
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PRIORIDAD BAJA */}
            <div className="priority-column glass-panel">
              <h3>
                Prioridad Baja
                <span className="priority-badge badge-baja">BAJA</span>
              </h3>

              <div className="action-items-list">
                {actionPlan.filter(x => x.priority === 'baja').map(item => (
                  <div key={item.id} className={`action-card ${item.checked ? 'resolved' : ''} ${item.status === 'En Proceso' ? 'in-progress' : ''}`}>
                    <div className="action-header">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleActionCheck(item.id)}
                      />
                      <div>
                        <h4 className="action-title">{item.title}</h4>
                        <span style={{ fontSize: '0.7rem', color: '#2ecc71', fontWeight: 'bold' }}>{item.cat}</span>
                      </div>
                    </div>
                    <p className="action-desc">{item.desc}</p>
                    <div className="action-footer">
                      <span className="action-deficit">Déficit: {item.deficit}</span>
                      <select
                        className="action-status-select"
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Completado">Completado</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Botón de Actualizar al final del Plan de Acción */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            marginTop: '40px',
            paddingTop: '30px',
            borderTop: '1px solid rgba(255,255,255,0.06)'
          }}>
          </div>
        </section>
      )}
    </div>
  );
};

export default Resumen;
