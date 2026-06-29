import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WaiterDashboard from '../components/waiter/WaiterDashboard';
import AdminDashboard from '../components/admin/AdminDashboard';
import ChefDashboard from '../components/chef/ChefDashboard';

/**
 * Página de panel principal.
 * Redirige al usuario al panel correspondiente según su rol
 * (mesero, cocinero o administrador).
 * Si el usuario no está autenticado o su rol no es válido,
 * redirige a la página de inicio de sesión.
 */
const Dashboard = () => {
  const { userData, loading } = useAuth();

  // Mostrar pantalla de carga mientras se obtienen los datos del usuario
  if (loading) return <div className="text-center mt-10">Cargando...</div>;

  // Si no hay datos del usuario, redirigir al inicio de sesión
  if (!userData) return <Navigate to="/login" replace />;

  // Redirigir al panel según el rol del usuario
  switch (userData.role) {
    case 'waiter':
      return <WaiterDashboard />;
    case 'chef':
      return <ChefDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      // Rol no reconocido: redirigir al inicio de sesión
      return <Navigate to="/login" replace />;
  }
};

export default Dashboard;