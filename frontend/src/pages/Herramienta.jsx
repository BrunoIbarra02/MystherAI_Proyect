import React from "react";
import AppNavbar from "../components/AppNavbar";
import logoImg from "../assets/logo.jpeg";

const GRADIO_URL = "http://mysther-ai-alb-1734290767.eu-central-1.elb.amazonaws.com:7860/";

const Herramienta = () => {
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "var(--font-body)" }}>
      <AppNavbar backTo="/dashboard" backLabel="Dashboard" />

      <div style={{
        position: "fixed", top: "64px", left: 0, right: 0, bottom: 0,
        background: "#000", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "28px",
      }}>
        {/* Logo difuminado de fondo */}
        <img
          src={logoImg}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "460px", height: "460px",
            objectFit: "cover", borderRadius: "50%",
            opacity: 0.12, filter: "blur(28px) saturate(0)",
            pointerEvents: "none", userSelect: "none",
            boxShadow: "0 0 160px 80px rgba(255,255,255,0.08)",
          }}
        />

        <p style={{
          position: "relative", color: "#333", fontSize: "11px",
          letterSpacing: "4px", textTransform: "uppercase", margin: 0,
        }}>
          MystherAI Studio
        </p>

        <button
          style={{
            position: "relative",
            padding: "18px 56px",
            fontSize: "15px",
            fontWeight: "700",
            letterSpacing: "3px",
            textTransform: "uppercase",
            background: "#fff",
            color: "#000",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#d4d4d4"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
          onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.97)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
          onClick={() => window.open(GRADIO_URL, "_blank")}
        >
          ABRIR GRADIO →
        </button>

        <p style={{ position: "relative", color: "#222", fontSize: "10px", margin: 0 }}>
          Se abre en pestaña nueva
        </p>
      </div>
    </div>
  );
};

export default Herramienta;
