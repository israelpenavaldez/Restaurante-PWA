import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import AdminHome from './AdminHome';
import AdminMenu from './AdminMenu';
import AdminReports from './AdminReports';
import AdminEmployees from './AdminEmployees';
import AdminTables from './AdminTables';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Limpiar el estado para que no persista al recargar
      window.history.replaceState({}, document.title);
    }
  }, [location]);
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Panel Administrador</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                {userData?.displayName || userData?.email}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'home', label: 'Inicio' },
              { id: 'tables', label: 'Editar mesas' },
              { id: 'menu', label: 'Menú de platillos y bebidas' },
              { id: 'reports', label: 'Reportes' },
              { id: 'employees', label: 'Empleados' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && <AdminHome />}
        {activeTab === 'tables' && <AdminTables />}
        {activeTab === 'menu' && <AdminMenu />}
        {activeTab === 'reports' && <AdminReports />}
        {activeTab === 'employees' && <AdminEmployees />}
      </div>
    </div>
  );
};

export default AdminDashboard;