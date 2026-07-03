import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, CheckCircle, Users, LogOut } from 'lucide-react';
import AppNavbar from '../components/AppNavbar';
import api from '../utils/api';
import { useUser } from '../context/UserContext';
import { useApiKey } from '../context/ApiKeyContext';

const GRADIO_BASE = 'http://mysther-ai-alb-1734290767.eu-central-1.elb.amazonaws.com:7860';

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const { apiKey } = useApiKey();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState('reservados');
  const [liberando, setLiberando] = useState(null);

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    api.get('/auth/profile-data/')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleLiberar = async (videoId) => {
    setLiberando(videoId);
    try {
      await api.post(`/sheets/videos/${videoId}/liberar/`);
      // refresh
      const r = await api.get('/auth/profile-data/');
      setData(r.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al liberar.');
    } finally { setLiberando(null); }
  };

  const gradioUrl = (driveLink) =>
    `${GRADIO_BASE}/?api_key=${encodeURIComponent(apiKey || '')}&video_url=${encodeURIComponent(driveLink || '')}`;

  if (!user || loading) {
    return (
      <>
        <AppNavbar backTo="/dashboard" />
        <div style={s.center}><div style={s.spinner} /></div>
      </>
    );
  }

  const initials = (user.display_name || 'U').slice(0, 2).toUpperCase();
  const reserved   = data?.reserved   || [];
  const stylized   = data?.stylized   || [];
  const allReservations = data?.all_reservations || [];

  return (
    <>
      <AppNavbar backTo="/dashboard" />
      <div style={s.page}>

        {/* ─── USER CARD ─── */}
        <div style={s.userCard}>
          <div style={s.avatar}>{initials}</div>
          <div style={s.userInfo}>
            <h2 style={s.displayName}>{user.display_name}</h2>
            <p style={s.email}>{user.username}</p>
            {user.is_staff && <span style={s.adminBadge}>ADMIN</span>}
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>

        {/* ─── STATS ─── */}
        <div style={s.statsRow}>
          <div style={s.statBox}>
            <span style={s.statNum}>{reserved.length}</span>
            <span style={s.statLabel}>Reservados</span>
          </div>
          <div style={s.statBox}>
            <span style={s.statNum}>{stylized.length}</span>
            <span style={s.statLabel}>Estilizados</span>
          </div>
          {user.is_staff && (
            <div style={s.statBox}>
              <span style={s.statNum}>{allReservations.length}</span>
              <span style={s.statLabel}>Equipo activo</span>
            </div>
          )}
        </div>

        {/* ─── TABS ─── */}
        <div style={s.tabBar}>
          <button style={{ ...s.tabBtn, ...(tab === 'reservados' ? s.tabActive : {}) }}
            onClick={() => setTab('reservados')}>
            <Video size={14} /> Mis Reservas ({reserved.length})
          </button>
          <button style={{ ...s.tabBtn, ...(tab === 'estilizados' ? s.tabActive : {}) }}
            onClick={() => setTab('estilizados')}>
            <CheckCircle size={14} /> Estilizados ({stylized.length})
          </button>
          {user.is_staff && (
            <button style={{ ...s.tabBtn, ...(tab === 'equipo' ? s.tabActive : {}) }}
              onClick={() => setTab('equipo')}>
              <Users size={14} /> Equipo ({allReservations.length})
            </button>
          )}
        </div>

        {/* ─── RESERVADOS ─── */}
        {tab === 'reservados' && (
          reserved.length === 0
            ? <EmptyState text="No tienes videos reservados actualmente." />
            : <div style={s.list}>
                {reserved.map(v => (
                  <VideoRow key={v.id} video={v}
                    actions={
                      <div style={s.rowActions}>
                        {apiKey && v.drive_link && (
                          <a href={gradioUrl(v.drive_link)} target="_blank" rel="noreferrer" style={s.openBtn}>
                            ABRIR EN GRADIO →
                          </a>
                        )}
                        <button
                          disabled={liberando === v.id}
                          onClick={() => handleLiberar(v.id)}
                          style={s.liberarBtn}>
                          {liberando === v.id ? '...' : 'LIBERAR'}
                        </button>
                      </div>
                    }
                  />
                ))}
              </div>
        )}

        {/* ─── ESTILIZADOS ─── */}
        {tab === 'estilizados' && (
          stylized.length === 0
            ? <EmptyState text="Aún no has estilizado ningún video." />
            : <div style={s.list}>
                {stylized.map(v => (
                  <VideoRow key={v.id} video={v} badgeColor="#22c55e" badgeText="ESTILIZADO" />
                ))}
              </div>
        )}

        {/* ─── EQUIPO (admin only) ─── */}
        {tab === 'equipo' && user.is_staff && (
          allReservations.length === 0
            ? <EmptyState text="No hay reservas activas en el equipo." />
            : <div style={s.list}>
                {allReservations.map(v => (
                  <VideoRow key={v.id} video={v}
                    extra={<span style={s.reserverTag}>→ {v.reservado_por}</span>}
                    actions={
                      <button
                        disabled={liberando === v.id}
                        onClick={() => handleLiberar(v.id)}
                        style={s.liberarBtn}>
                        {liberando === v.id ? '...' : 'LIBERAR'}
                      </button>
                    }
                  />
                ))}
              </div>
        )}
      </div>
    </>
  );
};

