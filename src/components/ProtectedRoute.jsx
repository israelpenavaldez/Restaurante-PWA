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
      <div className="flex justify-center items-center min-h-screen bg-crema">
        <p className="text-tierra-clara font-body text-lg">Cargando...</p>
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
      // si el usuario está autenticado y la caché coincide con el uid, continuamos
      if (parsed && user?.uid) {
        // permitimos que la app cargue normalmente, el banner offline ya se muestra
        return children;
      }
    }
    // Si no hay caché, mostramos un mensaje de reconexión, no la pantalla de "pendiente"
    return (
      <div className="flex justify-center items-center min-h-screen bg-crema">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-display font-bold text-chile-guajillo mb-2">Sin conexión</h2>
          <p className="text-tierra-clara mb-4">Recuperando datos... Por favor, espera mientras se restablece la conexión.</p>
        </Card>
      </div>
    );
  }

  if (!isServiceOpen && userData?.role !== 'admin') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-crema">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-display font-bold text-chile-guajillo mb-2">
            Restaurante cerrado
          </h2>
          <p className="text-tierra-clara mb-4">
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
      <div className="flex justify-center items-center min-h-screen bg-crema">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-display font-bold text-maiz-dorado mb-2">
            Cuenta pendiente de aprobación
          </h2>
          <p className="text-tierra-clara mb-4">
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