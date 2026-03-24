import React, { useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

export const AuthContext = React.createContext(null);

function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    return token && userRaw ? { token, user: JSON.parse(userRaw) } : null;
  });

  const contextValue = useMemo(
    () => ({
      auth,
      login: (payload) => {
        localStorage.setItem('token', payload.token);
        localStorage.setItem('user', JSON.stringify(payload.user));
        setAuth(payload);
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setAuth(null);
      }
    }),
    [auth]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      <Routes>
        <Route path="/login" element={!auth ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/" element={auth ? <DashboardPage /> : <Navigate to="/login" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}

export default App;
