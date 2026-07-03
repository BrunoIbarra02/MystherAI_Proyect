import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavbar from '../components/AppNavbar';

/*
  Naming rationale (inspired by SaaS object-oriented nav best practices):
  - Catálogo   = raw recordings catalog with metadata (INPUT)
  - Biblioteca = AI-stylized recordings library (OUTPUT)
  - Panorama   = bird's-eye metrics of the catalog (INPUT ANALYTICS)
  - Análisis   = deep metrics of stylized outputs (OUTPUT ANALYTICS)
  - Estudio    = Gradio AI engine (MOTOR)
*/
const PIPELINE = [
  {
    pair: 'DATOS',
    in:  { id:'censo',        ruta:'/censo',         step:'01', tag:'ARCHIVO ORIGINAL', titulo:'Catálogo',  desc:'Grabaciones originales catalogadas con metadatos: cámara, especie, mapa y duración.' },
    out: { id:'registro',     ruta:'/registro',      step:'02', tag:'VERSIONES IA',      titulo:'Biblioteca', desc:'Versiones estilizadas con IA: prompts, estilos aplicados y parámetros por miembro.' },
  },
  {
    pair: 'ANALYTICS',
    in:  { id:'resumen',      ruta:'/resumen',       step:'03', tag:'MÉTRICAS · ORIGEN', titulo:'Panorama',  desc:'Vista general del catálogo: distribución por especie, mapa, cámara y técnica.' },
    out: { id:'estadisticas', ruta:'/estadisticas',  step:'04', tag:'MÉTRICAS · SALIDA', titulo:'Análisis',  desc:'Rendimiento de los estilizados: balance por estilo, fase y miembro del equipo.' },
  },
];

const MOTOR = {
  id: 'herramienta',
  ruta: '/herramienta',
  step: '05',
  tag: 'MOTOR IA · WAVESPEED',
  titulo: 'Estudio',
  desc: 'Transformación V2V · Estilizado I2I · Edición con WAN 2.7, LTX 2-19B y Seedance 2.0.',
};

/* ─── tiny reusable components ─────────────────────────────── */
const Divider = ({ label }) => (
  <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'28px 0 14px' }}>
    <span style={{ fontSize:'9px', color:'#252525', letterSpacing:'3px', textTransform:'uppercase', fontWeight:'700', whiteSpace:'nowrap' }}>{label}</span>
    <div style={{ flex:1, height:'1px', background:'#111' }} />
  </div>
);

const Arrow = () => (
  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="#1e1e1e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

const PipeCard = ({ item, isOut, onClick }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{
        flex: 1,
        background: hov ? '#0e0e0e' : '#080808',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.14)' : (isOut ? '#181818' : '#131313')}`,
        borderRadius: '10px',
        padding: '22px 24px 18px',
        cursor: 'pointer',
        transition: 'border-color .18s, background .18s',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '150px',
      }}
    >
      {/* Watermark number */}
      <span style={{
        position:'absolute', top:'6px', right:'14px',
        fontSize:'64px', fontWeight:'800', lineHeight:'1',
        color:'rgba(255,255,255,0.028)', userSelect:'none', fontVariantNumeric:'tabular-nums',
      }}>{item.step}</span>

      <span style={{ fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', fontWeight:'700', color: isOut ? '#2e2e2e' : '#252525', display:'block', marginBottom:'10px' }}>
        {item.tag}
      </span>
      <h2 style={{ fontSize:'20px', fontWeight:'700', color:'#e0e0e0', margin:'0 0 6px', letterSpacing:'-0.2px' }}>
        {item.titulo}
      </h2>
      <p style={{ fontSize:'12px', color:'#3a3a3a', lineHeight:'1.65', margin:'0 0 16px', maxWidth:'340px' }}>
        {item.desc}
      </p>
      <span style={{ fontSize:'12px', color: hov ? '#484848' : '#252525', transition:'color .18s' }}>→</span>
    </div>
  );
};

/* ─── Dashboard ─────────────────────────────────────────────── */
const Dashboard = () => {
  const navigate = useNavigate();

  const [motorHov, setMotorHov] = React.useState(false);

  return (
    <div style={{ minHeight:'100vh', background:'#000', fontFamily:"'Inter',sans-serif" }}>
      <AppNavbar />

      <div style={{ maxWidth:'1060px', margin:'0 auto', padding:'28px 36px 48px' }}>

        {/* Column headers */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 44px 1fr', marginTop:'12px', marginBottom:'2px', paddingLeft:'2px' }}>
          <span />
          <span />
          <span />
        </div>

        {/* Pairs */}
        {PIPELINE.map(({ pair, in: left, out: right }) => (
          <div key={pair}>
            <Divider label={pair} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 44px 1fr', alignItems:'stretch' }}>
              <PipeCard item={left}  isOut={false} onClick={() => navigate(left.ruta)} />
              <Arrow />
              <PipeCard item={right} isOut={true}  onClick={() => navigate(right.ruta)} />
            </div>
          </div>
        ))}

        {/* Motor — full width horizontal */}
        <Divider label="HERRAMIENTA" />
        <div
          onClick={() => navigate(MOTOR.ruta)}
          onMouseEnter={() => setMotorHov(true)}
          onMouseLeave={() => setMotorHov(false)}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate(MOTOR.ruta)}
          style={{
            display:'flex', alignItems:'center', gap:'20px',
            background: motorHov ? '#0e0e0e' : '#080808',
            border: `1px solid ${motorHov ? 'rgba(255,255,255,0.14)' : '#181818'}`,
            borderRadius:'10px', padding:'18px 24px',
            cursor:'pointer', transition:'border-color .18s, background .18s',
          }}
        >
          <span style={{ fontSize:'10px', fontWeight:'700', color:'#1c1c1c', letterSpacing:'2px', minWidth:'22px' }}>
            {MOTOR.step}
          </span>
          <div style={{ flex:1 }}>
            <span style={{ fontSize:'9px', letterSpacing:'2px', textTransform:'uppercase', color:'#252525', fontWeight:'700', display:'block', marginBottom:'3px' }}>
              {MOTOR.tag}
            </span>
            <h2 style={{ fontSize:'17px', fontWeight:'700', color:'#e0e0e0', margin:'0 0 3px' }}>
              {MOTOR.titulo}
            </h2>
            <p style={{ fontSize:'12px', color:'#333', margin:0 }}>
              {MOTOR.desc}
            </p>
          </div>
          <span style={{ fontSize:'14px', color: motorHov ? '#444' : '#1e1e1e', transition:'color .18s' }}>→</span>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
