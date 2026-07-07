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
import { UserProvider, useUser } from './context/UserContext';

// Waits for session verification before protecting — prevents race-condition logout.
// If user is cached (localStorage), renders immediately while verifying in background.
// If no cache and still loading → spinner. If no session → login.
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useUser();
  if (!user && loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: '100vh', background: '#000' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.08)',
                      borderTop: '2px solid rgba(192,192,192,0.5)',
                      animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return children;
};

function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <ThemeProvider>
      <UserProvider>
      <ApiKeyProvider>
        {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

        <Router>
          <Routes>
            <Route path="/"              element={<Login />} />
            <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/herramienta"   element={<ProtectedRoute><Herramienta /></ProtectedRoute>} />
            <Route path="/profile"       element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/censo"         element={<ProtectedRoute><Censo /></ProtectedRoute>} />
            <Route path="/registro"      element={<ProtectedRoute><Registro /></ProtectedRoute>} />
            <Route path="/resumen"       element={<ProtectedRoute><Resumen /></ProtectedRoute>} />
            <Route path="/estadisticas"  element={<ProtectedRoute><Estadisticas /></ProtectedRoute>} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ApiKeyProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

export default App;

