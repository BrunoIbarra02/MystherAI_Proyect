import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavbar from './AppNavbar';
import api from '../utils/api';

const VideoGalleryLayout = ({ tipo, titulo }) => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditingInside, setIsEditingInside] = useState(false);
  const [filters, setFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [search, setSearch] = useState('');
  const isAdmin = true;
  const [formData, setFormData] = useState({});
  const [zoomImageUrl, setZoomImageUrl] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomInputVal, setZoomInputVal] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });

  const [battPct,   setBattPct]   = useState(0);
  const [battLabel, setBattLabel] = useState('');

  const extractDriveID = useCallback((url) => {
    if (!url || typeof url !== 'string' || url.trim() === '') return null;
    const match = url.match(/(?:file\/d\/|id=|\/folders\/|open\?id=)([a-zA-Z0-9_-]{25,})/);
    return match ? match[1] : null;
  }, []);

  const getEmbedUrl = useCallback((url) => {
    const id = extractDriveID(url);
    return id ? `https://drive.google.com/file/d/${id}/preview` : null;
  }, [extractDriveID]);

  const getThumbnailUrl = useCallback((url) => {
    const id = extractDriveID(url);
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w600` : "https://via.placeholder.com/600x338?text=NO+VIDEO";
  }, [extractDriveID]);

  const getHighResUrl = useCallback((url) => {
    const id = extractDriveID(url);
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1600` : null;
  }, [extractDriveID]);

  const fetchVideos = useCallback(async () => {
    try {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v && v !== ""));
      const params = new URLSearchParams({ tipo, search, ...cleanFilters });
      const response = await api.get(`/sheets/videos/?${params.toString()}`);
      setVideos(response.data);
    } catch (error) { setVideos([]); }
  }, [tipo, search, filters]);

  useEffect(() => {
    api.get(`/sheets/filter-options/?tipo=${tipo}`).then(res => setFilterOptions(res.data));
  }, [tipo]);

  useEffect(() => {
    if (tipo !== 'registro') return;
    Promise.all([
      api.get('/sheets/videos/?tipo=censo'),
      api.get('/sheets/videos/?tipo=registro'),
    ]).then(([cRes, rRes]) => {
      const c = cRes.data.length;
      const r = rRes.data.length;
      const pct = c > 0 ? Math.round((r / c) * 100) : 0;
      setBattPct(pct);
      setBattLabel(`${r}/${c}`);
    }).catch(() => {});
  }, [tipo]);

  useEffect(() => {
    fetchVideos();
  }, [filters, fetchVideos]);

  // Bloquear scroll del body cuando cualquier modal está abierto
  useEffect(() => {
    const anyModalOpen = !!(selectedVideo || showAddForm || zoomImageUrl);
    document.body.style.overflow = anyModalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selectedVideo, showAddForm, zoomImageUrl]);

  // Cerrar zoom modal con Escape
  useEffect(() => {
    if (!zoomImageUrl) return;
    const onKey = (e) => { if (e.key === 'Escape') closeZoomModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomImageUrl]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditingInside) {
        await api.put(`/sheets/videos/${selectedVideo.id}/`, formData);
        setSelectedVideo({ ...selectedVideo, ...formData });
        setIsEditingInside(false);
      } else {
        await api.post('/sheets/videos/', { ...formData, tipo });
        setShowAddForm(false);
      }
      fetchVideos();
      alert("Operación completada");
    } catch (err) { alert("Error al guardar."); }
  };

  const startEdit = (v) => { setFormData(v); setIsEditingInside(true); };

  const handleDelete = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar este registro?")) {
      await api.delete(`/sheets/videos/${id}/`);
      setSelectedVideo(null);
      fetchVideos();
    }
  };

  const handleOpenOriginalVideoRegistro = (originalLink) => {
    window.open(originalLink, '_blank');
  };

  const openZoomModal = (url) => {
    setZoomImageUrl(url);
    setZoomLevel(1);
    setDragPos({ x: 0, y: 0 });
  };

  const closeZoomModal = () => {
    setZoomImageUrl(null);
    setZoomLevel(1);
    setDragPos({ x: 0, y: 0 });
  };

  const handleZoomWheel = (e) => {
    e.preventDefault();
    setZoomLevel(prev => {
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      const next = Math.min(5, Math.max(0.5, prev + delta));
      if (next <= 1) setDragPos({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDragStart = (e) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOrigin.current = { ...dragPos };
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    setDragPos({
      x: dragOrigin.current.x + (e.clientX - dragStart.current.x),
      y: dragOrigin.current.y + (e.clientY - dragStart.current.y),
    });
  };

  const handleDragEnd = () => setIsDragging(false);

  return (
    <>
      <AppNavbar backTo="/dashboard" backLabel="Dashboard" />
      <div className="gallery-page-centered">
        <header className="control-header glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <h1 className="page-title-center">{titulo}</h1>
            {tipo === 'registro' && battLabel && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '2px' }}>
                <div style={{ position: 'relative', width: '38px', height: '17px', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: '3px' }}>
                  <div style={{
                    width: `${battPct}%`, height: '100%', borderRadius: '2px',
                    background: battPct > 60 ? '#2ecc71' : battPct > 25 ? '#f39c12' : '#e74c3c',
                  }} />
                  <div style={{ position: 'absolute', right: '-5px', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '8px', background: 'rgba(255,255,255,0.18)', borderRadius: '0 2px 2px 0' }} />
                </div>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                  {battPct}% · {battLabel}
                </span>
              </div>
            )}
          </div>
          <div className="search-box-center">
            <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchVideos()} className="glass-input main-search" />
            <button onClick={fetchVideos} className="neon-button">BUSCAR</button>
            {isAdmin && <button onClick={() => { setFormData({}); setShowAddForm(true); }} className="neon-button add-btn">+ ANADIR NUEVO</button>}
          </div>
          <div className="advanced-filters-center">
            {Object.entries(filterOptions).map(([key, opts]) => (
              <select key={key} className="glass-select-mini" value={filters[key] || ""} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}>
                <option value="">{key.toUpperCase()}</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
          </div>
        </header>

        <main className="gallery-content-full">
          <div className="youtube-grid">
            {videos.length === 0 ? (
              <p className="no-results">No se encontraron videos.</p>
            ) : (
              videos.map(v => (
                <div key={v.id} className="yt-card" onClick={() => { setSelectedVideo(v); setIsEditingInside(false); }}>
                  <div className="yt-thumbnail">
                    <img
                      src={getThumbnailUrl(v.drive_link)}
                      alt={`Video ${v.video_id}`}
                      className="yt-thumb-img"
                      onError={(e) => {
                        const el = e.currentTarget;
                        if (el.dataset.tried !== 'imagen' && v.imagen_link && extractDriveID(v.imagen_link)) {
                          el.dataset.tried = 'imagen';
                          el.src = getThumbnailUrl(v.imagen_link);
                        } else {
                          el.style.display = 'none';
                          const fb = el.nextSibling;
                          if (fb) fb.style.display = 'flex';
                        }
                      }}
                    />
                    <div className="yt-thumb-fallback">
                      <span style={{ fontSize: '30px', opacity: 0.2 }}>🎬</span>
                      <span className="yt-thumb-id">
                        {v.tipo === 'censo' ? `#${v.id_video_equipo || v.video_id}` : `ID: ${v.video_id}`}
                      </span>
                    </div>
                    <div className="play-btn">▶</div>
                  </div>
                  <div className="yt-info">
                    <h3 className="yt-title" style={{ color: 'var(--neon-cyan)' }}>
                      {v.tipo === 'censo' ? `#${v.id_video_equipo || v.video_id}` : `ID: ${v.video_id}`}
                    </h3>
                    <p className="yt-meta">{v.usuario} • <span style={{ color: 'var(--silver-mid)' }}>{v.estilizado || v.mapa}</span></p>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>

        {/* MODAL PARA AÑADIR NUEVO VIDEO */}
        {showAddForm && (
          <div className="netflix-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <form className="netflix-modal-window glass-panel add-form" onSubmit={handleSave} style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', position: 'relative', padding: '20px' }}>
              <button type="button" className="close-modal" onClick={() => setShowAddForm(false)} style={{ position: 'absolute', top: '10px', right: '15px', background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
              <h2 className="neon-title" style={{ textAlign: 'center' }}>ANADIR A {tipo.toUpperCase()}</h2>
              <div className="form-grid">
                <input required placeholder="ID Video" value={formData.video_id || ''} onChange={e => setFormData({ ...formData, video_id: e.target.value })} />
                <select required value={formData.usuario || ''} onChange={e => setFormData({ ...formData, usuario: e.target.value })}>
                  <option value="">Seleccionar Usuario...</option>
                  {filterOptions.usuario?.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <input required placeholder="Link Video Drive" className="full-width" value={formData.drive_link || ''} onChange={e => setFormData({ ...formData, drive_link: e.target.value })} />

                {tipo === 'censo' ? (
                  <>
                    <input placeholder="ID Video Equipo" value={formData.id_video_equipo || ''} onChange={e => setFormData({ ...formData, id_video_equipo: e.target.value })} />
                    <select value={formData.mapa || ''} onChange={e => setFormData({ ...formData, mapa: e.target.value })}><option value="">MAPA</option>{filterOptions.mapa?.map(m => <option key={m} value={m}>{m}</option>)}</select>
                    <select value={formData.genero || ''} onChange={e => setFormData({ ...formData, genero: e.target.value })}><option value="">GÉNERO</option>{filterOptions.genero?.map(g => <option key={g} value={g}>{g}</option>)}</select>
                    <select value={formData.etnia || ''} onChange={e => setFormData({ ...formData, etnia: e.target.value })}><option value="">ETNIA</option>{filterOptions.etnia?.map(et => <option key={et} value={et}>{et}</option>)}</select>
                    <input placeholder="Duración" value={formData.duracion || ''} onChange={e => setFormData({ ...formData, duracion: e.target.value })} />
                    <select value={formData.camara || ''} onChange={e => setFormData({ ...formData, camara: e.target.value })}><option value="">CÁMARA</option>{filterOptions.camara?.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    <select value={formData.especie || ''} onChange={e => setFormData({ ...formData, especie: e.target.value })}><option value="">ESPECIE</option>{filterOptions.especie?.map(es => <option key={es} value={es}>{es}</option>)}</select>
                  </>
                ) : (
                  <>
                    <select value={formData.estilizado || ''} onChange={e => setFormData({ ...formData, estilizado: e.target.value })}><option value="">ESTILIZADO</option>{filterOptions.estilizado?.map(s => <option key={s} value={s}>{s}</option>)}</select>
                    <textarea required placeholder="Prompt Video" className="full-width" value={formData.prompt_video || ''} onChange={e => setFormData({ ...formData, prompt_video: e.target.value })} />
                    <input placeholder="Link Imagen Ref." className="full-width" value={formData.imagen_link || ''} onChange={e => setFormData({ ...formData, imagen_link: e.target.value })} />
                    <textarea placeholder="Prompt Imagen" className="full-width" value={formData.prompt_imagen || ''} onChange={e => setFormData({ ...formData, prompt_imagen: e.target.value })} />
                    <textarea placeholder="Prompt Final" className="full-width" value={formData.prompt_final || ''} onChange={e => setFormData({ ...formData, prompt_final: e.target.value })} />
                    <input placeholder="Link Video Original (Censo)" className="full-width" value={formData.video_original_link || ''} onChange={e => setFormData({ ...formData, video_original_link: e.target.value })} />
                  </>
                )}
              </div>
              <div className="form-btns" style={{ marginTop: '20px', justifyContent: 'center' }}>
                <button type="submit" className="neon-button">CREAR REGISTRO</button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL DETALLES Y EDICIÓN EN LÍNEA */}
        {selectedVideo && !showAddForm && (
          <div className="netflix-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => { setSelectedVideo(null); setIsEditingInside(false); }}>
            <div className="netflix-modal-window glass-panel" style={{ width: '90%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', zIndex: 10000, position: 'relative', padding: '20px' }} onClick={e => e.stopPropagation()}>
              <button className="close-modal" onClick={() => { setSelectedVideo(null); setIsEditingInside(false); }} style={{ position: 'absolute', top: '10px', right: '15px', background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>

              <div className="modal-hero">
                {getEmbedUrl(selectedVideo.drive_link) ? (
                  <iframe
                    src={getEmbedUrl(selectedVideo.drive_link)}
                    width="100%" height="400px"
                    allow="autoplay; fullscreen"
                    style={{ border: 'none' }}
                    title="Reproductor de Video">
                  </iframe>
                ) : (
                  <div className="modal-player-placeholder">
                    <p>El enlace no contiene un ID válido de Drive o el archivo no está público.</p>
                    {selectedVideo.drive_link && <button onClick={() => window.open(selectedVideo.drive_link, '_blank')} className="neon-button" style={{ marginTop: '10px' }}>ABRIR LINK ORIGINAL</button>}
                  </div>
                )}
              </div>

              <div className="modal-content-details">
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '15px' }}>
                  <h2 className="neon-cyan-text" style={{ marginRight: 'auto', margin: 0 }}>
                    {selectedVideo.tipo === 'registro'
                      ? `REGISTRO: ${selectedVideo.video_id}`
                      : `CENSO: #${selectedVideo.id_video_equipo || selectedVideo.video_id}`}
                  </h2>
                  {isAdmin && !isEditingInside && <button className="neon-button" style={{ borderColor: 'orange', color: 'orange', padding: '5px 15px' }} onClick={() => startEdit(selectedVideo)}>EDITAR ✎</button>}
                  {isAdmin && !isEditingInside && <button className="logout-btn" style={{ padding: '5px 15px', margin: 0, backgroundColor: 'red', color: 'white', border: 'none', cursor: 'pointer' }} onClick={() => handleDelete(selectedVideo.id)}>BORRAR 🗑</button>}
                </div>

                {isEditingInside ? (
                  <form className="add-form" style={{ border: 'none', boxShadow: 'none', padding: '20px 0', margin: 0 }} onSubmit={handleSave}>
                    <p style={{ color: 'orange', fontStyle: 'italic', marginBottom: '15px' }}>Modo Edición Activado</p>
                    <div className="form-grid">
                      <input value={formData.usuario || ''} placeholder="Usuario" onChange={e => setFormData({ ...formData, usuario: e.target.value })} />
                      <input value={formData.drive_link || ''} placeholder="Link Drive Principal" className="full-width" onChange={e => setFormData({ ...formData, drive_link: e.target.value })} />
                      {selectedVideo.tipo === 'censo' ? (
                        <>
                          <input value={formData.id_video_equipo || ''} placeholder="ID Video Equipo" onChange={e => setFormData({ ...formData, id_video_equipo: e.target.value })} />
                          <input value={formData.mapa || ''} placeholder="Mapa" onChange={e => setFormData({ ...formData, mapa: e.target.value })} />
                          <input value={formData.genero || ''} placeholder="Género" onChange={e => setFormData({ ...formData, genero: e.target.value })} />
                          <input value={formData.etnia || ''} placeholder="Etnia" onChange={e => setFormData({ ...formData, etnia: e.target.value })} />
                          <input value={formData.duracion || ''} placeholder="Duración" onChange={e => setFormData({ ...formData, duracion: e.target.value })} />
                          <input value={formData.camara || ''} placeholder="Cámara" onChange={e => setFormData({ ...formData, camara: e.target.value })} />
                          <input value={formData.especie || ''} placeholder="Especie" onChange={e => setFormData({ ...formData, especie: e.target.value })} />
                        </>
                      ) : (
                        <>
                          <input value={formData.mateo_miguel || ''} placeholder="Mateo/Miguel" onChange={e => setFormData({ ...formData, mateo_miguel: e.target.value })} />
                          <input value={formData.estilizado || ''} placeholder="Estilizado" onChange={e => setFormData({ ...formData, estilizado: e.target.value })} />
                          <textarea value={formData.prompt_video || ''} placeholder="Prompt Video" className="full-width" onChange={e => setFormData({ ...formData, prompt_video: e.target.value })} />
                          <input value={formData.imagen_link || ''} placeholder="Link Imagen Ref" className="full-width" onChange={e => setFormData({ ...formData, imagen_link: e.target.value })} />
                          <textarea value={formData.prompt_imagen || ''} placeholder="Prompt Imagen" className="full-width" onChange={e => setFormData({ ...formData, prompt_imagen: e.target.value })} />
                          <textarea value={formData.prompt_final || ''} placeholder="Prompt Final" className="full-width" onChange={e => setFormData({ ...formData, prompt_final: e.target.value })} />
                          <input value={formData.video_original_link || ''} placeholder="Link Video Original (Censo)" className="full-width" onChange={e => setFormData({ ...formData, video_original_link: e.target.value })} />
                          <input value={formData.aceptado || ''} placeholder="Aceptado (Si/No)" onChange={e => setFormData({ ...formData, aceptado: e.target.value })} />
                        </>
                      )}
                    </div>
                    <div className="form-btns">
                      <button type="submit" className="neon-button">GUARDAR CAMBIOS</button>
                      <button type="button" className="logout-btn" style={{ backgroundColor: 'gray', color: 'white', padding: '10px 15px', border: 'none', cursor: 'pointer', marginLeft: '10px' }} onClick={() => setIsEditingInside(false)}>CANCELAR</button>
                    </div>
                  </form>
                ) : (
                  <div className="modal-sections">
                    <div className="modal-tags" style={{ width: '100%', marginTop: '15px', paddingBottom: '10px' }}>
                      {selectedVideo.usuario && <span className="tag" style={{ marginRight: '5px', padding: '5px', backgroundColor: '#333', borderRadius: '5px' }}>MIEMBRO: {selectedVideo.usuario}</span>}
                      {selectedVideo.mateo_miguel && <span className="tag" style={{ marginRight: '5px', padding: '5px', backgroundColor: '#333', borderRadius: '5px' }}>{selectedVideo.mateo_miguel}</span>}
                      {selectedVideo.estilizado && <span className="tag green" style={{ marginRight: '5px', padding: '5px', backgroundColor: '#2ecc71', color: 'black', borderRadius: '5px' }}>ESTILO: {selectedVideo.estilizado}</span>}
                      {selectedVideo.mapa && <span className="tag green" style={{ marginRight: '5px', padding: '5px', backgroundColor: '#2ecc71', color: 'black', borderRadius: '5px' }}>MAPA: {selectedVideo.mapa}</span>}
                    </div>

                    {selectedVideo.tipo === 'registro' ? (
                      <>
                        {selectedVideo.prompt_video && <div className="detail-section full-width"><label style={{ color: 'gray' }}>PROMPT VIDEO</label><p className="full-text">{selectedVideo.prompt_video}</p></div>}
                        {selectedVideo.imagen_link && (
                          <div className="detail-section">
                            <label style={{ color: 'gray' }}>IMAGEN DE REFERENCIA</label>
                            {extractDriveID(selectedVideo.imagen_link) ? (
                              <div style={{ position: 'relative', marginTop: '10px', cursor: 'zoom-in' }} onClick={() => openZoomModal(getHighResUrl(selectedVideo.imagen_link) || getThumbnailUrl(selectedVideo.imagen_link))}>
                                <img
                                  src={getThumbnailUrl(selectedVideo.imagen_link)}
                                  className="img-preview"
                                  alt="Ref"
                                  style={{ maxWidth: '100%', height: 'auto', display: 'block', borderRadius: '8px', transition: 'transform 0.2s, box-shadow 0.2s' }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = 'var(--shadow-glow-strong)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                                />
                                <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'var(--bg-deep)', backdropFilter: 'blur(6px)', borderRadius: '20px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--accent-primary)', fontSize: '12px', fontWeight: '600', pointerEvents: 'none', border: '1px solid var(--glass-border)' }}>
                                  <span style={{ fontSize: '14px' }}>🔍</span> Ver en zoom
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => window.open(selectedVideo.imagen_link, '_blank')} className="neon-button neon-link-btn" style={{ display: 'block', marginTop: '10px' }}>Ver Link Externo</button>
                            )}
                          </div>
                        )}
                        {selectedVideo.prompt_imagen && <div className="detail-section full-width"><label style={{ color: 'gray' }}>PROMPT IMAGEN</label><p className="full-text">{selectedVideo.prompt_imagen}</p></div>}
                        {selectedVideo.video_original_link && (
                          <div className="detail-section full-width">
                            <label style={{ color: 'gray' }}>VIDEO ORIGINAL</label>
                            {getEmbedUrl(selectedVideo.video_original_link) ? (
                              <div style={{ marginTop: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <iframe
                                  src={getEmbedUrl(selectedVideo.video_original_link)}
                                  width="100%" height="320px"
                                  allow="autoplay; fullscreen"
                                  style={{ border: 'none', display: 'block' }}
                                  title="Video Original"
                                />
                              </div>
                            ) : (
                              <button onClick={() => window.open(selectedVideo.video_original_link, '_blank')} className="neon-button neon-link-btn" style={{ marginTop: '10px' }}>ABRIR VIDEO ORIGINAL</button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="modal-grid-metadata" style={{ gridColumn: '1/-1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', width: '100%', marginTop: '20px' }}>
                        <div className="meta-box"><label style={{ color: 'gray' }}>ID VIDEO EQUIPO</label><p>{selectedVideo.id_video_equipo || 'N/A'}</p></div>
                        <div className="meta-box"><label style={{ color: 'gray' }}>MAPA</label><p>{selectedVideo.mapa || 'N/A'}</p></div>
                        <div className="meta-box"><label style={{ color: 'gray' }}>GENERO</label><p>{selectedVideo.genero || 'N/A'}</p></div>
                        <div className="meta-box"><label style={{ color: 'gray' }}>ETNIA</label><p>{selectedVideo.etnia || 'N/A'}</p></div>
                        <div className="meta-box"><label style={{ color: 'gray' }}>DURACION</label><p>{selectedVideo.duracion || 'N/A'}</p></div>
                        <div className="meta-box"><label style={{ color: 'gray' }}>CAMARA</label><p>{selectedVideo.camara || 'N/A'}</p></div>
                        <div className="meta-box"><label style={{ color: 'gray' }}>ESPECIE</label><p>{selectedVideo.especie || 'N/A'}</p></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ZOOM MODAL DE IMAGEN DE REFERENCIA */}
      {zoomImageUrl && (
        <div
          onClick={closeZoomModal}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 99999,
            background: 'var(--bg-deep)',
            backdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            animation: 'zoomModalIn 0.22s cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {/* Header barra superior */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              padding: '14px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(180deg, var(--bg-deep) 0%, transparent 100%)',
              borderBottom: '1px solid var(--glass-border)',
              zIndex: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>🖼️</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.9 }}>Imagen de Referencia</span>
            </div>
            <button
              onClick={closeZoomModal}
              style={{
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border-active)',
                color: 'var(--text-primary)', borderRadius: '50%', width: '36px', height: '36px',
                cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'background 0.2s',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-bg)'}
            >✕</button>
          </div>

          {/* Imagen con zoom y drag */}
          <div
            onClick={e => e.stopPropagation()}
            onWheel={handleZoomWheel}
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            style={{
              width: '85vw', height: '80vh',
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: isDragging ? 'grabbing' : (zoomLevel > 1 ? 'grab' : 'zoom-in'),
              userSelect: 'none',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-md)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <img
              src={zoomImageUrl}
              alt="Zoom referencia"
              draggable={false}
              style={{
                transform: `scale(${zoomLevel}) translate(${dragPos.x / zoomLevel}px, ${dragPos.y / zoomLevel}px)`,
                transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.22,1,0.36,1)',
                maxWidth: '100%', maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '10px',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Controles de zoom */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: '28px',
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--bg-surface)',
              backdropFilter: 'blur(14px)',
              border: '1px solid var(--glass-border-active)',
              borderRadius: '40px',
              padding: '10px 20px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <button
              onClick={() => setZoomLevel(p => Math.max(0.5, p - 0.25))}
              title="Reducir zoom"
              style={zoomBtnStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-bg)'}
            >−</button>

            <input
              type="text"
              inputMode="numeric"
              className="zoom-pct-input"
              title="Escribe un porcentaje de zoom (50–500) y presiona Enter"
              value={zoomInputVal !== null ? zoomInputVal : String(Math.round(zoomLevel * 100))}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setZoomInputVal(raw);
              }}
              onFocus={e => {
                setZoomInputVal(String(Math.round(zoomLevel * 100)));
                setTimeout(() => e.target.select(), 0);
              }}
              onBlur={() => {
                const val = parseInt(zoomInputVal, 10);
                if (!isNaN(val) && val > 0) {
                  setZoomLevel(Math.min(5, Math.max(0.5, val / 100)));
                }
                setZoomInputVal(null);
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              style={{
                width: '58px',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border-active)',
                borderRadius: '8px',
                color: 'var(--accent-primary)',
                fontWeight: 700,
                fontSize: '13px',
                textAlign: 'center',
                padding: '4px 2px',
                fontVariantNumeric: 'tabular-nums',
                outline: 'none',
                cursor: 'text',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border-active)'}
            />

            <button
              onClick={() => setZoomLevel(p => Math.min(5, p + 0.25))}
              title="Aumentar zoom"
              style={zoomBtnStyle}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-bg)'}
            >+</button>

            <div style={{ width: '1px', height: '22px', background: 'var(--glass-border-active)', margin: '0 4px' }} />

            <button
              onClick={() => { setZoomLevel(1); setDragPos({ x: 0, y: 0 }); }}
              title="Restablecer"
              style={{ ...zoomBtnStyle, fontSize: '13px', padding: '6px 14px', borderRadius: '20px' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-bg)'}
            >↺ Reset</button>
          </div>

          {/* Instrucción hover */}
          <div style={{
            position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)',
            color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '1px',
            pointerEvents: 'none', textAlign: 'center', opacity: 0.6,
          }}>Rueda del ratón para zoom • Arrastra para mover • Esc o clic fuera para cerrar</div>

          <style>{`
            @keyframes zoomModalIn {
              from { opacity: 0; transform: scale(0.96); }
              to   { opacity: 1; transform: scale(1); }
            }
            .zoom-pct-input::-webkit-outer-spin-button,
            .zoom-pct-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            .zoom-pct-input[type=number] { -moz-appearance: textfield; }
            .zoom-pct-input:focus { border-color: var(--accent-primary) !important; box-shadow: 0 0 0 2px var(--accent-glow); }
          `}</style>
        </div>
      )}
    </>
  );
};

const zoomBtnStyle = {
  background: 'var(--glass-bg)',
  border: '1px solid var(--glass-border)',
  color: 'var(--text-primary)',
  borderRadius: '50%',
  width: '34px', height: '34px',
  cursor: 'pointer',
  fontSize: '20px',
  fontWeight: '300',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.2s',
  lineHeight: 1,
};

export default VideoGalleryLayout;