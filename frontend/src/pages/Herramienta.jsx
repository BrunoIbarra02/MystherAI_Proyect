import React, { useState, useEffect } from "react";
import AppNavbar from "../components/AppNavbar";
import logoImg from "../assets/logo.jpeg";
import api from "../utils/api";
import { useUser } from "../context/UserContext";

// Gradio corre en ECS puerto 7860 (mismo ALB que la API). Se abre en pestaña
// nueva, así que HTTP no da mixed content. Override con VITE_GRADIO_URL.
const GRADIO_URL = import.meta.env.VITE_GRADIO_URL || "http://mysther-ai-alb-1734290767.eu-central-1.elb.amazonaws.com:7860";

const extractDriveID = (url) => {
  if (!url) return null;
  const m = String(url).match(/(?:file\/d\/|id=|\/folders\/|open\?id=|\/d\/)([a-zA-Z0-9_-]{19,})/);
  return m ? m[1] : null;
};
const thumbUrl = (url) => {
  const id = extractDriveID(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w640` : null;
};

const Herramienta = () => {
  const { user } = useUser();
  const [reservados, setReservados] = useState([]);
  const [sel, setSel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/profile-data/")
      .then((r) => {
        const res = r.data?.reserved || [];
        setReservados(res);
        if (res.length) setSel(String(res[0].id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selVideo = reservados.find((v) => String(v.id) === String(sel));
  const thumb = thumbUrl(selVideo?.drive_link);
  const gradioUrl = (v) =>
    `${GRADIO_URL}/?video_url=${encodeURIComponent(v?.drive_link || "")}` +
    `&usuario=${encodeURIComponent(user?.display_name || "")}` +
    `&video_id=${encodeURIComponent(v?.id || "")}`;

  const abrir = () => {
    if (selVideo) window.open(gradioUrl(selVideo), "_blank");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "var(--font-body)" }}>
      <AppNavbar backTo="/dashboard" backLabel="Dashboard" />

      <div style={{ maxWidth: "620px", margin: "0 auto", padding: "48px 24px 80px", position: "relative" }}>
        <img src={logoImg} alt="" aria-hidden="true" style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: "460px", height: "460px", objectFit: "cover", borderRadius: "50%",
          opacity: 0.08, filter: "blur(30px) saturate(0)", pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ color: "#444", fontSize: "11px", letterSpacing: "4px", textTransform: "uppercase", textAlign: "center", margin: "0 0 6px" }}>
            MystherAI Studio
          </p>
          <h1 style={{ fontSize: "20px", fontWeight: 800, textAlign: "center", margin: "0 0 32px", letterSpacing: "1px" }}>
            Estilizar un video reservado
          </h1>

          {loading ? (
            <p style={{ textAlign: "center", color: "#555" }}>Cargando tus reservas…</p>
          ) : reservados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", border: "1px dashed #222", borderRadius: "12px" }}>
              <p style={{ color: "#888", fontSize: "14px", margin: "0 0 8px" }}>No tienes videos reservados.</p>
              <p style={{ color: "#555", fontSize: "12px", margin: 0 }}>Resérvalos desde el <strong style={{ color: "#888" }}>Catálogo</strong> y aparecerán aquí.</p>
            </div>
          ) : (
            <>
              {/* Thumbnail del video seleccionado */}
              <div style={{
                width: "100%", aspectRatio: "16/9", borderRadius: "12px", overflow: "hidden",
                background: "#0d0d0d", border: "1px solid #1c1c1c", marginBottom: "16px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {thumb ? (
                  <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : (
                  <span style={{ color: "#444", fontSize: "12px" }}>Sin miniatura</span>
                )}
              </div>

              {/* Dropdown de reservados */}
              <label style={{ display: "block", fontSize: "10px", letterSpacing: "2px", color: "#555", textTransform: "uppercase", margin: "0 0 8px" }}>
                Tus videos reservados ({reservados.length})
              </label>
              <select
                value={sel}
                onChange={(e) => setSel(e.target.value)}
                style={{
                  width: "100%", padding: "13px 14px", background: "#161616", color: "#e0e0e0",
                  border: "1px solid #262626", borderRadius: "8px", fontSize: "14px", marginBottom: "22px",
                  cursor: "pointer",
                }}
              >
                {reservados.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {(v.video_id || v.id) + (v.mapa ? `  ·  ${v.mapa}` : "") + (v.especie ? `  ·  ${v.especie}` : "")}
                  </option>
                ))}
              </select>

              <button
                onClick={abrir}
                style={{
                  width: "100%", padding: "18px", fontSize: "14px", fontWeight: 700, letterSpacing: "2px",
                  textTransform: "uppercase", background: "#fff", color: "#000", border: "none",
                  borderRadius: "8px", cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#d4d4d4"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
              >
                Abrir en Gradio  →
              </button>
              <p style={{ textAlign: "center", color: "#333", fontSize: "10px", margin: "12px 0 0" }}>
                Se abre en pestaña nueva con el video ya cargado
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Herramienta;
