import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, CheckCircle, Users, LogOut,
  BookOpen, BarChart2, Layers, Clapperboard,
  ExternalLink, Unlock, Play, Camera,
} from 'lucide-react';
import AppNavbar from '../components/AppNavbar';
import api from '../utils/api';
import { useUser } from '../context/UserContext';
import { useApiKey } from '../context/ApiKeyContext';

const GRADIO_BASE = 'http://mysther-ai-alb-1734290767.eu-central-1.elb.amazonaws.com:7860';

const extractDriveID = (url) => {
  if (!url) return null;
  const m = url.match(/(?:file\/d\/|id=|\/folders\/|open\?id=)([a-zA-Z0-9_-]{25,})/);
  return m ? m[1] : null;
};
const thumbUrl = (url) => {
  const id = extractDriveID(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : null;
};

/* Renders Drive videos via iframe preview; direct URLs (CloudFront etc.) via <video> */
const VideoPlayer = ({ url, style }) => {
  const driveId = extractDriveID(url);
  if (driveId) {
    return <iframe src={`https://drive.google.com/file/d/${driveId}/preview`} allow="autoplay"
      style={{ border: 'none', width: '100%', aspectRatio: '16/9', ...style }} title="video" />;
  }
  return <video src={url} controls style={{ width: '100%', background: '#000', ...style }} />;
};

const resizeImage = (file, maxPx = 300) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(img.width  * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    resolve(canvas.toDataURL('image/jpeg', 0.85));
  };
  img.onerror = reject;
  img.src = url;
});

