import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, TrendingUp, Users, Camera, CheckSquare,
  MapPin, ArrowLeft, AlertTriangle, Palette, Layers,
  Activity, Sliders, Shield, Filter, Bell, X, RefreshCw,
  Download, Copy, ChevronDown, ChevronUp, Link2, Clock, Database,
} from 'lucide-react';
import api from '../utils/api';

/* ─────────────────────────────────────────────────────────────
   Paleta de colores base para estilos (los conocidos mantienen su color;
   estilos nuevos del Excel reciben colores de la paleta extendida).
   El objeto definitivo se construye en tiempo de ejecución desde rawData.
─────────────────────────────────────────────────────────────── */
const PALETA_ESTILOS_BASE = [
  '#00f2ff', // 0 Anime  (cian neón)
  '#f39c12', // 1 Cartoon (naranja)
  '#e74c3c', // 2 Lego   (rojo)
  '#bc13fe', // 3 Ciberpunk (violeta)
  '#2ecc71', // 4 extra
  '#3498db', // 5 extra
  '#e91e63', // 6 extra
  '#9b59b6', // 7 extra
  '#1abc9c', // 8 extra
  '#ff5722', // 9 extra
];

/** Devuelve el color de un estilo desde los datos del backend (rawData.coloresEstilo).
 *  Si no está disponible aún, usa la paleta base por índice como fallback. */
const colorEstilo = (est, coloresEstiloMap, estilosValidos) => {
  if (coloresEstiloMap && coloresEstiloMap[est]) return coloresEstiloMap[est];
  const idx = estilosValidos ? estilosValidos.indexOf(est) : -1;
  return idx >= 0 ? PALETA_ESTILOS_BASE[idx % PALETA_ESTILOS_BASE.length] : '#7f8c8d';
};

const COLORES_MIEMBRO = [
  '#ff4b2b', '#00f2ff', '#bc13fe', '#2ecc71',
  '#f39c12', '#3498db', '#e91e63',
];

const SEVERIDAD_COLOR = {
  critica:     '#ff4b2b',
  advertencia: '#f39c12',
  informativa: '#2ecc71',
};
const SEVERIDAD_ICON = {
  critica:     '🔴',
  advertencia: '🟡',
  informativa: '🟢',
};

/* ─────────────────────────────────────────────────────────────
   Helpers de recálculo client-side sobre registros crudos
─────────────────────────────────────────────────────────────── */
function calcDistribucion(registros, campo, colores = {}) {
  const contador = {};
  registros.forEach(r => {
    const k = r[campo] || 'Sin dato';
    contador[k] = (contador[k] || 0) + 1;
  });
  const total = registros.length || 1;
  return Object.entries(contador).map(([label, value]) => ({
    label, value, percent: round((value / total) * 100, 1),
    color: colores[label] || '#7f8c8d',
  })).sort((a, b) => b.value - a.value);
}

function round(v, d = 1) { return Math.round(v * 10 ** d) / 10 ** d; }

/* ─────────────────────────────────────────────────────────────
   Componente principal
─────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────
   Sub-componente: Tab de Metadatos de Video
   Separa la logica del IIFE para evitar crashes en el error boundary.
   ───────────────────────────────────────────────────────────────────────── */
