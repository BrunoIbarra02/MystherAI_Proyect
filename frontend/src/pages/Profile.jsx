import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, CheckCircle, Users, LogOut,
  BookOpen, BarChart2, Layers, Clapperboard,
  ExternalLink, Unlock, Play,
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

const MODULES = [
  { label: 'Catálogo',     path: '/censo',        icon: <Video size={15} /> },
  { label: 'Biblioteca',   path: '/registro',     icon: <BookOpen size={15} /> },
  { label: 'Panorama',     path: '/resumen',      icon: <Layers size={15} /> },
  { label: 'Análisis',     path: '/estadisticas', icon: <BarChart2 size={15} /> },
  { label: 'Estudio AI',   path: '/herramienta',  icon: <Clapperboard size={15} /> },
];

const Profile = () => {
  const navigate   = useNavigate();
  const { user, logout } = useUser();
  const { apiKey } = useApiKey();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('reservados');
  const [liberando, setLiberando] = useState(null);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    api.get('/auth/profile-data/')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleLogout = async () => { await logout(); navigate('/'); };

  const handleLiberar = async (videoId) => {
    setLiberando(videoId);
    try {
      await api.post(`/sheets/videos/${videoId}/liberar/`);
      const r = await api.get('/auth/profile-data/');
      setData(r.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al liberar.');
    } finally { setLiberando(null); }
  };

  const gradioUrl = (driveLink) =>
    `${GRADIO_BASE}/?api_key=${encodeURIComponent(apiKey || '')}&video_url=${encodeURIComponent(driveLink || '')}`;

  const initials = (user?.display_name || 'U').slice(0, 2).toUpperCase();
  const reserved        = data?.reserved        || [];
  const stylized        = data?.stylized        || [];
  const allReservations = data?.all_reservations || [];

  return (
    <>
      <AppNavbar backTo="/dashboard" />

      {loading ? (
        <div style={s.loadingScreen}><div style={s.spinner} /></div>
      ) : (
        <div style={s.layout}>

          {/* ══ SIDEBAR ══ */}
          <aside style={s.sidebar}>

            {/* User card */}
            <div style={s.userCard}>
              <div style={s.avatar}>{initials}</div>
              <h2 style={s.displayName}>{user.display_name}</h2>
              <p style={s.email}>{user.username}</p>
              {user.is_staff && <span style={s.adminBadge}>ADMIN</span>}
              <button onClick={handleLogout} style={s.logoutBtn}>
                <LogOut size={13} /> Cerrar sesión
              </button>
            </div>

            {/* Stats mini */}
            <div style={s.sideStats}>
              <div style={s.sideStat}>
                <span style={s.sideStatNum}>{reserved.length}</span>
                <span style={s.sideStatLabel}>Reservados</span>
              </div>
              <div style={s.sideStatDivider} />
              <div style={s.sideStat}>
                <span style={s.sideStatNum}>{stylized.length}</span>
                <span style={s.sideStatLabel}>Estilizados</span>
              </div>
              {user.is_staff && (
                <>
                  <div style={s.sideStatDivider} />
                  <div style={s.sideStat}>
                    <span style={s.sideStatNum}>{allReservations.length}</span>
                    <span style={s.sideStatLabel}>Equipo activo</span>
                  </div>
                </>
              )}
            </div>

            {/* Module nav */}
            <div style={s.navSection}>
              <p style={s.navLabel}>MÓDULOS</p>
              {MODULES.map(m => (
                <button key={m.path} onClick={() => navigate(m.path)} style={s.navItem}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={s.navIcon}>{m.icon}</span>
                  {m.label}
                  <ExternalLink size={11} style={{ marginLeft: 'auto', opacity: 0.3 }} />
                </button>
              ))}
            </div>
          </aside>

          {/* ══ MAIN ══ */}
          <main style={s.main}>

            {/* Tabs */}
            <div style={s.tabBar}>
              {[
                { key: 'reservados', label: `Mis Reservas`, count: reserved.length, icon: <Video size={13} /> },
                { key: 'estilizados', label: 'Estilizados', count: stylized.length, icon: <CheckCircle size={13} /> },
                ...(user.is_staff ? [{ key: 'equipo', label: 'Equipo', count: allReservations.length, icon: <Users size={13} /> }] : []),
              ].map(t => (
                <button key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{ ...s.tabBtn, ...(tab === t.key ? s.tabActive : {}) }}>
                  {t.icon} {t.label}
                  <span style={{ ...s.tabCount, ...(tab === t.key ? s.tabCountActive : {}) }}>{t.count}</span>
                </button>
              ))}
            </div>

            {/* ── RESERVADOS ── */}
            {tab === 'reservados' && (
              reserved.length === 0
                ? <Empty text="No tienes videos reservados actualmente." />
                : <div style={s.grid}>
                    {reserved.map(v => (
                      <VideoCard key={v.id} video={v}
                        badge={{ color: '#f59e0b', label: 'RESERVADO' }}
                        actions={
                          <>
                            {v.drive_link && (
                              <a href={gradioUrl(v.drive_link)} target="_blank" rel="noreferrer" style={s.cardBtnPrimary}>
                                <Play size={11} /> Abrir en Gradio
                              </a>
                            )}
                            <button disabled={liberando === v.id} onClick={() => handleLiberar(v.id)} style={s.cardBtnGhost}>
                              <Unlock size={11} /> {liberando === v.id ? '...' : 'Liberar'}
                            </button>
                          </>
                        }
                      />
                    ))}
                  </div>
            )}

            {/* ── ESTILIZADOS ── */}
            {tab === 'estilizados' && (
              stylized.length === 0
                ? <Empty text="Aún no has estilizado ningún video." />
                : <div style={s.grid}>
                    {stylized.map(v => (
                      <VideoCard key={v.id} video={v}
                        badge={{ color: '#22c55e', label: 'ESTILIZADO' }}
                      />
                    ))}
                  </div>
            )}

            {/* ── EQUIPO ── */}
            {tab === 'equipo' && user.is_staff && (
              allReservations.length === 0
                ? <Empty text="No hay reservas activas en el equipo." />
                : <div style={s.grid}>
                    {allReservations.map(v => (
                      <VideoCard key={v.id} video={v}
                        badge={{ color: '#f59e0b', label: v.reservado_por || 'RESERVADO' }}
                        actions={
                          <button disabled={liberando === v.id} onClick={() => handleLiberar(v.id)} style={s.cardBtnGhost}>
                            <Unlock size={11} /> {liberando === v.id ? '...' : 'Liberar reserva'}
                          </button>
                        }
                      />
                    ))}
                  </div>
            )}
          </main>
        </div>
      )}
    </>
  );
};

