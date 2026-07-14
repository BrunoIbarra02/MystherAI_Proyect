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
  const [liberando, setLiberando] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
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

  const gradioUrl = (dl) =>
    `${GRADIO_BASE}/?api_key=${encodeURIComponent(apiKey || '')}&video_url=${encodeURIComponent(dl || '')}`;

  const initials        = (user?.display_name || 'U').slice(0, 2).toUpperCase();
  const reserved        = data?.reserved        || [];
  const stylized        = data?.stylized        || [];
  const allReservations = data?.all_reservations || [];
  const allRegistro     = data?.all_registro     || [];

  const TABS = user?.is_staff ? [
    { key: 'equipo_registro', label: 'Estilizados Equipo', count: allRegistro.length,     icon: <CheckCircle size={14} /> },
    { key: 'equipo',          label: 'Reservas Equipo',    count: allReservations.length, icon: <Users size={14} /> },
  ] : [
    { key: 'reservados',  label: 'Mis Reservas', count: reserved.length,  icon: <Video size={14} /> },
    { key: 'estilizados', label: 'Estilizados',  count: stylized.length,  icon: <CheckCircle size={14} /> },
  ];

  return (
    <>
      <AppNavbar backTo="/dashboard" />

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
                            <a href={gradioUrl(v.drive_link)} target="_blank" rel="noreferrer" style={s.btnPrimary}>
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
                        <VideoCard key={v.id} video={v} badge={{ color: revColor, label: rev.toUpperCase() }}>
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
                        </VideoCard>
                      );
                    })}
                  </div>
            )}

            {/* Estilizados del equipo (admin) */}
            {tab === 'equipo_registro' && user?.is_staff && (
              allRegistro.length === 0
                ? <Empty text="No hay entradas en el registro todavía." />
                : <div style={s.grid}>
                    {allRegistro.map(v => {
                      const rev = v.estado_revision || 'Pendiente';
                      const revColor = { Pendiente: '#f59e0b', Aprobado: '#22c55e', Rechazado: '#ef4444' }[rev] || '#888';
                      // Use stylized image thumb if available, else video thumb
                      const cardVideo = { ...v, drive_link: v.imagen_link || v.drive_link };
                      return (
                        <VideoCard key={v.id} video={cardVideo} badge={{ color: revColor, label: rev.toUpperCase() }}>
                          <p style={{ fontSize: '11px', color: '#888', margin: '2px 0 0', fontWeight: 600 }}>
                            {v.usuario || '—'}
                          </p>
                          {rev === 'Rechazado' && v.comentario_revision && (
                            <p style={{ fontSize: '11px', color: '#ef4444', fontStyle: 'italic', margin: '4px 0 0', lineHeight: 1.4 }}>
                              ↩ {v.comentario_revision}
                            </p>
                          )}
                          {rev === 'Aprobado' && v.comentario_revision && (
                            <p style={{ fontSize: '11px', color: '#22c55e', fontStyle: 'italic', margin: '4px 0 0', lineHeight: 1.4 }}>
                              ✓ {v.comentario_revision}
                            </p>
                          )}
                        </VideoCard>
                      );
                    })}
                  </div>
            )}

            {/* Equipo (admin) */}
            {tab === 'equipo' && user?.is_staff && (
              allReservations.length === 0
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
                  </div>
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
function VideoCard({ video, badge, actions, children }) {
  const [err, setErr] = useState(false);
  const thumb = thumbUrl(video.drive_link);
  return (
    <div style={s.card}>
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
        <p style={s.cardId}>#{video.id_video_equipo || video.video_id}</p>
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
