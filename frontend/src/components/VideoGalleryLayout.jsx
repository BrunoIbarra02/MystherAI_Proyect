import React, { useState, useEffect, useCallback } from 'react';
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
    fetchVideos();
  }, [filters, fetchVideos]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if(isEditingInside) {
        await api.put(`/sheets/videos/${selectedVideo.id}/`, formData);
        setSelectedVideo({...selectedVideo, ...formData});
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

  return (
    <>
      <AppNavbar backTo="/dashboard" backLabel="Dashboard" />
      <div className="gallery-page-centered">
        <header className="control-header glass-panel">
          <h1 className="page-title-center">{titulo}</h1>
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
                <div key={v.id} className="yt-card" onClick={() => {setSelectedVideo(v); setIsEditingInside(false);}}>
                  <div className="yt-thumbnail" style={{ backgroundImage: `url(${getThumbnailUrl(v.drive_link)})` }}>
                    <div className="play-btn">▶</div>
                  </div>
                  <div className="yt-info">
                    <h3 className="yt-title" style={{color: 'var(--neon-cyan)'}}>ID: {v.video_id}</h3>
                    <p className="yt-meta">{v.usuario} • <span style={{color: 'var(--silver-mid)'}}>{v.estilizado || v.mapa}</span></p>
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
              <h2 className="neon-title" style={{textAlign:'center'}}>ANADIR A {tipo.toUpperCase()}</h2>
              <div className="form-grid">
                  <input required placeholder="ID Video" value={formData.video_id || ''} onChange={e => setFormData({...formData, video_id: e.target.value})} />
                  <select required value={formData.usuario || ''} onChange={e => setFormData({...formData, usuario: e.target.value})}>
                      <option value="">Seleccionar Usuario...</option>
                      {filterOptions.usuario?.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input required placeholder="Link Video Drive" className="full-width" value={formData.drive_link || ''} onChange={e => setFormData({...formData, drive_link: e.target.value})} />
                  
                  {tipo === 'censo' ? (
                    <>
                      <input placeholder="ID Video Equipo" value={formData.id_video_equipo || ''} onChange={e => setFormData({...formData, id_video_equipo: e.target.value})} />
                      <select value={formData.mapa || ''} onChange={e => setFormData({...formData, mapa: e.target.value})}><option value="">MAPA</option>{filterOptions.mapa?.map(m => <option key={m} value={m}>{m}</option>)}</select>
                      <select value={formData.genero || ''} onChange={e => setFormData({...formData, genero: e.target.value})}><option value="">GÉNERO</option>{filterOptions.genero?.map(g => <option key={g} value={g}>{g}</option>)}</select>
                      <select value={formData.etnia || ''} onChange={e => setFormData({...formData, etnia: e.target.value})}><option value="">ETNIA</option>{filterOptions.etnia?.map(et => <option key={et} value={et}>{et}</option>)}</select>
                      <input placeholder="Duración" value={formData.duracion || ''} onChange={e => setFormData({...formData, duracion: e.target.value})} />
                      <select value={formData.camara || ''} onChange={e => setFormData({...formData, camara: e.target.value})}><option value="">CÁMARA</option>{filterOptions.camara?.map(c => <option key={c} value={c}>{c}</option>)}</select>
                      <select value={formData.especie || ''} onChange={e => setFormData({...formData, especie: e.target.value})}><option value="">ESPECIE</option>{filterOptions.especie?.map(es => <option key={es} value={es}>{es}</option>)}</select>
                    </>
                  ) : (
                    <>
                      <select value={formData.estilizado || ''} onChange={e => setFormData({...formData, estilizado: e.target.value})}><option value="">ESTILIZADO</option>{filterOptions.estilizado?.map(s => <option key={s} value={s}>{s}</option>)}</select>
                      <textarea required placeholder="Prompt Video" className="full-width" value={formData.prompt_video || ''} onChange={e => setFormData({...formData, prompt_video: e.target.value})} />
                      <input placeholder="Link Imagen Ref." className="full-width" value={formData.imagen_link || ''} onChange={e => setFormData({...formData, imagen_link: e.target.value})} />
                      <textarea placeholder="Prompt Imagen" className="full-width" value={formData.prompt_imagen || ''} onChange={e => setFormData({...formData, prompt_imagen: e.target.value})} />
                      <textarea placeholder="Prompt Final" className="full-width" value={formData.prompt_final || ''} onChange={e => setFormData({...formData, prompt_final: e.target.value})} />
                      <input placeholder="Link Video Original (Censo)" className="full-width" value={formData.video_original_link || ''} onChange={e => setFormData({...formData, video_original_link: e.target.value})} />
                    </>
                  )}
              </div>
              <div className="form-btns" style={{marginTop:'20px', justifyContent:'center'}}>
                <button type="submit" className="neon-button">CREAR REGISTRO</button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL DETALLES Y EDICIÓN EN LÍNEA */}
        {selectedVideo && !showAddForm && (
          <div className="netflix-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => {setSelectedVideo(null); setIsEditingInside(false);}}>
            <div className="netflix-modal-window glass-panel" style={{ width: '90%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', zIndex: 10000, position: 'relative', padding: '20px' }} onClick={e => e.stopPropagation()}>
              <button className="close-modal" onClick={() => {setSelectedVideo(null); setIsEditingInside(false);}} style={{ position: 'absolute', top: '10px', right: '15px', background: 'none', border: 'none', color: 'white', fontSize: '24px', cursor: 'pointer' }}>×</button>
              
              <div className="modal-hero">
                {getEmbedUrl(selectedVideo.drive_link) ? (
                  <iframe 
                    src={getEmbedUrl(selectedVideo.drive_link)} 
                    width="100%" height="400px" 
                    allow="autoplay; fullscreen"
                    style={{border: 'none'}}
                    title="Reproductor de Video">
                  </iframe>
                ) : (
                  <div className="modal-player-placeholder">
                     <p>El enlace no contiene un ID válido de Drive o el archivo no está público.</p>
                     {selectedVideo.drive_link && <button onClick={() => window.open(selectedVideo.drive_link, '_blank')} className="neon-button" style={{marginTop:'10px'}}>ABRIR LINK ORIGINAL</button>}
                  </div>
                )}
              </div>

              <div className="modal-content-details">
                <div style={{display:'flex', gap:'15px', flexWrap:'wrap', alignItems:'center', borderBottom:'1px solid #333', paddingBottom:'15px'}}>
                   <h2 className="neon-cyan-text" style={{marginRight:'auto', margin:0}}>
                      {selectedVideo.tipo === 'registro' ? 'REGISTRO:' : 'CENSO:'} {selectedVideo.video_id}
                   </h2>
                   {isAdmin && !isEditingInside && <button className="neon-button" style={{borderColor:'orange', color:'orange', padding:'5px 15px'}} onClick={() => startEdit(selectedVideo)}>EDITAR ✎</button>}
                   {isAdmin && !isEditingInside && <button className="logout-btn" style={{padding:'5px 15px', margin:0, backgroundColor: 'red', color: 'white', border: 'none', cursor: 'pointer'}} onClick={() => handleDelete(selectedVideo.id)}>BORRAR 🗑</button>}
                </div>

                {isEditingInside ? (
                   <form className="add-form" style={{border:'none', boxShadow:'none', padding:'20px 0', margin:0}} onSubmit={handleSave}>
                      <p style={{color:'orange', fontStyle:'italic', marginBottom:'15px'}}>Modo Edición Activado</p>
                      <div className="form-grid">
                          <input value={formData.usuario || ''} placeholder="Usuario" onChange={e => setFormData({...formData, usuario: e.target.value})} />
                          <input value={formData.drive_link || ''} placeholder="Link Drive Principal" className="full-width" onChange={e => setFormData({...formData, drive_link: e.target.value})} />
                          {selectedVideo.tipo === 'censo' ? (
                            <>
                              <input value={formData.id_video_equipo || ''} placeholder="ID Video Equipo" onChange={e => setFormData({...formData, id_video_equipo: e.target.value})} />
                              <input value={formData.mapa || ''} placeholder="Mapa" onChange={e => setFormData({...formData, mapa: e.target.value})} />
                              <input value={formData.genero || ''} placeholder="Género" onChange={e => setFormData({...formData, genero: e.target.value})} />
                              <input value={formData.etnia || ''} placeholder="Etnia" onChange={e => setFormData({...formData, etnia: e.target.value})} />
                              <input value={formData.duracion || ''} placeholder="Duración" onChange={e => setFormData({...formData, duracion: e.target.value})} />
                              <input value={formData.camara || ''} placeholder="Cámara" onChange={e => setFormData({...formData, camara: e.target.value})} />
                              <input value={formData.especie || ''} placeholder="Especie" onChange={e => setFormData({...formData, especie: e.target.value})} />
                            </>
                          ) : (
                            <>
                              <input value={formData.mateo_miguel || ''} placeholder="Mateo/Miguel" onChange={e => setFormData({...formData, mateo_miguel: e.target.value})} />
                              <input value={formData.estilizado || ''} placeholder="Estilizado" onChange={e => setFormData({...formData, estilizado: e.target.value})} />
                              <textarea value={formData.prompt_video || ''} placeholder="Prompt Video" className="full-width" onChange={e => setFormData({...formData, prompt_video: e.target.value})} />
                              <input value={formData.imagen_link || ''} placeholder="Link Imagen Ref" className="full-width" onChange={e => setFormData({...formData, imagen_link: e.target.value})} />
                              <textarea value={formData.prompt_imagen || ''} placeholder="Prompt Imagen" className="full-width" onChange={e => setFormData({...formData, prompt_imagen: e.target.value})} />
                              <textarea value={formData.prompt_final || ''} placeholder="Prompt Final" className="full-width" onChange={e => setFormData({...formData, prompt_final: e.target.value})} />
                              <input value={formData.video_original_link || ''} placeholder="Link Video Original (Censo)" className="full-width" onChange={e => setFormData({...formData, video_original_link: e.target.value})} />
                              <input value={formData.aceptado || ''} placeholder="Aceptado (Si/No)" onChange={e => setFormData({...formData, aceptado: e.target.value})} />
                            </>
                          )}
                      </div>
                      <div className="form-btns">
                        <button type="submit" className="neon-button">GUARDAR CAMBIOS</button>
                        <button type="button" className="logout-btn" style={{backgroundColor: 'gray', color: 'white', padding: '10px 15px', border: 'none', cursor: 'pointer', marginLeft: '10px'}} onClick={() => setIsEditingInside(false)}>CANCELAR</button>
                      </div>
                   </form>
                ) : (
                   <div className="modal-sections">
                      <div className="modal-tags" style={{width:'100%', marginTop:'15px', paddingBottom:'10px'}}>
                        {selectedVideo.usuario && <span className="tag" style={{marginRight: '5px', padding: '5px', backgroundColor: '#333', borderRadius: '5px'}}>MIEMBRO: {selectedVideo.usuario}</span>}
                        {selectedVideo.mateo_miguel && <span className="tag" style={{marginRight: '5px', padding: '5px', backgroundColor: '#333', borderRadius: '5px'}}>{selectedVideo.mateo_miguel}</span>}
                        {selectedVideo.estilizado && <span className="tag green" style={{marginRight: '5px', padding: '5px', backgroundColor: '#2ecc71', color: 'black', borderRadius: '5px'}}>ESTILO: {selectedVideo.estilizado}</span>}
                        {selectedVideo.mapa && <span className="tag green" style={{marginRight: '5px', padding: '5px', backgroundColor: '#2ecc71', color: 'black', borderRadius: '5px'}}>MAPA: {selectedVideo.mapa}</span>}
                      </div>

                      {selectedVideo.tipo === 'registro' ? (
                        <>
                          {selectedVideo.prompt_video && <div className="detail-section full-width"><label style={{color: 'gray'}}>PROMPT VIDEO</label><p className="full-text">{selectedVideo.prompt_video}</p></div>}
                          {selectedVideo.imagen_link && (
                            <div className="detail-section">
                              <label style={{color: 'gray'}}>IMAGEN DE REFERENCIA</label>
                              {extractDriveID(selectedVideo.imagen_link) ? (
                                <img src={getThumbnailUrl(selectedVideo.imagen_link)} className="img-preview" alt="Ref" style={{maxWidth: '100%', height: 'auto', marginTop: '10px'}} />
                              ) : (
                                <button onClick={() => window.open(selectedVideo.imagen_link, '_blank')} className="neon-button neon-link-btn" style={{display: 'block', marginTop: '10px'}}>Ver Link Externo</button>
                              )}
                            </div>
                          )}
                          {selectedVideo.prompt_imagen && <div className="detail-section full-width"><label style={{color: 'gray'}}>PROMPT IMAGEN</label><p className="full-text">{selectedVideo.prompt_imagen}</p></div>}
                          {selectedVideo.video_original_link && (
                            <div className="detail-section">
                              <label style={{color: 'gray'}}>VIDEO ORIGINAL</label><br/>
                              <button onClick={() => handleOpenOriginalVideoRegistro(selectedVideo.video_original_link)} className="neon-button neon-link-btn" style={{marginTop: '10px'}}>ABRIR VIDEO ORIGINAL</button>
                            </div>
                          )}
                        </>
                      ) : ( 
                        <div className="modal-grid-metadata" style={{gridColumn:'1/-1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', width:'100%', marginTop: '20px'}}>
                          <div className="meta-box"><label style={{color: 'gray'}}>ID VIDEO EQUIPO</label><p>{selectedVideo.id_video_equipo || 'N/A'}</p></div>
                          <div className="meta-box"><label style={{color: 'gray'}}>MAPA</label><p>{selectedVideo.mapa || 'N/A'}</p></div>
                          <div className="meta-box"><label style={{color: 'gray'}}>GENERO</label><p>{selectedVideo.genero || 'N/A'}</p></div>
                          <div className="meta-box"><label style={{color: 'gray'}}>ETNIA</label><p>{selectedVideo.etnia || 'N/A'}</p></div>
                          <div className="meta-box"><label style={{color: 'gray'}}>DURACION</label><p>{selectedVideo.duracion || 'N/A'}</p></div>
                          <div className="meta-box"><label style={{color: 'gray'}}>CAMARA</label><p>{selectedVideo.camara || 'N/A'}</p></div>
                          <div className="meta-box"><label style={{color: 'gray'}}>ESPECIE</label><p>{selectedVideo.especie || 'N/A'}</p></div>
                        </div>
                      )}
                   </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default VideoGalleryLayout;