/* ── Video Card ── */
const VideoCard = ({ video, badge, actions }) => {
  const [imgErr, setImgErr] = useState(false);
  const thumb = thumbUrl(video.drive_link);

  return (
    <div style={s.card}>
      {/* Thumbnail */}
      <div style={s.cardThumb}>
        {thumb && !imgErr ? (
          <img src={thumb} alt="" style={s.cardThumbImg} onError={() => setImgErr(true)} />
        ) : (
          <div style={s.cardThumbFallback}>
            <Video size={28} color="rgba(255,255,255,0.12)" />
          </div>
        )}
        {/* Badge overlay */}
        <span style={{ ...s.cardBadge, background: `${badge.color}22`, color: badge.color, borderColor: `${badge.color}55` }}>
          {badge.label}
        </span>
      </div>

      {/* Info */}
      <div style={s.cardBody}>
        <p style={s.cardId}>#{video.id_video_equipo || video.video_id}</p>
        <div style={s.cardMeta}>
          {video.mapa && <span style={s.metaTag}>{video.mapa}</span>}
          {video.especie && <span style={s.metaTag}>{video.especie}</span>}
          {video.duracion && <span style={{ ...s.metaTag, color: 'rgba(255,255,255,0.25)' }}>{video.duracion}</span>}
        </div>
        {actions && <div style={s.cardActions}>{actions}</div>}
      </div>
    </div>
  );
};

const Empty = ({ text }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: '12px' }}>
    <span style={{ fontSize: '40px', opacity: 0.1 }}>📭</span>
    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px', margin: 0 }}>{text}</p>
  </div>
);

