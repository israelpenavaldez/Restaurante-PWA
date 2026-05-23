import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TablesTab from './TablesTab';
import Button from '../ui/Button';
import Card from '../ui/Card';

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
    <div className="max-w-7xl mx-auto p-4 bg-fondo min-h-screen">
      <div className="flex justify-end items-center mb-8">
        <Card className="rounded-full px-5 py-2 flex items-center gap-3 shadow-sm">
          <span className="font-semibold text-texto">
            {userData?.displayName || userData?.email}
          </span>
          <span className="text-texto-claro text-sm">(Mesero)</span>
          <Button variant="primary" onClick={handleLogout} className="text-sm px-3 py-1">
            Cerrar sesión
          </Button>
        </Card>
      </div>
      <TablesTab onOccupy={handleOccupy} onView={handleView} />
    </div>
  );
};

export default WaiterDashboard;