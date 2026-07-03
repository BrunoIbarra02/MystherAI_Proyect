import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Herramienta from './pages/Herramienta';
import Profile from './pages/Profile';
import Censo from './pages/Censo';
import Registro from './pages/Registro';
import Resumen from './pages/Resumen';
import Estadisticas from './pages/Estadisticas';
import SplashScreen from './components/SplashScreen';
import { ApiKeyProvider } from './context/ApiKeyContext';
import { ThemeProvider } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';

function App() {
  // Controla si el splash ya terminó
  const [splashDone, setSplashDone] = useState(false);

  return (
    /* ThemeProvider aplica data-theme en <html> y persiste en localStorage */
    <ThemeProvider>
      <UserProvider>
      <ApiKeyProvider>
        {/* Pantalla de carga inicial */}
        {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

        <Router>
          <Routes>
            <Route path="/"              element={<Login />} />
            <Route path="/dashboard"     element={<Dashboard />} />
            <Route path="/herramienta"   element={<Herramienta />} />
            <Route path="/profile"       element={<Profile />} />
            <Route path="/censo"         element={<Censo />} />
            <Route path="/registro"      element={<Registro />} />
            <Route path="/resumen"       element={<Resumen />} />
            <Route path="/estadisticas"  element={<Estadisticas />} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ApiKeyProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;