/* ── Styles ── */
const s = {
  loadingScreen: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh',
  },
  spinner: {
    width: '36px', height: '36px',
    border: '3px solid rgba(255,255,255,0.08)',
    borderTop: '3px solid rgba(192,192,192,0.5)',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },

  layout: {
    display: 'flex', minHeight: '100vh', paddingTop: '64px',
  },

  /* Sidebar */
  sidebar: {
    width: '260px', flexShrink: 0,
    borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: '28px 20px',
    display: 'flex', flexDirection: 'column', gap: '24px',
    position: 'sticky', top: '64px', height: 'calc(100vh - 64px)',
    overflowY: 'auto',
  },
  userCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '8px', textAlign: 'center',
    padding: '20px 16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px',
  },
  avatar: {
    width: '60px', height: '60px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #3a3a3a, #777)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '22px', fontWeight: '800', color: '#fff',
    letterSpacing: '1px', marginBottom: '4px',
    border: '2px solid rgba(255,255,255,0.08)',
  },
  displayName: {
    fontFamily: "'Outfit','Inter',sans-serif",
    fontSize: '1.1rem', fontWeight: '700', color: '#eee', margin: 0,
  },
  email: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0, wordBreak: 'break-all' },
  adminBadge: {
    fontSize: '9px', fontWeight: '700', letterSpacing: '2px',
    background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
    border: '1px solid rgba(251,191,36,0.25)',
    padding: '3px 10px', borderRadius: '20px',
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', borderRadius: '8px', marginTop: '4px',
    background: 'transparent', border: '1px solid rgba(248,113,113,0.2)',
    color: '#f87171', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
  },

  sideStats: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-around',
    padding: '14px 10px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px',
  },
  sideStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  sideStatNum: { fontSize: '1.5rem', fontWeight: '800', color: '#e0e0e0', fontFamily: 'monospace', lineHeight: 1 },
  sideStatLabel: { fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '1px', textTransform: 'uppercase' },
  sideStatDivider: { width: '1px', height: '28px', background: 'rgba(255,255,255,0.07)' },

  navSection: { display: 'flex', flexDirection: 'column', gap: '2px' },
  navLabel: {
    fontSize: '9px', fontWeight: '700', letterSpacing: '2px',
    color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase',
    margin: '0 0 6px 4px',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', borderRadius: '8px',
    background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.55)', fontSize: '13px', fontWeight: '500',
    cursor: 'pointer', textAlign: 'left', width: '100%',
    transition: 'background 0.15s',
  },
  navIcon: { color: 'rgba(255,255,255,0.3)', flexShrink: 0 },

  /* Main */
  main: {
    flex: 1, padding: '28px 32px 60px', minWidth: 0,
  },

  tabBar: {
    display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap',
    borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '16px',
  },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: '7px',
    padding: '8px 18px', borderRadius: '8px',
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
    padding: '2px 7px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
    background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)',
  },
  tabCountActive: { background: 'rgba(192,192,192,0.15)', color: '#bbb' },

  /* Video grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
  },

  /* Video card */
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    transition: 'border-color 0.2s, transform 0.2s',
  },
  cardThumb: {
    position: 'relative', width: '100%', paddingBottom: '56.25%',
    background: 'rgba(0,0,0,0.4)', overflow: 'hidden', flexShrink: 0,
  },
  cardThumbImg: {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
  },
  cardThumbFallback: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.02)',
  },
  cardBadge: {
    position: 'absolute', top: '8px', left: '8px',
    fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px',
    padding: '3px 8px', borderRadius: '20px', border: '1px solid',
    backdropFilter: 'blur(6px)',
  },
  cardBody: {
    padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1,
  },
  cardId: {
    fontFamily: 'monospace', fontWeight: '700', fontSize: '15px',
    color: '#c0c0c0', margin: 0,
  },
  cardMeta: { display: 'flex', flexWrap: 'wrap', gap: '5px' },
  metaTag: {
    fontSize: '10px', color: 'rgba(255,255,255,0.35)',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '2px 8px', borderRadius: '20px',
  },
  cardActions: {
    display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px',
  },
  cardBtnPrimary: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '7px 14px', borderRadius: '6px',
    background: '#fff', color: '#000',
    fontWeight: '700', fontSize: '11px', letterSpacing: '0.5px',
    textDecoration: 'none', border: 'none', cursor: 'pointer',
  },
  cardBtnGhost: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '7px 12px', borderRadius: '6px',
    background: 'transparent', color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.3)',
    fontWeight: '700', fontSize: '11px', cursor: 'pointer',
  },
};

export default Profile;
