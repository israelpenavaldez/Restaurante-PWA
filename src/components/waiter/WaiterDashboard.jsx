import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TablesTab from './TablesTab';
import Button from '../ui/Button';

/**
 * Panel principal del mesero.
 * Muestra una barra superior con el nombre del usuario y un botón para cerrar sesión,
 * y debajo la cuadrícula de mesas activas (componente TablesTab).
 * Desde aquí el mesero puede atender mesas libres o revisar mesas ocupadas.
 */
const WaiterDashboard = () => {
  const navigate = useNavigate();
  const { userData, logout } = useAuth();

  /** Navega a la vista de atención de una mesa libre. */
  const handleOccupy = (tableId) => navigate(`/occupy/${tableId}`);

  /** Navega a la vista de detalle de una mesa ocupada. */
  const handleView = (tableId) => navigate(`/view/${tableId}`);

  /** Cierra la sesión del mesero y redirige al inicio de sesión. */
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-fondo">
      {/* ===== CABECERA ===== */}
      <div className="bg-tarjeta shadow-md border-b border-borde-claro">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <h1 className="text-2xl font-display font-bold text-texto">
              Panel de Mesero
            </h1>
            <div className="flex items-center justify-end space-x-4 mt-1">
              <span className="text-texto-claro font-medium">
                {userData?.displayName || userData?.email}
              </span>
              <Button variant="primary" onClick={handleLogout} className="text-sm py-1 px-3">
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== CUADRÍCULA DE MESAS ===== */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <TablesTab onOccupy={handleOccupy} onView={handleView} />
      </div>
    </div>
  );
};

export default WaiterDashboard;