const MODULES = [
  { label: 'Catálogo',   path: '/censo',        icon: <Video size={16} /> },
  { label: 'Biblioteca', path: '/registro',     icon: <BookOpen size={16} /> },
  { label: 'Panorama',   path: '/resumen',      icon: <Layers size={16} /> },
  { label: 'Análisis',   path: '/estadisticas', icon: <BarChart2 size={16} /> },
  { label: 'Estudio AI', path: '/herramienta',  icon: <Clapperboard size={16} /> },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useUser();
  const { apiKey } = useApiKey();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState(null); // set after user loads
  const [liberando, setLiberando]     = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [regFilter, setRegFilter]     = useState('Todos');
  const [selectedReg, setSelectedReg] = useState(null);
  const [regComment, setRegComment]   = useState('');
  const [regLoading, setRegLoading]   = useState(false);
  const [errores, setErrores]         = useState([]);
  const [errFilter, setErrFilter]     = useState('');
  const [asignando, setAsignando]     = useState(false);
  const [asignResult, setAsignResult] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/auth/profile-data/')
      .then(r => {
        setData(r.data);
        // Default tab: admin sees team registro first; regular users see their reserves
        setTab(r.data?.user?.is_staff ? 'equipo_registro' : 'reservados');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => { await logout(); navigate('/'); };

  const handleAsignarCenso = async () => {
    if (!window.confirm('¿Repartir TODOS los videos disponibles del censo entre los miembros del equipo?')) return;
    setAsignando(true);
    try {
      const r = await api.post('/sheets/asignar-censo/');
      setAsignResult(r.data);
      const p = await api.get('/auth/profile-data/');
      setData(p.data);
    } catch (e) { alert(e.response?.data?.error || 'Error al repartir el censo.'); }
    finally { setAsignando(false); }
  };

  const handleLiberar = async (videoId) => {
    setLiberando(videoId);
    try {
      await api.post(`/sheets/videos/${videoId}/liberar/`);
      const r = await api.get('/auth/profile-data/');
      setData(r.data);
    } catch (err) { alert(err.response?.data?.error || 'Error al liberar.'); }
    finally { setLiberando(null); }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const base64 = await resizeImage(file, 300);
      await api.post('/auth/avatar/', { avatar: base64 });
      setUser(prev => ({ ...prev, avatar: base64 }));
    } catch (err) {
      alert('No se pudo guardar la foto. Intenta de nuevo.');
      console.error('Avatar upload error:', err);
    }
    finally { setAvatarUploading(false); }
  };

  const gradioUrl = (dl, vid_id) =>
    `${GRADIO_BASE}/?video_url=${encodeURIComponent(dl || '')}&usuario=${encodeURIComponent(user?.display_name || '')}&video_id=${encodeURIComponent(vid_id || '')}`;

  useEffect(() => {
    if (!user?.is_staff) return;
    api.get('/sheets/gradio-errors/').then(r => setErrores(r.data)).catch(() => {});
  }, [user]);

  const reloadRegistro = async () => {
    const r = await api.get('/auth/profile-data/');
    setData(r.data);
  };

  const handleRegAprobar = async () => {
    if (!selectedReg) return;
    setRegLoading(true);
    try {
      await api.post(`/sheets/videos/${selectedReg.id}/aprobar/`, { comentario: regComment });
      const updated = { ...selectedReg, estado_revision: 'Aprobado', comentario_revision: regComment || null };
      setSelectedReg(updated);
      await reloadRegistro();
    } catch (e) { alert(e.response?.data?.error || 'Error al aprobar.'); }
    finally { setRegLoading(false); }
  };

  const handleRegDenegar = async () => {
    if (!selectedReg) return;
    if (!regComment.trim()) { alert('Escribe un comentario antes de denegar.'); return; }
    setRegLoading(true);
    try {
      const res = await api.post(`/sheets/videos/${selectedReg.id}/denegar/`, { comentario: regComment });
      if (res.data?.accion === 'eliminado') {
        setSelectedReg(null);
      } else {
        setSelectedReg({ ...selectedReg, estado_revision: 'Rechazado', comentario_revision: regComment });
      }
      await reloadRegistro();
    } catch (e) { alert(e.response?.data?.error || 'Error al denegar.'); }
    finally { setRegLoading(false); }
  };

  const handleRegEliminar = async () => {
    if (!selectedReg) return;
    if (!window.confirm(`¿Eliminar definitivamente el registro #${selectedReg.video_id}?`)) return;
    setRegLoading(true);
    try {
      await api.delete(`/sheets/videos/${selectedReg.id}/`);
      setSelectedReg(null);
      await reloadRegistro();
    } catch (e) { alert('Error al eliminar.'); }
    finally { setRegLoading(false); }
  };

  const initials        = (user?.display_name || 'U').slice(0, 2).toUpperCase();
  const reserved        = data?.reserved        || [];
  const stylized        = data?.stylized        || [];
  const allReservations = data?.all_reservations || [];
  const allRegistro     = data?.all_registro     || [];

  const TABS = user?.is_staff ? [
    { key: 'equipo_registro', label: 'Estilizados Equipo', count: allRegistro.length,     icon: <CheckCircle size={14} /> },
    { key: 'equipo',          label: 'Reservas Equipo',    count: allReservations.length, icon: <Users size={14} /> },
    { key: 'errores',         label: 'Errores',            count: errores.length,         icon: <Video size={14} /> },
  ] : [
    { key: 'reservados',  label: 'Mis Reservas', count: reserved.length,  icon: <Video size={14} /> },
    { key: 'estilizados', label: 'Estilizados',  count: stylized.length,  icon: <CheckCircle size={14} /> },
  ];

  return (
    <>
      <AppNavbar backTo="/dashboard" />

      {/* ── Admin: registro detail modal ── */}
      {selectedReg && (
        <div onClick={() => setSelectedReg(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: '90%', maxWidth: '960px', maxHeight: '90vh', overflowY: 'auto',
            background: '#111', border: '1px solid #1c1c1c', borderRadius: '16px',
            padding: '28px', position: 'relative',
          }}>
            <button onClick={() => setSelectedReg(null)} style={{
              position: 'absolute', top: '14px', right: '18px',
              background: 'none', border: 'none', color: '#555', fontSize: '22px', cursor: 'pointer',
            }}>×</button>

            {/* Header */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '10px', color: '#444', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 4px' }}>
                REGISTRO · {selectedReg.usuario || '—'}
              </p>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#e0e0e0', margin: 0, fontFamily: 'monospace' }}>
                #{selectedReg.id_video_equipo || selectedReg.video_id}
                {selectedReg.estilizado && <span style={{ marginLeft: '10px', fontSize: '13px', color: '#a78bfa', fontWeight: 600 }}>{selectedReg.estilizado}</span>}
              </h3>
            </div>

            {/* Original vs Estilizado — lado a lado */}
            {(selectedReg.video_original_link || selectedReg.drive_link) && (
              <div style={{ display: 'grid', gridTemplateColumns: selectedReg.video_original_link && selectedReg.drive_link ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '12px' }}>
                {selectedReg.video_original_link && (
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: '9px', color: '#555', letterSpacing: '2px', fontWeight: 700 }}>ORIGINAL (CENSO)</p>
                    <VideoPlayer url={selectedReg.video_original_link} style={{ borderRadius: '10px', maxHeight: '300px' }} />
                  </div>
                )}
                {selectedReg.drive_link && (
                  <div>
                    <p style={{ margin: '0 0 6px', fontSize: '9px', color: '#a78bfa', letterSpacing: '2px', fontWeight: 700 }}>ESTILIZADO</p>
                    <VideoPlayer url={selectedReg.drive_link} style={{ borderRadius: '10px', maxHeight: '300px' }} />
                  </div>
                )}
              </div>
            )}
            {/* Imagen estilizada */}
            {selectedReg.imagen_link && (() => {
              const th = thumbUrl(selectedReg.imagen_link) || selectedReg.imagen_link;
              return <img src={th} alt="" style={{ width: '100%', borderRadius: '10px', marginBottom: '16px', maxHeight: '260px', objectFit: 'cover' }} />;
            })()}
            {/* Prompts */}
            {(selectedReg.prompt_imagen || selectedReg.prompt_video) && (
              <div style={{ marginBottom: '16px', padding: '12px', background: '#0d0d0d', borderRadius: '8px', border: '1px solid #1a1a1a' }}>
                {selectedReg.prompt_imagen && (
                  <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#555', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    PROMPT IMAGEN <span style={{ color: '#888', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>"{selectedReg.prompt_imagen}"</span>
                  </p>
                )}
                {selectedReg.prompt_video && (
                  <p style={{ margin: 0, fontSize: '11px', color: '#555', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    PROMPT VIDEO <span style={{ color: '#888', textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>"{selectedReg.prompt_video}"</span>
                  </p>
                )}
              </div>
            )}

            {/* Current status */}
            {(() => {
              const rev = selectedReg.estado_revision || 'Pendiente';
              const revColor = { Pendiente: '#f59e0b', Aprobado: '#22c55e', Rechazado: '#ef4444' }[rev];
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                  <span style={{ fontSize: '9px', color: '#444', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 700 }}>ESTADO</span>
                  <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: `${revColor}22`, color: revColor, border: `1px solid ${revColor}44` }}>
                    {rev.toUpperCase()}
                  </span>
                </div>
              );
            })()}

            {/* Comment + actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea
                value={regComment}
                onChange={e => setRegComment(e.target.value)}
                placeholder="Comentario de retroalimentación (obligatorio para denegar)..."
                style={{ width: '100%', background: '#161616', border: '1px solid #222', color: '#ccc', borderRadius: '8px', padding: '12px', fontSize: '13px', resize: 'vertical', minHeight: '80px', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button disabled={regLoading} onClick={handleRegAprobar} style={{
                  padding: '10px 24px', background: '#22c55e', color: '#000', border: 'none',
                  borderRadius: '8px', fontWeight: 700, fontSize: '12px', letterSpacing: '1.5px', cursor: 'pointer',
                  opacity: regLoading ? 0.6 : 1,
                }}>
                  {regLoading ? '...' : '✓ APROBAR'}
                </button>
                <button disabled={regLoading} onClick={handleRegDenegar} style={{
                  padding: '10px 24px', background: 'transparent', color: '#ef4444',
                  border: '1px solid #ef444455', borderRadius: '8px', fontWeight: 700,
                  fontSize: '12px', letterSpacing: '1.5px', cursor: 'pointer', opacity: regLoading ? 0.6 : 1,
                }}>
                  {regLoading ? '...' : '✕ DENEGAR'}
                </button>
                <button disabled={regLoading} onClick={handleRegEliminar} style={{
                  marginLeft: 'auto', padding: '10px 18px', background: 'transparent',
                  color: '#555', border: '1px solid #222', borderRadius: '8px',
                  fontWeight: 700, fontSize: '11px', cursor: 'pointer', opacity: regLoading ? 0.6 : 1,
                }}>
                  🗑 ELIMINAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={s.loadingScreen}><div style={s.spinner} /></div>
      ) : (
        <div style={s.layout}>

          {/* ══ MAIN (izquierda) ══ */}
          <main style={s.main}>
            {/* Tabs */}
            <div style={s.tabBar}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{ ...s.tabBtn, ...(tab === t.key ? s.tabActive : {}) }}>
                  {t.icon} {t.label}
                  <span style={{ ...s.tabCount, ...(tab === t.key ? s.tabCountActive : {}) }}>{t.count}</span>
                </button>
              ))}
            </div>

            {/* Reservados */}
            {tab === 'reservados' && (
              reserved.length === 0
                ? <Empty text="No tienes videos reservados actualmente." />
                : <div style={s.grid}>
                    {reserved.map(v => (
                      <VideoCard key={v.id} video={v}
                        badge={{ color: '#f59e0b', label: 'RESERVADO' }}
                        actions={<>
                          {v.drive_link && (
                            <a href={gradioUrl(v.drive_link, v.id)} target="_blank" rel="noreferrer" style={s.btnPrimary}>
                              <Play size={13} /> Abrir en Gradio
                            </a>
                          )}
                          <button disabled={liberando === v.id} onClick={() => handleLiberar(v.id)} style={s.btnGhost}>
                            <Unlock size={13} /> {liberando === v.id ? '...' : 'Liberar'}
                          </button>
                        </>}
                      />
                    ))}
                  </div>
            )}

            {/* Estilizados */}
            {tab === 'estilizados' && (
              stylized.length === 0
                ? <Empty text="Aún no has estilizado ningún video." />
                : <div style={s.grid}>
                    {stylized.map(v => {
                      const rev = v.estado_revision || 'Pendiente';
                      const revColor = { Pendiente: '#f59e0b', Aprobado: '#22c55e', Rechazado: '#ef4444' }[rev] || '#888';
                      return (
                        <VideoCard key={v.id} video={v} badge={{ color: revColor, label: rev.toUpperCase() }}
                          onClick={() => navigate('/registro')}>
                          {rev === 'Rechazado' && v.comentario_revision && (
                            <p style={{ fontSize: '11px', color: '#ef4444', fontStyle: 'italic', margin: '6px 0 0', lineHeight: 1.4 }}>
                              ↩ {v.comentario_revision}
                            </p>
                          )}
                          {rev === 'Aprobado' && v.comentario_revision && (
                            <p style={{ fontSize: '11px', color: '#22c55e', fontStyle: 'italic', margin: '6px 0 0', lineHeight: 1.4 }}>
                              ✓ {v.comentario_revision}
                            </p>
                          )}
                          <p style={{ fontSize: '10px', color: '#444', margin: '8px 0 0', letterSpacing: '1px' }}>
                            VER EN REGISTRO →
                          </p>
                        </VideoCard>
                      );
                    })}
                  </div>
            )}

            {/* Estilizados del equipo (admin) */}
            {tab === 'equipo_registro' && user?.is_staff && (() => {
              const REV_FILTERS = ['Todos', 'Pendiente', 'Aprobado', 'Rechazado'];
              const filtered = regFilter === 'Todos'
                ? allRegistro
                : allRegistro.filter(v => (v.estado_revision || 'Pendiente') === regFilter);
              return (
                <>
                  {/* Filter bar */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {REV_FILTERS.map(f => {
                      const fColor = { Todos: '#888', Pendiente: '#f59e0b', Aprobado: '#22c55e', Rechazado: '#ef4444' }[f];
                      const active = regFilter === f;
                      return (
                        <button key={f} onClick={() => setRegFilter(f)} style={{
                          padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                          letterSpacing: '1px', cursor: 'pointer', border: `1px solid ${fColor}44`,
                          background: active ? `${fColor}22` : 'transparent',
                          color: active ? fColor : '#444',
                        }}>
                          {f.toUpperCase()}
                          <span style={{ marginLeft: '6px', opacity: 0.6 }}>
                            {f === 'Todos' ? allRegistro.length : allRegistro.filter(v => (v.estado_revision || 'Pendiente') === f).length}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {filtered.length === 0
                    ? <Empty text={`No hay entradas con estado "${regFilter}".`} />
                    : <div style={s.grid}>
                        {filtered.map(v => {
                          const rev = v.estado_revision || 'Pendiente';
                          const revColor = { Pendiente: '#f59e0b', Aprobado: '#22c55e', Rechazado: '#ef4444' }[rev] || '#888';
                          const cardVideo = { ...v, drive_link: v.imagen_link || v.drive_link };
                          return (
                            <div key={v.id} style={{ cursor: 'pointer' }}
                              onClick={() => { setSelectedReg(v); setRegComment(v.comentario_revision || ''); }}>
                              <VideoCard video={cardVideo} badge={{ color: revColor, label: rev.toUpperCase() }}>
                                <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0', fontWeight: 600 }}>
                                  {v.usuario || '—'}
                                </p>
                                {rev === 'Rechazado' && v.comentario_revision && (
                                  <p style={{ fontSize: '11px', color: '#ef4444', fontStyle: 'italic', margin: '4px 0 0', lineHeight: 1.4 }}>
                                    ↩ {v.comentario_revision}
                                  </p>
                                )}
                              </VideoCard>
                            </div>
                          );
                        })}
                      </div>
                  }
                </>
              );
            })()}

            {/* Errores de Gradio (admin) */}
            {tab === 'errores' && user?.is_staff && (() => {
              const members = [...new Set(errores.map(e => e.miembro).filter(Boolean))].sort();
              const filtered = errFilter ? errores.filter(e => e.miembro === errFilter) : errores;
              return (
                <>
                  {/* Filter by member */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <button onClick={() => setErrFilter('')} style={{
                      padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                      cursor: 'pointer', border: '1px solid #33333388',
                      background: !errFilter ? 'rgba(255,255,255,0.08)' : 'transparent',
                      color: !errFilter ? '#ddd' : '#555',
                    }}>TODOS <span style={{ opacity: 0.5 }}>{errores.length}</span></button>
                    {members.map(m => (
                      <button key={m} onClick={() => setErrFilter(m)} style={{
                        padding: '6px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        cursor: 'pointer', border: '1px solid #ef444433',
                        background: errFilter === m ? 'rgba(239,68,68,0.12)' : 'transparent',
                        color: errFilter === m ? '#ef4444' : '#555',
                      }}>{m} <span style={{ opacity: 0.5 }}>{errores.filter(e => e.miembro === m).length}</span></button>
                    ))}
                  </div>

                  {filtered.length === 0
                    ? <Empty text="No hay errores registrados." />
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {filtered.map(e => (
                          <div key={e.id} style={{
                            padding: '14px 18px', background: 'rgba(239,68,68,0.04)',
                            border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px',
                          }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 700, color: '#ef4444', fontSize: '12px' }}>{e.miembro || '—'}</span>
                              <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', background: 'rgba(255,255,255,0.06)', color: '#888', fontWeight: 700 }}>{e.paso}</span>
                              {e.modelo && <span style={{ fontSize: '10px', color: '#555', fontFamily: 'monospace' }}>{e.modelo}</span>}
                              <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#333' }}>
                                {new Date(e.timestamp).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <p style={{ fontSize: '12px', color: '#888', margin: 0, fontFamily: 'monospace', wordBreak: 'break-word', lineHeight: 1.5 }}>
                              {e.mensaje}
                            </p>
                          </div>
                        ))}
                      </div>
                  }
                </>
              );
            })()}

            {/* Equipo (admin) */}
            {tab === 'equipo' && user?.is_staff && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <button disabled={asignando} onClick={handleAsignarCenso} style={{
                    padding: '10px 22px', background: '#5b8def', color: '#000', border: 'none',
                    borderRadius: '8px', fontWeight: 800, fontSize: '11px', letterSpacing: '1.5px',
                    cursor: 'pointer', opacity: asignando ? 0.6 : 1,
                  }}>
                    {asignando ? 'REPARTIENDO...' : '⚖ REPARTIR CENSO RESTANTE ENTRE EL EQUIPO'}
                  </button>
                  {asignResult && (
                    <span style={{ fontSize: '12px', color: '#4caf7d' }}>
                      ✓ {asignResult.asignados} videos repartidos — {Object.entries(asignResult.detalle).map(([m, n]) => `${m}: ${n}`).join(' · ')}
                    </span>
                  )}
                </div>
                {allReservations.length === 0
                  ? <Empty text="No hay reservas activas en el equipo." />
                  : <div style={s.grid}>
                      {allReservations.map(v => (
                        <VideoCard key={v.id} video={v}
                          badge={{ color: '#f59e0b', label: v.reservado_por || 'RESERVADO' }}
                          actions={
                            <button disabled={liberando === v.id} onClick={() => handleLiberar(v.id)}
                              style={{ ...s.btnGhost, width: '100%', justifyContent: 'center' }}>
                              <Unlock size={13} /> {liberando === v.id ? '...' : 'Liberar reserva'}
                            </button>
                          }
                        />
                      ))}
                    </div>}
              </>
            )}
          </main>

          {/* ══ SIDEBAR (derecha) ══ */}
          <aside style={s.sidebar}>

            {/* Avatar + user info */}
            <AvatarUpload
              user={user} initials={initials}
              uploading={avatarUploading}
              onFileRef={el => fileRef.current = el}
              onPickFile={() => fileRef.current?.click()}
              onFileChange={handleAvatarChange}
            />

            {/* Stats */}
            <div style={s.sideStats}>
              {user?.is_staff ? <>
                <Stat num={allRegistro.length}     label="Registro" />
                <div style={s.statDiv} />
                <Stat num={allReservations.length} label="Activos" />
                <div style={s.statDiv} />
                <Stat num={allRegistro.filter(v => v.estado_revision === 'Pendiente').length} label="Pendientes" />
              </> : <>
                <Stat num={reserved.length} label="Reservados" />
                <div style={s.statDiv} />
                <Stat num={stylized.length} label="Estilizados" />
              </>}
            </div>

            {/* Module nav */}
            <div style={s.navSection}>
              <p style={s.navLabel}>MÓDULOS</p>
              {MODULES.map(m => (
                <NavItem key={m.path} {...m} onClick={() => navigate(m.path)} />
              ))}
            </div>

            {/* Spacer empuja logout al fondo */}
            <div style={{ flex: 1 }} />

            {/* Logout at bottom */}
            <button onClick={handleLogout} style={s.logoutBtn}>
              <LogOut size={15} /> Cerrar sesión
            </button>
          </aside>
        </div>
      )}
    </>
  );
}

/* ── Avatar upload section ── */
function AvatarUpload({ user, initials, uploading, onFileRef, onPickFile, onFileChange }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={s.userCard}>
      <div style={{ position: 'relative', cursor: 'pointer' }}
        onClick={onPickFile}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}>
        <div style={s.avatarWrap}>
          {user.avatar
            ? <img src={user.avatar} alt="avatar" style={s.avatarImg} />
            : <div style={s.avatarInitials}>{initials}</div>
          }
        </div>
        <div style={{ ...s.avatarOverlay, opacity: hov || uploading ? 1 : 0 }}>
          {uploading ? <div style={s.avatarSpinner} /> : <Camera size={20} color="#fff" />}
        </div>
      </div>
      <input ref={onFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
      <h2 style={s.displayName}>{user.display_name}</h2>
      <p style={s.email}>{user.username}</p>
      {user.is_staff && <span style={s.adminBadge}>ADMIN</span>}
    </div>
  );
}

/* ── Video Card ── */
function VideoCard({ video, badge, actions, children, onClick }) {
  const [err, setErr] = useState(false);
  // Try Drive thumbnail → fallback to imagen_link (CloudFront/HTTP direct URL)
  const driveThumb = thumbUrl(video.drive_link) || thumbUrl(video.imagen_link);
  const directThumb = !driveThumb && !err && video.imagen_link?.startsWith('http') ? video.imagen_link : null;
  const thumb = driveThumb || directThumb;
  const rawId = video.id_video_equipo || video.video_id || '';
  const displayId = rawId.toString().replace(/^#+/, '');
  return (
    <div style={{ ...s.card, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={s.cardThumb}>
        {thumb && !err
          ? <img src={thumb} alt="" style={s.cardThumbImg} onError={() => setErr(true)} />
          : <div style={s.cardThumbFb}><Video size={28} color="rgba(255,255,255,0.1)" /></div>
        }
        <span style={{ ...s.cardBadge, background: `${badge.color}22`, color: badge.color, borderColor: `${badge.color}55` }}>
          {badge.label}
        </span>
      </div>
      <div style={s.cardBody}>
        <p style={s.cardId}>#{displayId}</p>
        <div style={s.cardMeta}>
          {video.mapa     && <span style={s.metaTag}>{video.mapa}</span>}
          {video.especie  && <span style={s.metaTag}>{video.especie}</span>}
          {video.estilizado && <span style={{ ...s.metaTag, color: '#a78bfa' }}>{video.estilizado}</span>}
          {video.duracion && <span style={{ ...s.metaTag, opacity: 0.5 }}>{video.duracion}</span>}
        </div>
        {children}
        {actions && <div style={s.cardActions}>{actions}</div>}
      </div>
    </div>
  );
}

const Stat = ({ num, label }) => (
  <div style={s.statBox}>
    <span style={s.statNum}>{num}</span>
    <span style={s.statLabel}>{label}</span>
  </div>
);

function NavItem({ label, icon, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      style={{ ...s.navItem, background: hov ? 'rgba(255,255,255,0.07)' : 'transparent' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <span style={s.navIcon}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <ExternalLink size={11} style={{ opacity: 0.25 }} />
    </button>
  );
}

const Empty = ({ text }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: '12px' }}>
    <span style={{ fontSize: '40px', opacity: 0.1 }}>📭</span>
    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px', margin: 0 }}>{text}</p>
  </div>
);

/* ── Styles ── */
const s = {
  loadingScreen: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' },
  spinner: {
    width: '36px', height: '36px',
    border: '3px solid rgba(255,255,255,0.08)',
    borderTop: '3px solid rgba(192,192,192,0.5)',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },

  layout: { display: 'flex', minHeight: '100vh', paddingTop: '64px' },

  /* Main content — izquierda */
  main: { flex: 1, padding: '32px 36px 60px', minWidth: 0 },

  /* Sidebar — DERECHA */
  sidebar: {
    width: '300px', flexShrink: 0,
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    padding: '32px 24px 24px',
    display: 'flex', flexDirection: 'column', gap: '24px',
    position: 'sticky', top: '64px', height: 'calc(100vh - 64px)',
    overflowY: 'auto',
  },

  /* User card */
  userCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '10px', textAlign: 'center',
    padding: '28px 20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
  },
  avatarWrap: {
    width: '88px', height: '88px', borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.1)',
    overflow: 'hidden', flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  avatarInitials: {
    width: '100%', height: '100%',
    background: 'linear-gradient(135deg, #3a3a3a, #777)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '28px', fontWeight: '800', color: '#fff', letterSpacing: '1px',
  },
  avatarOverlay: {
    position: 'absolute', inset: 0, borderRadius: '50%',
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.2s', cursor: 'pointer',
  },
  avatarSpinner: {
    width: '22px', height: '22px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  },
  displayName: {
    fontFamily: "'Outfit','Inter',sans-serif",
    fontSize: '1.15rem', fontWeight: '700', color: '#eee', margin: 0,
  },
  email: { fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0, wordBreak: 'break-all' },
  adminBadge: {
    fontSize: '9px', fontWeight: '700', letterSpacing: '2px',
    background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
    border: '1px solid rgba(251,191,36,0.25)',
    padding: '3px 12px', borderRadius: '20px',
  },

  /* Stats */
  sideStats: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    padding: '16px 12px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
  },
  statBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' },
  statNum: { fontSize: '1.7rem', fontWeight: '800', color: '#e0e0e0', fontFamily: 'monospace', lineHeight: 1 },
  statLabel: { fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px', textTransform: 'uppercase' },
  statDiv: { width: '1px', height: '30px', background: 'rgba(255,255,255,0.07)' },

  /* Nav */
  navSection: { display: 'flex', flexDirection: 'column', gap: '2px' },
  navLabel: {
    fontSize: '9px', fontWeight: '700', letterSpacing: '2px',
    color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase',
    margin: '0 0 8px 4px',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '11px 14px', borderRadius: '10px',
    background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '500',
    cursor: 'pointer', width: '100%', transition: 'background 0.15s',
  },
  navIcon: { color: 'rgba(255,255,255,0.3)', flexShrink: 0 },

  /* Logout at bottom */
  logoutBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    width: '100%', padding: '12px',
    borderRadius: '10px',
    background: 'rgba(248,113,113,0.06)',
    border: '1px solid rgba(248,113,113,0.2)',
    color: '#f87171', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    transition: 'background 0.2s',
  },

  /* Tabs */
  tabBar: {
    display: 'flex', gap: '8px', marginBottom: '28px',
    borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '18px',
    flexWrap: 'wrap',
  },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: '7px',
    padding: '9px 20px', borderRadius: '8px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  tabActive: {
    background: 'rgba(192,192,192,0.08)',
    border: '1px solid rgba(192,192,192,0.2)',
    color: '#ddd',
  },
  tabCount: {
    padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)',
  },
  tabCountActive: { background: 'rgba(192,192,192,0.15)', color: '#bbb' },

  /* Grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: '18px',
  },

  /* Video card */
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  cardThumb: {
    position: 'relative', width: '100%', paddingBottom: '56.25%',
    background: 'rgba(0,0,0,0.4)', overflow: 'hidden', flexShrink: 0,
  },
  cardThumbImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  cardThumbFb: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.02)',
  },
  cardBadge: {
    position: 'absolute', top: '8px', left: '8px',
    fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px',
    padding: '3px 9px', borderRadius: '20px', border: '1px solid',
    backdropFilter: 'blur(6px)',
  },
  cardBody: { padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  cardId: { fontFamily: 'monospace', fontWeight: '700', fontSize: '15px', color: '#c0c0c0', margin: 0 },
  cardMeta: { display: 'flex', flexWrap: 'wrap', gap: '5px' },
  metaTag: {
    fontSize: '10px', color: 'rgba(255,255,255,0.35)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '2px 8px', borderRadius: '20px',
  },
  cardActions: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' },

  /* Buttons — same size, full width */
  btnPrimary: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
    padding: '11px 16px', borderRadius: '8px',
    background: '#fff', color: '#000',
    fontWeight: '700', fontSize: '13px', textDecoration: 'none',
    letterSpacing: '0.3px',
  },
  btnGhost: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
    padding: '11px 16px', borderRadius: '8px',
    background: 'transparent', color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.35)',
    fontWeight: '700', fontSize: '13px', cursor: 'pointer',
    letterSpacing: '0.3px',
  },
};
