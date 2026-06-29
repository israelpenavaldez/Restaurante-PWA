import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminHome from './AdminHome';
import AdminMenu from './AdminMenu';
import AdminReports from './AdminReports';
import AdminEmployees from './AdminEmployees';
import AdminTables from './AdminTables';
import Button from '../ui/Button';

/**
 * Panel de administración.
 * Muestra una barra de navegación con pestañas que permiten al administrador
 * gestionar el inicio, las mesas, el menú, los reportes y los empleados.
 */
const AdminDashboard = () => {
  // Pestaña activa actual
  const [activeTab, setActiveTab] = useState('home');
  const { userData, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Sincroniza la pestaña activa cuando se navega desde otras vistas
   * que pasan el estado `activeTab` en la ubicación.
   */
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Limpia el estado para que no persista al recargar la página
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  /** Cierra la sesión del usuario y redirige al inicio de sesión. */
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Definición de las pestañas disponibles en el panel
  const tabs = [
    { id: 'home', label: 'Inicio' },
    { id: 'tables', label: 'Editar mesas' },
    { id: 'menu', label: 'Menú de platillos y bebidas' },
    { id: 'reports', label: 'Reportes' },
    { id: 'employees', label: 'Empleados' },
  ];

  return (
    <div className="min-h-screen bg-fondo">
      {/* ===== CABECERA ===== */}
      <div className="bg-tarjeta shadow-md border-b border-borde-claro">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-display font-bold text-texto">
              Panel de Administrador
            </h1>
            <div className="flex items-center space-x-4">
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

      {/* ===== BARRA DE PESTAÑAS ===== */}
      <div className="border-b border-borde-claro bg-tarjeta">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'border-acento text-acento'
                    : 'border-transparent text-texto-claro hover:text-texto hover:border-borde'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* ===== CONTENIDO DE LA PESTAÑA ACTIVA ===== */}
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