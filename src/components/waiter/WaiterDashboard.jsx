import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TablesTab from './TablesTab';

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
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex justify-end items-center mb-6">
        <div className="bg-white shadow rounded-full px-4 py-2 flex items-center gap-3">
          <span className="font-semibold">{userData?.displayName || userData?.email}</span>
          <span className="text-gray-500">(Mesero)</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-3 py-1 rounded-full text-sm hover:bg-red-600"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      <TablesTab onOccupy={handleOccupy} onView={handleView} />
    </div>
  );
};

export default WaiterDashboard;