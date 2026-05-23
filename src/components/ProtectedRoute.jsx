import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useOnlineStatus from '../hooks/useOnlineStatus';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, userData, loading, logout, isServiceOpen } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-fondo">
        <p className="text-texto-claro font-body text-lg">Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!userData && !isOnline) {
    const cached = sessionStorage.getItem('cachedUserData');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && user?.uid) {
        return children;
      }
    }
    return (
      <div className="flex justify-center items-center min-h-screen bg-fondo">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-display font-bold text-acento mb-2">Sin conexión</h2>
          <p className="text-texto-claro mb-4">Recuperando datos... Por favor, espera mientras se restablece la conexión.</p>
        </Card>
      </div>
    );
  }

  if (!isServiceOpen && userData?.role !== 'admin') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-fondo">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-display font-bold text-acento mb-2">
            Restaurante cerrado
          </h2>
          <p className="text-texto-claro mb-4">
            El restaurante no está abierto en este momento. Por favor, intenta más tarde.
          </p>
          <Button onClick={handleLogout} variant="primary">
            Cerrar sesión
          </Button>
        </Card>
      </div>
    );
  }

  if (!userData?.enabled || userData?.role === 'pending') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-fondo">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-display font-bold text-texto-aviso mb-2">
            Cuenta pendiente de aprobación
          </h2>
          <p className="text-texto-claro mb-4">
            Tu cuenta está en espera de ser activada por el administrador.
          </p>
          <Button onClick={handleLogout} variant="primary">
            Cerrar sesión
          </Button>
        </Card>
      </div>
    );
  }

  if (requiredRole && userData?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;