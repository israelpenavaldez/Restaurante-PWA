import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TablesTab from './TablesTab';
import Button from '../ui/Button';

const WaiterDashboard = () => {
  const navigate = useNavigate();
  const { userData, logout } = useAuth();

  const handleOccupy = (tableId) => navigate(`/occupy/${tableId}`);
  const handleView = (tableId) => navigate(`/view/${tableId}`);
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-fondo">
      {/* Header */}
      <div className="bg-tarjeta shadow-md border-b border-borde-claro">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-display font-bold text-texto">Panel de Mesero</h1>
          <div className="flex items-center space-x-4">
            <span className="text-texto font-medium">
              {userData?.displayName || userData?.email}
            </span>
            <Button variant="primary" onClick={handleLogout} className="text-sm py-1 px-3">
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <TablesTab onOccupy={handleOccupy} onView={handleView} />
      </div>
    </div>
  );
};

export default WaiterDashboard;