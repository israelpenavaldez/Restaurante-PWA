import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminHome from './AdminHome';
import AdminMenu from './AdminMenu';
import AdminReports from './AdminReports';
import AdminEmployees from './AdminEmployees';
import AdminTables from './AdminTables';
import Button from '../ui/Button';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('home');
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const tabs = [
    { id: 'home', label: 'Inicio' },
    { id: 'tables', label: 'Editar mesas' },
    { id: 'menu', label: 'Menú de platillos y bebidas' },
    { id: 'reports', label: 'Reportes' },
    { id: 'employees', label: 'Empleados' },
  ];

  return (
    <div className="min-h-screen bg-crema">
      {/* Header */}
      <div className="bg-hueso shadow-md border-b border-barro-claro/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-display font-bold text-chocolate-oscuro">
              Panel Administrador
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-tierra-clara font-medium">
                {userData?.displayName || userData?.email}
              </span>
              <Button variant="primary" onClick={handleLogout} className="text-sm py-1 px-3">
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-barro-claro/30 bg-hueso">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'border-chile-guajillo text-chile-guajillo'
                    : 'border-transparent text-tierra-clara hover:text-chocolate-oscuro hover:border-barro-claro'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Contenido */}
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