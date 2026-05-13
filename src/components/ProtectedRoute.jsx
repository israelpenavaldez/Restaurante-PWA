import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, userData, loading, logout, isServiceOpen } = useAuth(); // ← extraemos isServiceOpen
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return <div className="text-center mt-10 text-gray-500">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Si el servicio está cerrado y el usuario NO es administrador
  if (!isServiceOpen && userData?.role !== 'admin') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Restaurante cerrado</h2>
          <p className="text-gray-600 mb-4">
            El restaurante no está abierto en este momento. Por favor, intenta más tarde.
          </p>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // Si el usuario no está habilitado o está pendiente
  if (!userData?.enabled || userData?.role === 'pending') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center max-w-md">
          <h2 className="text-xl font-bold text-yellow-600 mb-2">Cuenta pendiente de aprobación</h2>
          <p className="text-gray-600 mb-4">
            Tu cuenta está en espera de ser activada por el administrador.
          </p>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  // Verificar rol requerido (si se especifica)
  if (requiredRole && userData?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;