function MetadatosTab({ metadataStats = {}, duracionPorEstilo = [], showTip, hideTip }) {
  const ms       = metadataStats;
  const totalReg = ms.totalRegistros   || 0;
  const conMeta  = ms.conMetadata      || 0;
  const sinMeta  = ms.sinMetadata      || 0;
  const pctCob   = ms.pctCobertura     || 0;
  const fpsList  = ms.fpsPorEstilo     || [];
  const resList  = ms.resPorEstilo     || [];
  const sizList  = ms.tamanioPorEstilo || [];
  const fpsDist  = ms.distribucionFps  || [];
  const durDist  = ms.distribucionDurOrig || [];
  const maxFps    = fpsList.length > 0 ? Math.max(...fpsList.map(f => f.avgFps))   : 1;
  const maxSize   = sizList.length > 0 ? Math.max(...sizList.map(s => s.avgSizeMb)): 1;
  const maxDurCnt = durDist.length > 0 ? Math.max(...durDist.map(d => d.cantidad)) : 1;
  const maxFpsCnt = fpsDist.length > 0 ? Math.max(...fpsDist.map(d => d.cantidad)) : 1;

  return (
    <section className="resumen-section">
      {/* ── KPIs de Cobertura ── */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '22px', flexWrap: 'wrap' }}>
        <div className="kpi-card glass-panel" style={{ borderLeft: '4px solid #bc13fe', flex: 1, minWidth: '140px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Registros con metadata</h3>
          <p className="kpi-value" style={{ color: '#bc13fe' }}>{conMeta}</p>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{pctCob}% de {totalReg} totales</span>
        </div>
        <div className="kpi-card glass-panel" style={{ borderLeft: '4px solid #f39c12', flex: 1, minWidth: '140px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Sin metadata</h3>
          <p className="kpi-value" style={{ color: '#f39c12' }}>{sinMeta}</p>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Pendientes de extracción</span>
        </div>
        <div className="kpi-card glass-panel" style={{ borderLeft: '4px solid #2ecc71', flex: 1, minWidth: '200px' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Cobertura de Extracción</h3>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '6px', height: '10px', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{ width: `${pctCob}%`, height: '100%', background: pctCob >= 80 ? '#2ecc71' : pctCob >= 40 ? '#f39c12' : '#ff4b2b', borderRadius: '5px', transition: 'width 0.8s ease' }} />
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            {pctCob < 100 ? `Ve a Sync & Meta para extraer los ${sinMeta} restantes` : '✅ Cobertura completa'}
          </span>
        </div>
      </div>

      <div className="charts-row">
        {/* ── FPS Promedio por Estilo ── */}
        <div className="chart-card glass-panel" style={{ borderTop: '2px solid #00f2ff' }}>
          <h3 className="chart-title">FPS Promedio por Estilo</h3>
          <p className="chart-subtitle">Velocidad de cuadros del video estilizado.</p>
          {fpsList.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px 0' }}>
              Sin datos — ejecuta la extracción de metadatos
            </div>
          ) : fpsList.map(f => (
            <div key={f.estilo} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '90px', fontSize: '0.8rem', color: '#fff', textAlign: 'right' }}>{f.estilo}</div>
              <div style={{ flexGrow: 1, background: 'rgba(255,255,255,0.04)', height: '12px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div
                  style={{ width: `${(f.avgFps / maxFps) * 100}%`, height: '100%', background: f.color, borderRadius: '5px', transition: 'width 0.6s ease' }}
                  onMouseMove={e => showTip(e, f.estilo, `${f.avgFps} fps (${f.conDatos} videos)`)}
                  onMouseLeave={hideTip}
                />
              </div>
              <div style={{ width: '50px', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>{f.avgFps} fps</div>
            </div>
          ))}
        </div>

        {/* ── Tamaño Promedio por Estilo ── */}
        <div className="chart-card glass-panel" style={{ borderTop: '2px solid #f39c12' }}>
          <h3 className="chart-title">Tamaño Promedio del Video Estilizado</h3>
          <p className="chart-subtitle">Megabytes promedio por estilo visual.</p>
          {sizList.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px 0' }}>Sin datos de tamaño</div>
          ) : sizList.map(s => (
            <div key={s.estilo} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '90px', fontSize: '0.8rem', color: '#fff', textAlign: 'right' }}>{s.estilo}</div>
              <div style={{ flexGrow: 1, background: 'rgba(255,255,255,0.04)', height: '12px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div
                  style={{ width: `${(s.avgSizeMb / maxSize) * 100}%`, height: '100%', background: s.color, borderRadius: '5px', transition: 'width 0.6s ease' }}
                  onMouseMove={e => showTip(e, s.estilo, `${s.avgSizeMb} MB promedio (total: ${s.totalSizeMb} MB, ${s.conDatos} videos)`)}
                  onMouseLeave={hideTip}
                />
              </div>
              <div style={{ width: '60px', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>{s.avgSizeMb} MB</div>
            </div>
          ))}
        </div>
      </div>

      <div className="charts-row">
        {/* ── Distribución de FPS ── */}
        <div className="chart-card glass-panel" style={{ borderTop: '2px solid #bc13fe' }}>
          <h3 className="chart-title">Distribución Global de FPS</h3>
          <p className="chart-subtitle">Cuántos videos tienen cada valor de FPS.</p>
          {fpsDist.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px 0' }}>Sin datos de FPS</div>
          ) : fpsDist.map(d => (
            <div key={d.fps} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '50px', fontSize: '0.8rem', color: '#fff', textAlign: 'right' }}>{d.fps} fps</div>
              <div style={{ flexGrow: 1, background: 'rgba(255,255,255,0.04)', height: '12px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div
                  style={{ width: `${(d.cantidad / maxFpsCnt) * 100}%`, height: '100%', background: 'linear-gradient(to right, #bc13fe, #00f2ff)', borderRadius: '5px', transition: 'width 0.6s ease' }}
                  onMouseMove={e => showTip(e, `${d.fps} fps`, `${d.cantidad} videos`)}
                  onMouseLeave={hideTip}
                />
              </div>
              <div style={{ width: '40px', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>{d.cantidad}</div>
            </div>
          ))}
        </div>

        {/* ── Distribución de Duración Original ── */}
        <div className="chart-card glass-panel" style={{ borderTop: '2px solid #2ecc71' }}>
          <h3 className="chart-title">Distribución de Duración (Original)</h3>
          <p className="chart-subtitle">Rangos de duración del video original grabado.</p>
          {durDist.every(d => d.cantidad === 0) ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px 0' }}>Sin datos de duración</div>
          ) : durDist.map((d, i) => {
            const colors = ['#2ecc71', '#00f2ff', '#f39c12', '#ff4b2b'];
            return (
              <div key={d.rango} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '60px', fontSize: '0.8rem', color: '#fff', textAlign: 'right' }}>{d.rango}</div>
                <div style={{ flexGrow: 1, background: 'rgba(255,255,255,0.04)', height: '12px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div
                    style={{ width: `${(d.cantidad / maxDurCnt) * 100}%`, height: '100%', background: colors[i % colors.length], borderRadius: '5px', transition: 'width 0.6s ease' }}
                    onMouseMove={e => showTip(e, `Duración ${d.rango}`, `${d.cantidad} videos`)}
                    onMouseLeave={hideTip}
                  />
                </div>
                <div style={{ width: '35px', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>{d.cantidad}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Resolución + Retención ── */}
      <div className="charts-row">
        <div className="chart-card glass-panel" style={{ borderTop: '2px solid #e74c3c' }}>
          <h3 className="chart-title">Resolución Más Común por Estilo</h3>
          <p className="chart-subtitle">Resolución dominante del video estilizado por estilo visual.</p>
          {resList.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px 0' }}>Sin datos de resolución</div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {resList.map(r => (
                <div key={r.estilo} style={{ flex: '1', minWidth: '160px', padding: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: `1px solid ${r.color}33` }}>
                  <div style={{ fontSize: '0.72rem', color: r.color, fontWeight: 'bold', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>{r.estilo}</div>
                  <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}>{r.resolucionMasComun}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{r.conDatos} videos con datos</div>
                  {r.conteos && r.conteos.length > 1 && (
                    <div style={{ marginTop: '8px' }}>
                      {r.conteos.slice(0, 3).map(c => (
                        <div key={c.res} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-dim)', padding: '2px 0' }}>
                          <span>{c.res}</span><span style={{ color: '#fff' }}>{c.cnt}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chart-card glass-panel" style={{ borderTop: '2px solid #f39c12' }}>
          <h3 className="chart-title">Retención de Duración por Estilo</h3>
          <p className="chart-subtitle">% de duración del estilizado vs original. Ideal &gt;80%.</p>
          {duracionPorEstilo.every(d => d.conDatos === 0) ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px 0' }}>
              Sin datos — ejecuta extracción de metadatos
            </div>
          ) : duracionPorEstilo.filter(d => d.conDatos > 0).map(d => {
            const pct      = d.pctRetencion || 0;
            const barColor = pct >= 90 ? '#2ecc71' : pct >= 80 ? '#f39c12' : '#ff4b2b';
            return (
              <div key={d.estilo} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '90px', fontSize: '0.8rem', color: '#fff', textAlign: 'right' }}>{d.estilo}</div>
                <div style={{ flexGrow: 1, background: 'rgba(255,255,255,0.04)', height: '14px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div
                    style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: '5px', transition: 'width 0.8s ease' }}
                    onMouseMove={e => showTip(e, `${d.estilo} — Retención`, `${d.avgDurOriginal}s orig → ${d.avgDurEstilizado}s estil = ${pct}%`)}
                    onMouseLeave={hideTip}
                  />
                </div>
                <div style={{ width: '45px', fontSize: '0.8rem', fontWeight: 'bold', color: barColor }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Aviso si hay poca cobertura ── */}
      {pctCob < 50 && (
        <div style={{ marginTop: '16px', padding: '14px 18px', background: 'rgba(243,156,18,0.08)', borderRadius: '10px', border: '1px solid rgba(243,156,18,0.3)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <span style={{ color: '#f39c12', fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 'bold', color: '#f39c12', marginBottom: '4px' }}>
              Baja cobertura de metadatos ({pctCob}%)
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Solo {conMeta} de {totalReg} registros tienen metadatos extraídos.
              Ve a <strong style={{ color: '#00f2ff' }}>Sync &amp; Meta</strong> y ejecuta la extracción,
              o corre <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>python manage.py extract_metadata</code> para procesarlos todos.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const Estadisticas = () => {
  const navigate = useNavigate();

  // ── Estado de UI ──────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState('general');
  const [tooltip, setTooltip]             = useState({ show: false, x: 0, y: 0, title: '', value: '' });
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [alertasSidebarOpen, setAlertasSidebarOpen] = useState(false);
  const [filtrosOpen, setFiltrosOpen]     = useState(false);
  const [modalSolicitud, setModalSolicitud] = useState(null); // { texto, titulo }
  const [syncStatus, setSyncStatus]       = useState(null);
  const [metaStatus, setMetaStatus]       = useState(null);
  const [syncing, setSyncing]             = useState(false);
  const [extracting, setExtracting]       = useState(false);

  // ── Estado de datos crudos (del backend) ─────────────────────────
  const [rawData, setRawData] = useState(null); // respuesta completa del API

  // ── Estado de filtros ─────────────────────────────────────────────
  const FILTROS_VACÍOS = {
    estilos:    [],
    productores:[],
    miembros:   [],
    estados:    [],
    mapas:      [],
    especies:   [],
    tieneArreglo: null, // null=todos, true=sí, false=no
  };
  const [filtros, setFiltros] = useState(FILTROS_VACÍOS);

  // ── Carga de datos ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/sheets/registro-summary/');
      setRawData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error al obtener estadísticas:', err);
      setError('Error de red: No se pudo conectar con el servidor Django.');
      setLoading(false);
    }
  }, []);

  // Cargar estado de metadatos al montar
  const fetchMetaStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/sheets/extract-metadata/');
      setMetaStatus(data);
    } catch { setMetaStatus(null); }
  }, []);

  useEffect(() => { fetchData(); fetchMetaStatus(); }, [fetchData, fetchMetaStatus]);

  // ── Tooltip ───────────────────────────────────────────────────────
  const showTip = (e, title, value) =>
    setTooltip({ show: true, x: e.clientX + 15, y: e.clientY + 15, title, value });
  const hideTip = () => setTooltip(t => t.show ? { show: false, x: 0, y: 0, title: '', value: '' } : t);

  // Ocultar tooltip si el mouse sale de la ventana del navegador
  useEffect(() => {
    const onLeave = () => hideTip();
    document.addEventListener('mouseleave', onLeave);
    return () => document.removeEventListener('mouseleave', onLeave);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Registros filtrados (client-side) ─────────────────────────────
  const registrosFiltrados = useMemo(() => {
    if (!rawData?.registrosCrudos) return [];
    return rawData.registrosCrudos.filter(r => {
      if (filtros.estilos.length    && !filtros.estilos.includes(r.estilo))     return false;
      if (filtros.productores.length && !filtros.productores.includes(r.productor)) return false;
      if (filtros.miembros.length   && !filtros.miembros.includes(r.miembro))   return false;
      if (filtros.estados.length    && !filtros.estados.includes(r.estado))     return false;
      if (filtros.mapas.length      && !filtros.mapas.includes(r.mapa))         return false;
      if (filtros.especies.length   && !filtros.especies.includes(r.especie))   return false;
      if (filtros.tieneArreglo !== null && r.tieneArreglo !== filtros.tieneArreglo) return false;
      return true;
    });
  }, [rawData, filtros]);

  const filtrosActivos = useMemo(() => {
    let n = 0;
    if (filtros.estilos.length)    n++;
    if (filtros.productores.length) n++;
    if (filtros.miembros.length)   n++;
    if (filtros.estados.length)    n++;
    if (filtros.mapas.length)      n++;
    if (filtros.especies.length)   n++;
    if (filtros.tieneArreglo !== null) n++;
    return n;
  }, [filtros]);

  // ── Métricas reactivas sobre registrosFiltrados ───────────────────
  const metricas = useMemo(() => {
    const regs = registrosFiltrados;
    const total = regs.length || 1;

    const kpis = {
      totalEntradas:       regs.length,
      totalAceptados:      regs.filter(r => r.estado === 'Aceptado').length,
      totalRechazados:     regs.filter(r => r.estado === 'Rechazado').length,
      totalDuda:           regs.filter(r => r.estado === 'Duda').length,
      totalSinRevisar:     regs.filter(r => r.estado === 'Sin revisar').length,
      totalConArreglo:     regs.filter(r => r.tieneArreglo).length,
      tasaAceptacion:      round((regs.filter(r => r.estado === 'Aceptado').length   / total) * 100, 1),
      tasaRechazados:      round((regs.filter(r => r.estado === 'Rechazado').length  / total) * 100, 1),
      tasaDuda:            round((regs.filter(r => r.estado === 'Duda').length        / total) * 100, 1),
      tasaSinRevisar:      round((regs.filter(r => r.estado === 'Sin revisar').length / total) * 100, 1),
      tasaConArreglo:      round((regs.filter(r => r.tieneArreglo).length            / total) * 100, 1),
    };

    const coloresEstiloMap = rawData?.coloresEstilo || {};
    const estilosValidos   = rawData?.estilosValidos || [];
    const cEst = (est) => colorEstilo(est, coloresEstiloMap, estilosValidos);

    const estilosData = calcDistribucion(regs, 'estilo', coloresEstiloMap);
    estilosData.forEach(e => e.color = cEst(e.label));

    const estadosDonut = [
      { label: 'Aceptado',    value: kpis.totalAceptados,  color: '#2ecc71' },
      { label: 'Rechazado',   value: kpis.totalRechazados, color: '#ff4b2b' },
      { label: 'Duda',        value: kpis.totalDuda,       color: '#f39c12' },
      { label: 'Sin revisar', value: kpis.totalSinRevisar, color: '#607d8b' },
    ].map(s => ({ ...s, percent: round((s.value / total) * 100, 1) }));

    // Productores principales — dinámico desde los datos reales del Excel
    const coloresPorProductor = rawData?.coloresPorProductor || {};
    const productoresUnicos   = rawData?.productoresUnicos   || [];
    const PALETA_PROD = ['#ff4b2b', '#00f2ff', '#bc13fe', '#2ecc71', '#f39c12', '#3498db', '#e91e63', '#9b59b6'];
    const productores = productoresUnicos.length > 0
      ? productoresUnicos.map((p, i) => {
          const cnt = regs.filter(r => r.productor === p).length;
          return {
            label: p, value: cnt, percent: round((cnt / total) * 100, 1),
            color: coloresPorProductor[p] || PALETA_PROD[i % PALETA_PROD.length],
          };
        })
      // Fallback: derivar productores desde los propios registros filtrados
      : Object.entries(
          regs.reduce((acc, r) => { if (r.productor) acc[r.productor] = (acc[r.productor] || 0) + 1; return acc; }, {})
        ).map(([p, cnt], i) => ({
          label: p, value: cnt, percent: round((cnt / total) * 100, 1),
          color: PALETA_PROD[i % PALETA_PROD.length],
        })).sort((a, b) => b.value - a.value);

    // Miembros (sub-productores) — dinámico
    const miembrosMap = {};
    regs.forEach(r => { if (r.miembro) miembrosMap[r.miembro] = (miembrosMap[r.miembro] || 0) + 1; });
    const subProductores = Object.entries(miembrosMap)
      .map(([label, value]) => ({ label, value, percent: round((value / total) * 100, 1) }))
      .sort((a, b) => b.value - a.value);

    const especiePorEstilo = estilosValidos.map(est => {
      const rows = regs.filter(r => r.estilo === est);
      const t = rows.length || 1;
      const h = rows.filter(r => r.especie === 'Humano').length;
      const a = rows.filter(r => r.especie === 'Animal').length;
      const e = rows.filter(r => r.especie === 'Entorno').length;
      return { estilo: est, color: cEst(est),
               total: rows.length, humano: h, animal: a, entorno: e,
               pctHumano: round((h/t)*100,1), pctAnimal: round((a/t)*100,1), pctEntorno: round((e/t)*100,1) };
    });

    // Género por estilo (solo humanos)
    const generoPorEstilo = estilosValidos.map(est => {
      const rows = regs.filter(r => r.estilo === est && r.especie === 'Humano');
      const t = rows.length || 1;
      const hombres = rows.filter(r => r.genero === 'Hombre').length;
      const mujeres = rows.filter(r => r.genero === 'Mujer').length;
      const blanco  = rows.filter(r => r.etnia  === 'Blanco').length;
      const moreno  = rows.filter(r => r.etnia  === 'Moreno').length;
      return { estilo: est, color: cEst(est),
               totalHumanos: rows.length, hombres, mujeres, blanco, moreno,
               pctHombres: round((hombres/t)*100,1), pctMujeres: round((mujeres/t)*100,1),
               pctBlanco: round((blanco/t)*100,1), pctMoreno: round((moreno/t)*100,1) };
    });

    // Aceptación por estilo
    const aceptacionPorEstilo = estilosValidos.map(est => {
      const rows = regs.filter(r => r.estilo === est);
      const t = rows.length || 1;
      const acep = rows.filter(r => r.estado === 'Aceptado').length;
      const duda = rows.filter(r => r.estado === 'Duda').length;
      const rech = rows.filter(r => r.estado === 'Rechazado').length;
      const sinR = rows.filter(r => r.estado === 'Sin revisar').length;
      return { estilo: est, color: cEst(est),
               total: rows.length, aceptados: acep, duda, rechazados: rech, sinRevisar: sinR,
               tasaAceptacion: round((acep / t) * 100, 1) };
    });

    // Mapas stats — productores dinámicos
    const mapasMap = {};
    regs.forEach(r => {
      const m = r.mapa || 'Sin mapa';
      if (!mapasMap[m]) mapasMap[m] = { mapa: m, total: 0 };
      mapasMap[m].total++;
      // Conteo por estilo
      mapasMap[m][r.estilo?.toLowerCase()] = (mapasMap[m][r.estilo?.toLowerCase()] || 0) + 1;
      // Conteo dinámico por productor (sin hardcodear nombres)
      if (r.productor) {
        const key = r.productor.toLowerCase();
        mapasMap[m][key] = (mapasMap[m][key] || 0) + 1;
      }
    });
    const mapasStats = Object.values(mapasMap).sort((a, b) => b.total - a.total);

    // Gaps de mapas
    const mapasGaps = mapasStats.filter(m => {
      return estilosValidos.some(est => (m[est.toLowerCase()] || 0) === 0);
    }).map(m => ({
      mapa: m.mapa,
      estilosFaltantes: estilosValidos.filter(est => (m[est.toLowerCase()] || 0) === 0),
    }));

    // Cámara global
    const camaraMap = {};
    regs.forEach(r => {
      const c = r.movimientoCamara || 'Sin dato';
      camaraMap[c] = (camaraMap[c] || 0) + 1;
    });
    const camaraGlobal = Object.entries(camaraMap)
      .map(([label, value]) => ({ label, value, percent: round((value / total) * 100, 1) }))
      .sort((a, b) => b.value - a.value);

    // Con arreglos
    const arreglosPorEstilo = estilosValidos.map(est => {
      const rows = regs.filter(r => r.estilo === est);
      const t    = rows.length || 1;
      const conArr = rows.filter(r => r.tieneArreglo).length;
      return { estilo: est, color: cEst(est),
               total: rows.length, conArreglo: conArr,
               pctArreglo: round((conArr / t) * 100, 1) };
    });

    // Duración (de rawData, no filtrada — los metadatos son independientes del filtro)
    const duracionPorEstilo = rawData?.duracionPorEstilo || [];
    const metadataStats     = rawData?.metadataStats     || {};

    return {
      kpis, estilosData, estadosDonut, productores, subProductores,
      especiePorEstilo, generoPorEstilo, aceptacionPorEstilo,
      mapasStats, mapasGaps, camaraGlobal, arreglosPorEstilo, duracionPorEstilo, metadataStats,
      estilosValidos,
    };
  }, [registrosFiltrados, rawData]);

  // ── Alertas (del backend, no filtradas — son del dataset completo) ─
  const alertas       = rawData?.alertas || [];
  const alertasCrit   = alertas.filter(a => a.tipo === 'critica');
  const alertasAdvert = alertas.filter(a => a.tipo === 'advertencia');
  const alertasInfo   = alertas.filter(a => a.tipo === 'informativa');

  // ── Opciones únicas para filtros ──────────────────────────────────
  const opcionesFiltros = useMemo(() => {
    const regs = rawData?.registrosCrudos || [];
    const unique = (campo) => [...new Set(regs.map(r => r[campo]).filter(Boolean))].sort();
    return {
      estilos:    unique('estilo'),
      productores:unique('productor'),
      miembros:   unique('miembro'),
      estados:    unique('estado'),
      mapas:      unique('mapa'),
      especies:   unique('especie'),
    };
  }, [rawData]);

  // ── Handlers de filtros ───────────────────────────────────────────
  const toggleFiltro = (campo, valor) => {
    setFiltros(prev => {
      const arr = prev[campo];
      return { ...prev, [campo]: arr.includes(valor) ? arr.filter(v => v !== valor) : [...arr, valor] };
    });
  };
  const limpiarFiltros = () => setFiltros(FILTROS_VACÍOS);

  // ── Acciones de sync ──────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/sheets/sync-from-sheets/');
      setSyncStatus(data);
      if (data.nuevas > 0 || data.actualizadas > 0) {
        await fetchData(); // recargar datos si hubo cambios
      }
    } catch (e) {
      setSyncStatus({ error: 'Error al sincronizar: ' + (e.message || 'desconocido') });
    } finally { setSyncing(false); }
  };

  const handleExtractMeta = async () => {
    setExtracting(true);
    try {
      await api.post('/sheets/extract-metadata/', { limit: 10 });
      setTimeout(() => { fetchMetaStatus(); setExtracting(false); }, 5000);
    } catch { setExtracting(false); }
  };

  // ── Modal "Solicitar más grabaciones" ─────────────────────────────
  const abrirSolicitud = (alerta) => {
    const texto = `📋 SOLICITUD DE GRABACIONES ADICIONALES
Fecha: ${new Date().toLocaleDateString('es-CO')}

Motivo: ${alerta.mensaje}

Se solicita al equipo de producción generar más grabaciones para cubrir
el desbalance detectado en el dataset de Fase 2 (Estilizado).

Por favor coordinar con el productor asignado.`;
    setModalSolicitud({ texto, titulo: alerta.accion || 'Solicitar más grabaciones' });
  };

  const copiarSolicitud = () => {
    if (!modalSolicitud) return;
    navigator.clipboard.writeText(modalSolicitud.texto).then(() => {
      alert('Texto copiado al portapapeles');
    });
  };

  const descargarSolicitud = () => {
    if (!modalSolicitud) return;
    const blob = new Blob([modalSolicitud.texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solicitud_grabaciones_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Pantallas de carga y error ────────────────────────────────────
  if (loading) return (
    <div className="resumen-page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ margin: '0 auto 20px', width: '50px', height: '50px', borderRadius: '50%', border: '3px solid rgba(188,19,254,0.2)', borderTopColor: '#bc13fe', animation: 'spin 1s linear infinite' }} />
        <h2 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '10px' }}>Cargando estadísticas...</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', margin: 0 }}>Analizando Excel y calculando métricas de balance.</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div className="resumen-page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', borderLeft: '4px solid #bc13fe' }}>
        <AlertTriangle size={48} color="#bc13fe" style={{ marginBottom: '15px' }} />
        <h2 style={{ color: 'white', fontSize: '1.4rem', marginBottom: '10px' }}>Error de Carga</h2>
        <p style={{ color: '#ffb3a7', fontSize: '0.95rem', marginBottom: '20px' }}>{error}</p>
        <button className="neon-button" onClick={fetchData}>REINTENTAR</button>
      </div>
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────
     COMPONENTES DE RENDERIZADO
  ─────────────────────────────────────────────────────────────────── */

  // Barra horizontal simple
  const BarraH = ({ label, value, maxVal, color, extra }) => {
    const pct = maxVal > 0 ? (value / maxVal) * 100 : 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
        <div style={{ width: '110px', fontSize: '0.82rem', color: '#fff', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.04)', height: '12px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color || `linear-gradient(to right, #00f2ff, #bc13fe)`, borderRadius: '5px', transition: 'width 0.6s ease' }}
            onMouseMove={e => showTip(e, label, extra || `${value}`)} onMouseLeave={hideTip} />
        </div>
        <div style={{ width: '35px', fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 'bold', textAlign: 'right' }}>{value}</div>
      </div>
    );
  };

  // Barra apilada multi-segmento
  const BarraApilada = ({ label, segmentos, total }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
      <div style={{ width: '80px', fontSize: '0.78rem', color: '#fff', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flexGrow: 1, height: '14px', borderRadius: '4px', display: 'flex', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {segmentos.map((seg, i) => seg.value > 0 && (
          <div key={i} style={{ width: `${(seg.value / (total || 1)) * 100}%`, height: '100%', backgroundColor: seg.color }}
            onMouseMove={e => showTip(e, `${label} — ${seg.label}`, `${seg.value} (${round((seg.value / (total || 1)) * 100, 1)}%)`)}
            onMouseLeave={hideTip} />
        ))}
      </div>
      <div style={{ width: '30px', fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>{total}</div>
    </div>
  );

  // KPI Card
  const KpiCard = ({ titulo, valor, subtitulo, color, icon: Icon }) => (
    <div className="kpi-card glass-panel" style={{ borderLeft: color ? `4px solid ${color}` : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>{titulo}</h3>
          <p className="kpi-value" style={{ color: color || 'white' }}>{valor}</p>
          {subtitulo && <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{subtitulo}</span>}
        </div>
        {Icon && <Icon size={22} color={color || 'rgba(255,255,255,0.2)'} />}
      </div>
    </div>
  );

  // Chip de leyenda
  const LegendChip = ({ color, label }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--text-dim)', marginRight: '12px' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: color, flexShrink: 0 }} />
      {label}
    </span>
  );

  // Donut de estados
  const DonutEstados = ({ data, total }) => {
    if (!data || total === 0) return null;
    const radius = 40, circ = 2 * Math.PI * radius;
    let accAngle = -90;
    return (
      <svg viewBox="0 0 120 120" width="160" height="160" style={{ overflow: 'visible', flexShrink: 0 }}>
        <circle cx="60" cy="60" r={radius} fill="transparent" stroke="rgba(255,255,255,0.04)" strokeWidth="14" />
        {data.map((s, i) => {
          const pct = s.value / (total || 1);
          const offset = circ - pct * circ;
          const rot = accAngle;
          accAngle += pct * 360;
          return (
            <circle key={i} cx="60" cy="60" r={radius} fill="transparent"
              stroke={s.color} strokeWidth="14"
              strokeDasharray={circ} strokeDashoffset={offset}
              transform={`rotate(${rot} 60 60)`} strokeLinecap="round"
              onMouseMove={e => showTip(e, s.label, `${s.value} (${s.percent}%)`)} onMouseLeave={hideTip}
            />
          );
        })}
        <text x="60" y="56" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{total}</text>
        <text x="60" y="70" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7">entradas</text>
      </svg>
    );
  };

  // Caja de alerta individual
  const AlertaBox = ({ alerta, mostrarBoton = false }) => {
    const color = SEVERIDAD_COLOR[alerta.tipo] || '#f39c12';
    return (
      <div className="glass-panel" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '14px 18px', borderLeft: `4px solid ${color}`, marginBottom: '12px' }}>
        <AlertTriangle size={18} color={color} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', color, letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
            {SEVERIDAD_ICON[alerta.tipo]} {alerta.tipo.toUpperCase()}
          </span>
          <p style={{ margin: 0, fontSize: '0.87rem', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5' }}>{alerta.mensaje}</p>
          {mostrarBoton && alerta.accion && (
            <button onClick={() => abrirSolicitud(alerta)} style={{ marginTop: '8px', fontSize: '0.72rem', padding: '4px 10px', borderRadius: '4px', border: `1px solid ${color}40`, background: `${color}10`, color, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Download size={12} /> Solicitar más grabaciones
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Filtros Multi-select ──────────────────────────────────────────
  const BotonesMulti = ({ campo, opciones, colorFn }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
      {opciones.map(op => {
        const activo = filtros[campo].includes(op);
        const color = colorFn ? colorFn(op) : '#bc13fe';
        return (
          <button key={op} onClick={() => toggleFiltro(campo, op)} style={{
            padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer',
            border: `1px solid ${activo ? color : 'rgba(255,255,255,0.12)'}`,
            background: activo ? `${color}25` : 'rgba(255,255,255,0.04)',
            color: activo ? color : 'var(--text-dim)',
            fontWeight: activo ? 'bold' : 'normal',
            transition: 'all 0.2s',
          }}>{op}</button>
        );
      })}
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────
     BARRA DE FILTROS (colapsable)
  ─────────────────────────────────────────────────────────────────── */
  const BarraFiltros = () => (
    <div className="glass-panel" style={{ marginBottom: '20px', padding: '16px 20px', border: filtrosActivos > 0 ? '1px solid rgba(188,19,254,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setFiltrosOpen(v => !v)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color={filtrosActivos > 0 ? '#bc13fe' : 'var(--text-dim)'} />
          <span style={{ fontSize: '0.85rem', color: filtrosActivos > 0 ? '#bc13fe' : 'var(--text-dim)', fontWeight: filtrosActivos > 0 ? 'bold' : 'normal' }}>
            Filtros del Dataset
            {filtrosActivos > 0 && (
              <span style={{ marginLeft: '8px', backgroundColor: '#bc13fe', color: 'white', borderRadius: '50%', fontSize: '0.65rem', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{filtrosActivos}</span>
            )}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            — mostrando {registrosFiltrados.length} de {rawData?.registrosCrudos?.length || 0} registros
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {filtrosActivos > 0 && (
            <button onClick={e => { e.stopPropagation(); limpiarFiltros(); }} style={{ fontSize: '0.72rem', color: '#ff4b2b', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
              <X size={12} style={{ verticalAlign: 'middle', marginRight: '3px' }} />Limpiar
            </button>
          )}
          {filtrosOpen ? <ChevronUp size={16} color="var(--text-dim)" /> : <ChevronDown size={16} color="var(--text-dim)" />}
        </div>
      </div>

      {filtrosOpen && (
        <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {/* Estilo */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Estilo Visual</label>
            <BotonesMulti campo="estilos" opciones={opcionesFiltros.estilos}
              colorFn={e => colorEstilo(e, rawData?.coloresEstilo, rawData?.estilosValidos)} />
          </div>
          {/* Productor */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Productor Principal</label>
            <BotonesMulti campo="productores" opciones={opcionesFiltros.productores}
              colorFn={p => (rawData?.coloresPorProductor || {})[p] || '#bc13fe'} />
          </div>
          {/* Sub-productor */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Sub-productor (Miembro)</label>
            <BotonesMulti campo="miembros" opciones={opcionesFiltros.miembros} />
          </div>
          {/* Estado */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Estado</label>
            <BotonesMulti campo="estados" opciones={opcionesFiltros.estados} colorFn={e => ({'Aceptado':'#2ecc71','Rechazado':'#ff4b2b','Duda':'#f39c12','Sin revisar':'#607d8b'}[e]||'#bc13fe')} />
          </div>
          {/* Mapa */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Mapa / Localización</label>
            <BotonesMulti campo="mapas" opciones={opcionesFiltros.mapas.slice(0, 15)} />
            {opcionesFiltros.mapas.length > 15 && <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>+{opcionesFiltros.mapas.length - 15} más...</span>}
          </div>
          {/* Especie */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Especie / Sujeto</label>
            <BotonesMulti campo="especies" opciones={opcionesFiltros.especies} colorFn={e => ({'Humano':'#00f2ff','Animal':'#2ecc71','Entorno':'#9b59b6'}[e]||'#bc13fe')} />
          </div>
          {/* Tiene arreglo */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Tiene Arreglo</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {[{ v: null, l: 'Todos' }, { v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => {
                const activo = filtros.tieneArreglo === v;
                return (
                  <button key={l} onClick={() => setFiltros(prev => ({ ...prev, tieneArreglo: v }))} style={{
                    padding: '3px 12px', borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer',
                    border: `1px solid ${activo ? '#00f2ff' : 'rgba(255,255,255,0.12)'}`,
                    background: activo ? 'rgba(0,242,255,0.15)' : 'rgba(255,255,255,0.04)',
                    color: activo ? '#00f2ff' : 'var(--text-dim)', fontWeight: activo ? 'bold' : 'normal',
                  }}>{l}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────
     SIDEBAR DE ALERTAS
  ─────────────────────────────────────────────────────────────────── */
  const SidebarAlertas = () => (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setAlertasSidebarOpen(v => !v)}
        style={{
          position: 'fixed', bottom: '30px', left: '20px', zIndex: 1000,
          width: '52px', height: '52px', borderRadius: '50%',
          background: alertasCrit.length > 0
            ? 'linear-gradient(135deg, #ff4b2b, #ff9800)'
            : 'linear-gradient(135deg, #f39c12, #e67e22)',
          border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,75,43,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Bell size={22} color="white" />
        {alertas.length > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            backgroundColor: alertasCrit.length > 0 ? '#ff4b2b' : '#f39c12',
            color: 'white', borderRadius: '50%', fontSize: '0.65rem',
            width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold', border: '2px solid #0d0d1a',
          }}>{alertas.length}</span>
        )}
      </button>

      {/* Panel lateral */}
      {alertasSidebarOpen && (
        <div style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, width: '380px',
          background: 'rgba(10, 10, 20, 0.97)', backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(188,19,254,0.2)', zIndex: 1001,
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
        }}>
          {/* Header del sidebar */}
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <h3 style={{ margin: 0, color: 'white', fontSize: '1rem' }}>🔔 Alertas Activas</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {alertasCrit.length > 0 && <span style={{ color: '#ff4b2b' }}>{alertasCrit.length} crítica(s) </span>}
                {alertasAdvert.length > 0 && <span style={{ color: '#f39c12' }}>{alertasAdvert.length} advert. </span>}
                {alertasInfo.length > 0 && <span style={{ color: '#2ecc71' }}>{alertasInfo.length} inform. </span>}
              </p>
            </div>
            <button onClick={() => setAlertasSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
              <X size={20} />
            </button>
          </div>

          {/* Resumen de severidades */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', gap: '12px', flexShrink: 0 }}>
            {[
              { tipo: 'critica', label: 'Críticas', cnt: alertasCrit.length },
              { tipo: 'advertencia', label: 'Advertencias', cnt: alertasAdvert.length },
              { tipo: 'informativa', label: 'Informativas', cnt: alertasInfo.length },
            ].map(({ tipo, label, cnt }) => (
              <div key={tipo} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '6px', backgroundColor: `${SEVERIDAD_COLOR[tipo]}10`, border: `1px solid ${SEVERIDAD_COLOR[tipo]}30` }}>
                <div style={{ fontSize: '1.3rem', color: SEVERIDAD_COLOR[tipo], fontWeight: 'bold' }}>{cnt}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Lista de alertas agrupadas por severidad */}
          <div style={{ padding: '16px', flex: 1 }}>
            {alertasCrit.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px', color: '#ff4b2b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🔴 Críticas</h4>
                {alertasCrit.map((a, i) => <AlertaBox key={i} alerta={a} mostrarBoton />)}
              </div>
            )}
            {alertasAdvert.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px', color: '#f39c12', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🟡 Advertencias</h4>
                {alertasAdvert.map((a, i) => <AlertaBox key={i} alerta={a} mostrarBoton />)}
              </div>
            )}
            {alertasInfo.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px', color: '#2ecc71', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🟢 Informativas</h4>
                {alertasInfo.map((a, i) => <AlertaBox key={i} alerta={a} />)}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Overlay */}
      {alertasSidebarOpen && (
        <div onClick={() => setAlertasSidebarOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)' }} />
      )}
    </>
  );

  /* ─────────────────────────────────────────────────────────────────
     MODAL "SOLICITAR MÁS GRABACIONES"
  ─────────────────────────────────────────────────────────────────── */
  const ModalSolicitud = () => {
    if (!modalSolicitud) return null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }}>
        <div className="glass-panel" style={{ width: '500px', maxWidth: '90vw', padding: '28px', borderTop: '3px solid #bc13fe' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '1rem' }}>📋 {modalSolicitud.titulo}</h3>
            <button onClick={() => setModalSolicitud(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>
              <X size={20} />
            </button>
          </div>
          <textarea readOnly value={modalSolicitud.texto} style={{ width: '100%', height: '200px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'rgba(255,255,255,0.85)', fontSize: '0.82rem', padding: '12px', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={copiarSolicitud} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(0,242,255,0.3)', background: 'rgba(0,242,255,0.1)', color: '#00f2ff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <Copy size={14} /> Copiar texto
            </button>
            <button onClick={descargarSolicitud} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid rgba(188,19,254,0.3)', background: 'rgba(188,19,254,0.1)', color: '#bc13fe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}>
              <Download size={14} /> Descargar .txt
            </button>
          </div>
        </div>
      </div>
    );
  };

  const { kpis, estilosData, estadosDonut, productores, subProductores,
          especiePorEstilo, generoPorEstilo, aceptacionPorEstilo,
          mapasStats, mapasGaps, camaraGlobal, arreglosPorEstilo,
          duracionPorEstilo, metadataStats, estilosValidos } = metricas;

  // cEst disponible en el scope del render (usa rawData del estado, no el del useMemo)
  const cEst = (est) => colorEstilo(est, rawData?.coloresEstilo, rawData?.estilosValidos);

  /* ─────────────────────────────────────────────────────────────────
     RENDER PRINCIPAL
  ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="resumen-page-container">
      {/* Tooltip global — pointerEvents none para no interceptar el mouse */}
      {tooltip.show && (
        <div className="chart-tooltip" style={{
          left: tooltip.x, top: tooltip.y,
          position: 'fixed', zIndex: 9999,
          pointerEvents: 'none',
        }}>
          <div className="tooltip-title">{tooltip.title}</div>
          <p className="tooltip-value">{tooltip.value}</p>
        </div>
      )}

      {/* Sidebar de alertas */}
      <SidebarAlertas />

      {/* Modal de solicitud */}
      <ModalSolicitud />

      {/* Botón INICIO */}
      <button onClick={() => navigate('/dashboard')} style={{
        position: 'fixed', top: '20px', left: '20px', zIndex: 999,
        background: 'transparent', border: '1px solid #bc13fe', color: '#bc13fe',
        padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold',
        boxShadow: '0 0 15px rgba(188,19,254,0.4)', display: 'inline-flex', alignItems: 'center', gap: '6px',
      }}>
        <ArrowLeft size={16} /> INICIO
      </button>

      {/* Botón ACTUALIZAR */}
      <button title="Refrescar datos desde el backend" disabled={loading} onClick={fetchData} style={{
        position: 'fixed', top: '20px', right: '20px', zIndex: 999,
        background: 'transparent', border: '1px solid #bc13fe', color: '#bc13fe',
        padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold',
        boxShadow: '0 0 15px rgba(188,19,254,0.4)', display: 'inline-flex', alignItems: 'center', gap: '8px',
        opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        <RefreshCw size={15} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
        {loading ? 'CARGANDO...' : 'ACTUALIZAR'}
      </button>

      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '30px', paddingTop: '10px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ background: 'linear-gradient(135deg, #bc13fe, #00f2ff)', borderRadius: '8px', padding: '6px 10px', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '2px' }}>FASE 2</span>
        </div>
        <h1 className="neon-title" style={{ background: 'linear-gradient(90deg, #bc13fe, #00f2ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px' }}>
          Estadísticas de Registro
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '1rem', letterSpacing: '1px' }}>
          Estilizado: {rawData?.estilosValidos?.join(' / ') || '...'} • {rawData?.kpis?.totalEntradas} entradas totales
          {filtrosActivos > 0 && (
            <span style={{ marginLeft: '12px', backgroundColor: 'rgba(188,19,254,0.15)', color: '#bc13fe', padding: '2px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 'bold' }}>
              🔍 {filtros.estilos.join(', ') || ''} — {registrosFiltrados.length} filtrados
            </span>
          )}
          {alertasCrit.length > 0 && (
            <span style={{ marginLeft: '12px', backgroundColor: 'rgba(255,75,43,0.15)', color: '#ff4b2b', padding: '2px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 'bold' }}>
              ⚠ {alertasCrit.length} crítica{alertasCrit.length > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </header>

      {/* KPIs reactivos */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '20px' }}>
        <KpiCard titulo="Entradas (filtro)" valor={kpis.totalEntradas} color="#bc13fe" icon={Layers} />
        <KpiCard titulo="Aceptados"   valor={kpis.totalAceptados}  color="#2ecc71" icon={Shield}        subtitulo={`${kpis.tasaAceptacion}% del total`} />
        <KpiCard titulo="Rechazados"  valor={kpis.totalRechazados} color="#ff4b2b" icon={AlertTriangle} subtitulo={`${kpis.tasaRechazados}% del total`} />
        <KpiCard titulo="En Duda"     valor={kpis.totalDuda}       color="#f39c12" icon={Activity}      subtitulo={`${kpis.tasaDuda}% del total`} />
        <KpiCard titulo="Sin Revisar" valor={kpis.totalSinRevisar} color="#607d8b" icon={Sliders}       subtitulo={`${kpis.tasaSinRevisar}% del total`} />
        <KpiCard titulo="Con Arreglo" valor={kpis.totalConArreglo} color="#00f2ff" icon={CheckSquare}   subtitulo={`${kpis.tasaConArreglo}% del total`} />
      </div>

      {/* Barra de filtros */}
      <BarraFiltros />

      {/* Pestañas de navegación */}
      <nav className="resumen-tabs" style={{ marginBottom: '30px' }}>
        {[
          { id: 'general',    label: 'General',       Icon: TrendingUp },
          { id: 'pipeline',   label: 'Pipeline',      Icon: Activity },
          { id: 'mapas',      label: 'Mapas',         Icon: MapPin },
          { id: 'especie',    label: 'Especie',       Icon: Users },
          { id: 'diversidad', label: 'Género & Etnia',Icon: BarChart2 },
          { id: 'tecnico',    label: 'Técnico',       Icon: Camera },
          { id: 'arreglos',   label: 'Arreglos',      Icon: Palette },
          { id: 'metadatos',  label: 'Metadatos',     Icon: Database },
          { id: 'sync',       label: 'Sync & Meta',   Icon: Link2 },
        ].map(({ id, label, Icon }) => {
          const alertasTab = alertas.filter(a => a.bloque === id);
          return (
            <button key={id} className={`tab-btn ${activeTab === id ? 'active' : ''}`}
              onClick={() => { setActiveTab(id); hideTip(); }}
              style={activeTab === id ? { borderColor: '#bc13fe', color: '#bc13fe', boxShadow: '0 0 12px rgba(188,19,254,0.4)' } : {}}>
              <Icon size={15} style={{ marginRight: '5px' }} /> {label}
              {alertasTab.length > 0 && (
                <span style={{ marginLeft: '5px', backgroundColor: alertasTab.some(a => a.tipo === 'critica') ? '#ff4b2b' : '#f39c12', color: 'white', borderRadius: '50%', fontSize: '0.6rem', width: '15px', height: '15px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {alertasTab.length}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ═══════════════════════════════════════════════════════════════
          PESTAÑA 1 — GENERAL
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'general' && (
        <section className="resumen-section">
          {alertasCrit.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ margin: '0 0 14px', color: '#ff4b2b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} /> Alertas Críticas del Dataset
              </h3>
              {alertasCrit.map((a, i) => <AlertaBox key={i} alerta={a} mostrarBoton />)}
            </div>
          )}

          <div className="charts-row">
            <div className="chart-card glass-panel">
              <h3>Distribución por Estilo Visual</h3>
              <p className="chart-subtitle">Cantidad de entradas por tipo de estilizado.</p>
              <div style={{ marginTop: '20px' }}>
                {estilosData.map(e => (
                  <BarraH key={e.label} label={e.label} value={e.value}
                    maxVal={Math.max(...estilosData.map(x => x.value))} color={e.color}
                    extra={`${e.value} entradas (${e.percent}%)`} />
                ))}
              </div>
              <div style={{ marginTop: '16px' }}>
                {estilosData.map(e => <LegendChip key={e.label} color={e.color} label={`${e.label}: ${e.percent}%`} />)}
              </div>
            </div>

            <div className="chart-card glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3>Estado de Aceptación Global</h3>
              <p className="chart-subtitle">Distribución de videos según estado de revisión.</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', marginTop: '20px', flexWrap: 'wrap' }}>
                <DonutEstados data={estadosDonut} total={kpis.totalEntradas} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {estadosDonut.map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: s.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.88rem', color: 'white', fontWeight: 'bold' }}>{s.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{s.value} entradas · {s.percent}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="charts-row" style={{ marginTop: '20px' }}>
            <div className="chart-card glass-panel">
              <h3>Productores Principales</h3>
              <p className="chart-subtitle">Entradas por productor principal (dinámico según el Excel).</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px' }}>
                {productores.map(p => (
                  <div key={p.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span style={{ color: p.color, fontWeight: 'bold' }}>{p.label}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{p.value} entradas · {p.percent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                      <div style={{ width: `${p.percent}%`, height: '100%', backgroundColor: p.color, borderRadius: '5px', boxShadow: `0 0 8px ${p.color}60` }}
                        onMouseMove={e => showTip(e, p.label, `${p.value} entradas (${p.percent}%)`)} onMouseLeave={hideTip} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-card glass-panel">
              <h3>Sub-productores (Miembros)</h3>
              <p className="chart-subtitle">Entradas por cada miembro del equipo.</p>
              <div style={{ marginTop: '20px' }}>
                {subProductores.map((s, i) => (
                  <BarraH key={s.label} label={s.label} value={s.value}
                    maxVal={Math.max(...subProductores.map(x => x.value))}
                    color={COLORES_MIEMBRO[i % COLORES_MIEMBRO.length]}
                    extra={`${s.value} entradas (${s.percent}%)`} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PESTAÑA 2 — PIPELINE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'pipeline' && (
        <section className="resumen-section">
          {alertas.filter(a => a.bloque === 'pipeline').map((a, i) => <AlertaBox key={i} alerta={a} />)}
          <div className="charts-row">
            <div className="chart-card glass-panel" style={{ minHeight: '400px' }}>
              <h3>Tasa de Aceptación por Estilo</h3>
              <p className="chart-subtitle">Porcentaje de entradas aceptadas por estilo visual.</p>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {aceptacionPorEstilo.map(e => (
                  <div key={e.estilo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                      <span style={{ color: e.color, fontWeight: 'bold' }}>{e.estilo}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{e.total} entradas</span>
                    </div>
                    <BarraApilada label="" total={e.total} segmentos={[
                      { label: 'Aceptado',    value: e.aceptados,  color: '#2ecc71' },
                      { label: 'Duda',        value: e.duda,       color: '#f39c12' },
                      { label: 'Rechazado',   value: e.rechazados, color: '#ff4b2b' },
                      { label: 'Sin revisar', value: e.sinRevisar, color: '#607d8b' },
                    ]} />
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                      <span>✅ {e.aceptados} ({e.tasaAceptacion}%)</span>
                      <span>❓ {e.duda}</span>
                      <span>❌ {e.rechazados}</span>
                      <span>⬜ {e.sinRevisar}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <LegendChip color="#2ecc71" label="Aceptado" />
                <LegendChip color="#f39c12" label="Duda" />
                <LegendChip color="#ff4b2b" label="Rechazado" />
                <LegendChip color="#607d8b" label="Sin revisar" />
              </div>
            </div>
            <div className="chart-card glass-panel">
              <h3>Arreglos por Estilo</h3>
              <p className="chart-subtitle">Porcentaje de entradas con imagen o video de arreglo.</p>
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {arreglosPorEstilo.map(e => (
                  <div key={e.estilo}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span style={{ color: e.color, fontWeight: 'bold' }}>{e.estilo}</span>
                      <span style={{ color: e.pctArreglo > 20 ? '#2ecc71' : '#f39c12', fontWeight: 'bold' }}>{e.pctArreglo}%</span>
                    </div>
                    <BarraApilada label="" total={e.total} segmentos={[
                      { label: 'Con arreglo', value: e.conArreglo, color: e.color },
                      { label: 'Sin arreglo', value: e.total - e.conArreglo, color: 'rgba(255,255,255,0.06)' },
                    ]} />
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                      {e.conArreglo} con arreglo de {e.total} total
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PESTAÑA 3 — MAPAS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'mapas' && (
        <section className="resumen-section">
          {alertas.filter(a => a.bloque === 'mapas').map((a, i) => <AlertaBox key={i} alerta={a} mostrarBoton />)}
          <div className="charts-row">
            <div className="chart-card glass-panel" style={{ minHeight: '500px', overflowX: 'auto' }}>
              <h3>Heatmap: Estilo × Mapa</h3>
              <p className="chart-subtitle">Videos estilizados por localización y estilo (filtros activos).</p>
              {mapasStats.length > 0 ? (
                <div style={{ marginTop: '20px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ padding: '8px 10px', color: 'var(--text-dim)', textAlign: 'left', minWidth: '110px' }}>MAPA</th>
                        {estilosValidos.map(est => (
                          <th key={est} style={{ padding: '8px 10px', color: cEst(est), textAlign: 'center' }}>{est}</th>
                        ))}
                        <th style={{ padding: '8px 10px', color: 'white', textAlign: 'center' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapasStats.slice(0, 25).map((m, i) => (
                        <tr key={m.mapa} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ padding: '7px 10px', color: 'white', fontWeight: '500', whiteSpace: 'nowrap' }}>{m.mapa}</td>
                          {estilosValidos.map(est => {
                            const cnt = m[est.toLowerCase()] || 0;
                            const maxCell = Math.max(...mapasStats.map(ms => ms[est.toLowerCase()] || 0), 1);
                            const intensity = cnt / maxCell;
                            return (
                              <td key={est} style={{ padding: '7px 10px', textAlign: 'center' }}
                                onMouseMove={e => showTip(e, `${m.mapa} — ${est}`, `${cnt} entradas`)} onMouseLeave={hideTip}>
                                <span style={{
                                  display: 'inline-block', minWidth: '28px', padding: '2px 6px', borderRadius: '4px',
                                  backgroundColor: cnt > 0 ? `${cEst(est)}${Math.round(intensity * 80 + 30).toString(16).padStart(2, '0')}` : 'rgba(255,255,255,0.04)',
                                  color: cnt > 0 ? 'white' : 'rgba(255,255,255,0.2)', fontWeight: cnt > 0 ? 'bold' : 'normal',
                                }}>{cnt > 0 ? cnt : '—'}</span>
                              </td>
                            );
                          })}
                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 'bold', color: 'white' }}>{m.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: 'var(--text-dim)', marginTop: '20px', textAlign: 'center', fontStyle: 'italic' }}>No hay datos de mapa con los filtros actuales.</p>
              )}
            </div>
            <div className="chart-card glass-panel">
              <h3>Gaps de Cobertura</h3>
              <p className="chart-subtitle">Mapas sin videos en algún estilo visual.</p>
              <div style={{ marginTop: '20px', maxHeight: '400px', overflowY: 'auto' }}>
                {mapasGaps.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#2ecc71' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>¡Todos los mapas tienen cobertura!</p>
                  </div>
                ) : mapasGaps.map((gap, i) => (
                  <div key={i} style={{ padding: '10px 14px', marginBottom: '8px', backgroundColor: 'rgba(255,75,43,0.06)', border: '1px solid rgba(255,75,43,0.15)', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.87rem', color: 'white', marginBottom: '4px' }}>{gap.mapa}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {gap.estilosFaltantes.map(est => (
                        <span key={est} style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: `${cEst(est)}20`, color: cEst(est), border: `1px solid ${cEst(est)}40` }}>sin {est}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PESTAÑA 4 — ESPECIE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'especie' && (
        <section className="resumen-section">
          {alertas.filter(a => a.bloque === 'especie').map((a, i) => <AlertaBox key={i} alerta={a} />)}
          <div className="charts-row">
            <div className="chart-card glass-panel">
              <h3>Distribución de Especie por Estilo</h3>
              <p className="chart-subtitle">Balance Humano / Animal / Entorno en cada estilo.</p>
              <div style={{ marginTop: '20px' }}>
                {especiePorEstilo.map(e => (
                  <div key={e.estilo} style={{ marginBottom: '22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                      <span style={{ color: e.color, fontWeight: 'bold' }}>{e.estilo}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{e.total} entradas</span>
                    </div>
                    <BarraApilada label="" total={e.total} segmentos={[
                      { label: 'Humano',  value: e.humano,  color: '#00f2ff' },
                      { label: 'Animal',  value: e.animal,  color: '#2ecc71' },
                      { label: 'Entorno', value: e.entorno, color: '#9b59b6' },
                    ]} />
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ color: '#00f2ff' }}>Humano: {e.humano} ({e.pctHumano}%)</span>
                      <span style={{ color: '#2ecc71' }}>Animal: {e.animal} ({e.pctAnimal}%)</span>
                      <span style={{ color: '#9b59b6' }}>Entorno: {e.entorno} ({e.pctEntorno}%)</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <LegendChip color="#00f2ff" label="Humano" />
                <LegendChip color="#2ecc71" label="Animal" />
                <LegendChip color="#9b59b6" label="Entorno/Sin sujeto" />
              </div>
            </div>
            <div className="chart-card glass-panel">
              <h3>Tabla Resumen de Especie</h3>
              <p className="chart-subtitle">Valores absolutos y porcentajes por estilo visual.</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', marginTop: '20px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Estilo', 'Total', 'Humano', 'Animal', 'Entorno', '% Animal'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', color: 'var(--text-dim)', textAlign: 'left', fontWeight: '600', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {especiePorEstilo.map(e => (
                    <tr key={e.estilo} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '8px 10px', color: e.color, fontWeight: 'bold' }}>{e.estilo}</td>
                      <td style={{ padding: '8px 10px', color: 'white' }}>{e.total}</td>
                      <td style={{ padding: '8px 10px', color: '#00f2ff' }}>{e.humano}</td>
                      <td style={{ padding: '8px 10px', color: '#2ecc71' }}>{e.animal}</td>
                      <td style={{ padding: '8px 10px', color: '#9b59b6' }}>{e.entorno}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ color: e.pctAnimal < 20 ? '#ff4b2b' : '#2ecc71', fontWeight: 'bold' }}>{e.pctAnimal}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PESTAÑA 5 — DIVERSIDAD (GÉNERO & ETNIA)
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'diversidad' && (
        <section className="resumen-section">
          {alertas.filter(a => a.bloque === 'diversidad').map((a, i) => <AlertaBox key={i} alerta={a} />)}
          <div className="charts-row">
            <div className="chart-card glass-panel">
              <h3>Género × Estilo (solo Humanos)</h3>
              <p className="chart-subtitle">Balance Hombre / Mujer por estilo visual (umbral 60/40).</p>
              <div style={{ marginTop: '20px' }}>
                {generoPorEstilo.map(e => (
                  <div key={e.estilo} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '6px' }}>
                      <span style={{ color: e.color, fontWeight: 'bold' }}>{e.estilo}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{e.totalHumanos} humanos</span>
                    </div>
                    <BarraApilada label="" total={e.totalHumanos} segmentos={[
                      { label: 'Hombre', value: e.hombres, color: '#00f2ff' },
                      { label: 'Mujer',  value: e.mujeres, color: '#e91e63' },
                    ]} />
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', display: 'flex', gap: '14px', marginTop: '4px' }}>
                      <span style={{ color: e.pctHombres > 60 ? '#ff4b2b' : '#00f2ff' }}>♂ {e.hombres} ({e.pctHombres}%)</span>
                      <span style={{ color: '#e91e63' }}>♀ {e.mujeres} ({e.pctMujeres}%)</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                <LegendChip color="#00f2ff" label="Hombre" />
                <LegendChip color="#e91e63" label="Mujer" />
              </div>
            </div>
            <div className="chart-card glass-panel">
              <h3>Etnia × Estilo (solo Humanos)</h3>
              <p className="chart-subtitle">Balance Blanco / Moreno por estilo visual (umbral 65/35).</p>
              <div style={{ marginTop: '20px' }}>
                {generoPorEstilo.map(e => (
                  <div key={e.estilo} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '6px' }}>
                      <span style={{ color: e.color, fontWeight: 'bold' }}>{e.estilo}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{e.totalHumanos} humanos</span>
                    </div>
                    <BarraApilada label="" total={e.totalHumanos} segmentos={[
                      { label: 'Blanco', value: e.blanco, color: '#f39c12' },
                      { label: 'Moreno', value: e.moreno, color: '#8e44ad' },
                    ]} />
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', display: 'flex', gap: '14px', marginTop: '4px' }}>
                      <span style={{ color: e.pctBlanco > 65 ? '#ff4b2b' : '#f39c12' }}>Blanco: {e.blanco} ({e.pctBlanco}%)</span>
                      <span style={{ color: '#8e44ad' }}>Moreno: {e.moreno} ({e.pctMoreno}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PESTAÑA 6 — TÉCNICO
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'tecnico' && (
        <section className="resumen-section">
          {alertas.filter(a => a.bloque === 'tecnico').map((a, i) => <AlertaBox key={i} alerta={a} />)}

          <div className="charts-row">
            <div className="chart-card glass-panel">
              <h3>Movimiento de Cámara (Global)</h3>
              <p className="chart-subtitle">Distribución de tipos de cámara en los videos del dataset.</p>
              <div style={{ marginTop: '20px' }}>
                {camaraGlobal.map(c => (
                  <BarraH key={c.label} label={c.label} value={c.value}
                    maxVal={Math.max(...camaraGlobal.map(x => x.value))}
                    extra={`${c.value} entradas (${c.percent}%)`} />
                ))}
              </div>
            </div>

            {/* Comparativa de duración original vs estilizado */}
            <div className="chart-card glass-panel">
              <h3>⏱ Duración Original vs Estilizado</h3>
              <p className="chart-subtitle">Comparativa por estilo (requiere extracción de metadatos).</p>
              {duracionPorEstilo.every(d => d.conDatos === 0) ? (
                <div style={{ marginTop: '30px', textAlign: 'center', padding: '20px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Clock size={32} color="var(--text-dim)" style={{ marginBottom: '12px' }} />
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', margin: 0 }}>
                    Sin datos de duración aún.<br/>
                    Ve a la pestaña <strong style={{ color: '#bc13fe' }}>Sync & Meta</strong> y ejecuta la extracción de metadatos.
                  </p>
                </div>
              ) : (
                <div style={{ marginTop: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Estilo', 'Orig. (s)', 'Estil. (s)', '% Retención', 'Alertas'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', color: 'var(--text-dim)', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {duracionPorEstilo.map(d => (
                        <tr key={d.estilo} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 10px', color: d.color, fontWeight: 'bold' }}>{d.estilo}</td>
                          <td style={{ padding: '8px 10px', color: 'white' }}>{d.avgDurOriginal ?? '—'}</td>
                          <td style={{ padding: '8px 10px', color: 'white' }}>{d.avgDurEstilizado ?? '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {d.pctRetencion != null
                              ? <span style={{ color: d.pctRetencion < 80 ? '#ff4b2b' : '#2ecc71', fontWeight: 'bold' }}>{d.pctRetencion}%</span>
                              : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {d.videosConAlerta > 0
                              ? <span style={{ color: '#ff4b2b', fontWeight: 'bold' }}>⚠ {d.videosConAlerta}</span>
                              : <span style={{ color: '#2ecc71' }}>✅ 0</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Alertas de duración */}
                  {alertas.filter(a => a.bloque === 'duracion').length > 0 && (
                    <div style={{ marginTop: '20px' }}>
                      <h4 style={{ margin: '0 0 10px', color: '#f39c12', fontSize: '0.85rem' }}>⏱ Alertas de Duración</h4>
                      {alertas.filter(a => a.bloque === 'duracion').slice(0, 5).map((a, i) => <AlertaBox key={i} alerta={a} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PESTAÑA 7 — ARREGLOS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'arreglos' && (
        <section className="resumen-section">
          {alertas.filter(a => a.bloque === 'arreglos').map((a, i) => <AlertaBox key={i} alerta={a} />)}
          <div className="charts-row">
            <div className="chart-card glass-panel">
              <h3>Arreglos por Estilo (Detallado)</h3>
              <p className="chart-subtitle">Entradas con imagen, video y prompt de arreglo por estilo visual.</p>
              <div style={{ marginTop: '20px' }}>
                {(rawData?.arreglosPorEstilo || []).map(e => (
                  <div key={e.estilo} style={{ marginBottom: '22px', padding: '14px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: `1px solid ${e.color}20` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ color: e.color, fontWeight: 'bold' }}>{e.estilo}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{e.total} entradas</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {[
                        { label: 'Img Arreglo', pct: e.pctImgArreglo, color: '#00f2ff' },
                        { label: 'Vid Arreglo', pct: e.pctVidArreglo, color: '#bc13fe' },
                        { label: 'Prompt Final', pct: e.pctPromptFinal, color: '#2ecc71' },
                      ].map(({ label, pct, color }) => (
                        <div key={label} style={{ flex: 1, minWidth: '100px', padding: '8px', backgroundColor: `${color}10`, borderRadius: '6px', border: `1px solid ${color}20`, textAlign: 'center' }}>
                          <div style={{ fontSize: '1.1rem', color, fontWeight: 'bold' }}>{pct}%</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="chart-card glass-panel">
              <h3>Top Miembros por Arreglos</h3>
              <p className="chart-subtitle">Miembros con mayor porcentaje de videos con arreglos completados.</p>
              <div style={{ marginTop: '20px' }}>
                {(rawData?.topArreglosMiembro || []).map((m, i) => (
                  <BarraH key={m.miembro} label={m.miembro} value={m.tasaArreglos}
                    maxVal={100} color={COLORES_MIEMBRO[i % COLORES_MIEMBRO.length]}
                    extra={`${m.conArreglos} de ${m.total} (${m.tasaArreglos}%)`} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PESTAÑA 8 — METADATOS DE VIDEO
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'metadatos' && (
        <MetadatosTab
          metadataStats={metadataStats}
          duracionPorEstilo={duracionPorEstilo}
          showTip={showTip}
          hideTip={hideTip}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          PESTAÑA 9 — SYNC & METADATOS
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'sync' && (
        <section className="resumen-section">
          <div className="charts-row">
            {/* Sync desde Google Sheets */}
            <div className="chart-card glass-panel" style={{ borderTop: '2px solid #00f2ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Link2 size={20} color="#00f2ff" />
                <h3 style={{ margin: 0 }}>Sincronizar desde Google Sheets</h3>
              </div>
              <p className="chart-subtitle">Actualiza el Excel local con los datos más recientes del Sheets.</p>

              <div style={{ margin: '20px 0', padding: '14px', backgroundColor: 'rgba(0,242,255,0.05)', borderRadius: '8px', border: '1px solid rgba(0,242,255,0.1)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '8px' }}>📋 Fuente de datos:</div>
                <a href="https://docs.google.com/spreadsheets/d/1Ga5zMekIlVjHKhxkfGBIhAiCh0H3zGYf0TOoMkoctj4/edit?gid=2173056"
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: '#00f2ff', fontSize: '0.78rem', wordBreak: 'break-all' }}>
                  MATEO REGISTRO PARAMETROS — Google Sheets
                </a>
              </div>

              {syncStatus && (
                <div style={{ marginBottom: '16px', padding: '14px', backgroundColor: syncStatus.error ? 'rgba(255,75,43,0.08)' : 'rgba(46,204,113,0.08)', borderRadius: '8px', border: `1px solid ${syncStatus.error ? 'rgba(255,75,43,0.2)' : 'rgba(46,204,113,0.2)'}` }}>
                  {syncStatus.error ? (
                    <p style={{ margin: 0, color: '#ff4b2b', fontSize: '0.85rem' }}>❌ {syncStatus.error}</p>
                  ) : (
                    <div style={{ fontSize: '0.82rem' }}>
                      <div style={{ color: '#2ecc71', fontWeight: 'bold', marginBottom: '6px' }}>✅ Sincronización exitosa</div>
                      <div style={{ color: 'var(--text-dim)' }}>🆕 Filas nuevas: <strong style={{ color: 'white' }}>{syncStatus.nuevas}</strong></div>
                      <div style={{ color: 'var(--text-dim)' }}>🔄 Actualizadas: <strong style={{ color: 'white' }}>{syncStatus.actualizadas}</strong></div>
                      <div style={{ color: 'var(--text-dim)' }}>📊 Total Sheets: <strong style={{ color: 'white' }}>{syncStatus.totalSheets}</strong></div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '4px' }}>⏰ {syncStatus.timestamp?.replace('T', ' ').slice(0, 19)}</div>
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleSync} disabled={syncing} style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                background: syncing ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(0,242,255,0.05))',
                border: '1px solid rgba(0,242,255,0.3)', color: syncing ? 'var(--text-dim)' : '#00f2ff',
                cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s',
              }}>
                <RefreshCw size={16} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
            </div>

            {/* Extracción de metadatos */}
            <div className="chart-card glass-panel" style={{ borderTop: '2px solid #bc13fe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Clock size={20} color="#bc13fe" />
                <h3 style={{ margin: 0 }}>Extraer Metadatos de Video</h3>
              </div>
              <p className="chart-subtitle">Extrae duración, resolución y FPS de los videos de Drive usando yt-dlp.</p>

              {/* Estado de la caché */}
              {metaStatus && (
                <div style={{ margin: '20px 0', padding: '14px', backgroundColor: 'rgba(188,19,254,0.05)', borderRadius: '8px', border: '1px solid rgba(188,19,254,0.1)' }}>
                  {metaStatus.ok ? (
                    <div style={{ fontSize: '0.82rem' }}>
                      <div style={{ color: '#bc13fe', fontWeight: 'bold', marginBottom: '8px' }}>📦 Estado de la caché:</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div style={{ color: 'var(--text-dim)' }}>Videos procesados: <strong style={{ color: 'white' }}>{metaStatus.totalVideos}</strong></div>
                        <div style={{ color: 'var(--text-dim)' }}>Videos OK: <strong style={{ color: '#2ecc71' }}>{metaStatus.videosOk}</strong></div>
                        <div style={{ color: 'var(--text-dim)' }}>Imágenes: <strong style={{ color: 'white' }}>{metaStatus.totalImagenes}</strong></div>
                        <div style={{ color: 'var(--text-dim)' }}>Imágenes OK: <strong style={{ color: '#2ecc71' }}>{metaStatus.imagenesOk}</strong></div>
                      </div>
                      {metaStatus.lastUpdated && (
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', marginTop: '6px' }}>
                          ⏰ Actualizado: {metaStatus.lastUpdated.replace('T', ' ').slice(0, 19)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                      📭 {metaStatus.mensaje}
                    </p>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.78rem', color: 'var(--text-dim)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <strong style={{ color: 'white' }}>⚠ Nota:</strong> La extracción procesa de 10 en 10 videos en segundo plano usando yt-dlp.
                Los videos de Drive públicos pueden tardar ~10-30s cada uno.
                Recarga el estado con el botón de abajo para ver el progreso.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={handleExtractMeta} disabled={extracting} style={{
                  width: '100%', padding: '12px', borderRadius: '8px',
                  background: extracting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, rgba(188,19,254,0.15), rgba(188,19,254,0.05))',
                  border: '1px solid rgba(188,19,254,0.3)', color: extracting ? 'var(--text-dim)' : '#bc13fe',
                  cursor: extracting ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s',
                }}>
                  <Activity size={16} style={{ animation: extracting ? 'spin 1s linear infinite' : 'none' }} />
                  {extracting ? 'Extrayendo en segundo plano...' : 'Extraer metadatos (10 videos)'}
                </button>
                <button onClick={fetchMetaStatus} style={{
                  width: '100%', padding: '10px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.82rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                  <RefreshCw size={13} /> Actualizar estado de caché
                </button>
              </div>

              {extracting && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(188,19,254,0.05)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#bc13fe', marginBottom: '8px' }}>⏳ Procesando en segundo plano...</div>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-dim)' }}>El estado se actualizará automáticamente en 5 segundos.</p>
                </div>
              )}
            </div>
          </div>

          {/* Instrucción para management commands */}
          <div className="glass-panel" style={{ marginTop: '20px', padding: '20px', borderLeft: '3px solid #f39c12' }}>
            <h4 style={{ margin: '0 0 12px', color: '#f39c12', fontSize: '0.9rem' }}>💻 Comandos de Línea de Comandos (más rápidos)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { cmd: 'python manage.py sync_registro', desc: 'Sincroniza el Excel local con el Google Sheets' },
                { cmd: 'python manage.py sync_registro --dry-run', desc: 'Ver cambios sin modificar el Excel' },
                { cmd: 'python manage.py extract_metadata', desc: 'Extrae metadatos de todos los videos Drive' },
                { cmd: 'python manage.py extract_metadata --limit 5', desc: 'Extrae solo 5 videos (para prueba)' },
                { cmd: 'python manage.py extract_metadata --id 62', desc: 'Extrae metadatos del registro ID 62' },
              ].map(({ cmd, desc }) => (
                <div key={cmd} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.78rem', color: '#00f2ff', whiteSpace: 'nowrap', border: '1px solid rgba(0,242,255,0.15)' }}>{cmd}</code>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>— {desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Estadisticas;