const VideoRow = ({ video, actions, extra, badgeColor = '#f59e0b', badgeText }) => (
  <div style={s.videoRow}>
    <div style={s.videoRowLeft}>
      <span style={s.videoId}>#{video.id_video_equipo || video.video_id}</span>
      <span style={s.videoMeta}>{video.mapa || '—'} · {video.especie || '—'}</span>
      {badgeText && (
        <span style={{ ...s.badge, background: `${badgeColor}22`, color: badgeColor, borderColor: `${badgeColor}44` }}>
          {badgeText}
        </span>
      )}
      {extra}
    </div>
    {actions && <div style={s.rowActions}>{actions}</div>}
  </div>
);

const EmptyState = ({ text }) => (
  <div style={s.empty}>
    <span style={{ fontSize: '32px', opacity: 0.2 }}>📭</span>
    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '14px', margin: '12px 0 0' }}>{text}</p>
  </div>
);

const s = {
  page: {
    paddingTop: '84px',
    maxWidth: '800px',
    margin: '0 auto',
    padding: '84px 24px 60px',
    minHeight: '100vh',
  },
  center: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '80vh',
  },
  spinner: {
    width: '36px', height: '36px',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTop: '3px solid rgba(192,192,192,0.6)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  userCard: {
    display: 'flex', alignItems: 'center', gap: '20px',
    padding: '24px 28px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  avatar: {
    width: '56px', height: '56px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #444, #888)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '20px', fontWeight: '800', color: '#fff',
    flexShrink: 0,
    letterSpacing: '1px',
  },
  userInfo: { flex: 1 },
  displayName: {
    fontFamily: "'Outfit', 'Inter', sans-serif",
    fontSize: '1.3rem', fontWeight: '700',
    color: '#f0f0f0', margin: '0 0 4px',
  },
  email: { color: 'rgba(255,255,255,0.35)', fontSize: '13px', margin: '0 0 6px' },
  adminBadge: {
    fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px',
    background: 'rgba(251,191,36,0.12)', color: '#fbbf24',
    border: '1px solid rgba(251,191,36,0.3)',
    padding: '3px 10px', borderRadius: '20px',
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: '7px',
    padding: '9px 18px', borderRadius: '8px',
    background: 'transparent', border: '1px solid rgba(248,113,113,0.25)',
    color: '#f87171', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', letterSpacing: '0.5px',
    transition: 'background 0.2s',
    marginLeft: 'auto',
  },
  statsRow: {
    display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap',
  },
  statBox: {
    flex: 1, minWidth: '100px',
    padding: '18px 20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
  },
  statNum: {
    fontSize: '2rem', fontWeight: '800',
    color: '#e0e0e0', fontFamily: 'monospace',
  },
  statLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.3)', letterSpacing: '1px', textTransform: 'uppercase' },
  tabBar: {
    display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap',
  },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '9px 18px', borderRadius: '8px',
    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.45)', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.2s',
  },
  tabActive: {
    background: 'rgba(192,192,192,0.08)',
    border: '1px solid rgba(192,192,192,0.2)',
    color: '#e0e0e0',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  videoRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px',
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '10px', flexWrap: 'wrap', gap: '12px',
  },
  videoRowLeft: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' },
  videoId: { fontFamily: 'monospace', fontWeight: '700', fontSize: '15px', color: '#c0c0c0' },
  videoMeta: { fontSize: '12px', color: 'rgba(255,255,255,0.35)' },
  badge: {
    fontSize: '10px', fontWeight: '700', letterSpacing: '1px',
    padding: '3px 10px', borderRadius: '20px', border: '1px solid',
  },
  reserverTag: { fontSize: '12px', color: '#f59e0b', fontWeight: '600' },
  rowActions: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  openBtn: {
    padding: '8px 18px',
    background: '#fff', color: '#000',
    borderRadius: '6px', fontWeight: '700',
    fontSize: '11px', letterSpacing: '1.5px',
    textDecoration: 'none', cursor: 'pointer',
    display: 'inline-block',
  },
  liberarBtn: {
    padding: '8px 16px',
    background: 'transparent', color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.3)',
    borderRadius: '6px', fontWeight: '700',
    fontSize: '11px', letterSpacing: '1px',
    cursor: 'pointer',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '60px 0',
  },
};

export default Profile;
