import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useOnlineStatus from '../hooks/useOnlineStatus';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

/**
 * Componente de protección de rutas.
 * Verifica que el usuario esté autenticado, tenga una cuenta habilitada
 * y que el servicio esté abierto (excepto para administradores).
 * También maneja el caso de pérdida de conexión usando una caché local.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Componente hijo a renderizar si se cumplen todas las condiciones.
 * @param {string} [props.requiredRole] - Rol requerido para acceder a la ruta (opcional).
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, userData, loading, logout, isServiceOpen } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  /** Cierra la sesión y redirige al inicio de sesión. */
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // ===== ESTADO DE CARGA =====
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-fondo">
        <p className="text-texto-claro font-body text-lg">Cargando...</p>
      </div>
    );
  }

  // ===== USUARIO NO AUTENTICADO =====
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ===== MODO OFFLINE: INTENTAR USAR CACHÉ =====
  if (!userData && !isOnline) {
    const cached = sessionStorage.getItem('cachedUserData');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && user?.uid) {
        // Permitir acceso con datos en caché mientras se recupera la conexión
        return children;
      }
    }
    // Sin caché disponible: mostrar mensaje de espera
    return (
      <div className="flex justify-center items-center min-h-screen bg-fondo">
        <Card className="max-w-md text-center">
          <h2 className="text-2xl font-display font-bold text-acento mb-2">Sin conexión</h2>
          <p className="text-texto-claro mb-4">
            Recuperando datos... Por favor, espera mientras se restablece la conexión.
          </p>
        </Card>
      </div>
    );
  }

  // ===== SERVICIO CERRADO (excepto admin) =====
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

  // ===== CUENTA PENDIENTE O DESHABILITADA =====
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

  // ===== ROL REQUERIDO NO COINCIDE =====
  if (requiredRole && userData?.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // ===== ACCESO PERMITIDO =====
  return children;
};

export default ProtectedRoute;