import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Herramienta from './pages/Herramienta';
import Profile from './pages/Profile';
import Censo from './pages/Censo';
import Registro from './pages/Registro';
import Resumen from './pages/Resumen';
import Estadisticas from './pages/Estadisticas';  // <-- Nuevo dashboard Fase 2
import { ApiKeyProvider } from './context/ApiKeyContext';

function App() {
  return (
    <ApiKeyProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/herramienta" element={<Herramienta />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/censo" element={<Censo />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/resumen" element={<Resumen />} />
          <Route path="/estadisticas" element={<Estadisticas />} />  {/* <-- Nueva ruta Fase 2 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ApiKeyProvider>
  );
}

export default App;
