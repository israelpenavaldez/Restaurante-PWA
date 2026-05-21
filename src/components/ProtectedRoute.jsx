import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, userData, loading, logout, isServiceOpen } = useAuth();
  const navigate = useNavigate();

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