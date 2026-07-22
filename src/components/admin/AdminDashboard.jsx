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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-fondo">
      {/* ===== CABECERA ===== */}
      <div className="bg-tarjeta shadow-md border-b border-borde-claro">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex justify-left items-center gap-3">
              {/* Botón de menú lateral */}
              <Button
                variant="return"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="transition p-2 rounded-xl"
                aria-label="Abrir menú"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
              <h1 className="text-2xl font-display font-bold text-texto">
                Panel de Administrador
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* ===== MENÚ LATERAL (OVERLAY) ===== */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* Fondo oscuro */}
          <div
            className="fixed inset-0 bg-texto/30 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Panel lateral */}
          <div className="relative w-64 bg-tarjeta shadow-xl border-r border-borde-claro z-50 animate-slide-in-left">
            <div className="flex flex-col px-6 py-4 border-b border-borde-claro">
              <span className="text-texto-claro font-bold">
                {userData?.displayName}
              </span>
              <span className="text-texto-claro text-sm">
                {userData?.email}
              </span>
            </div>
            <nav className="py-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full text-left px-6 py-3 font-medium text-sm transition ${
                    activeTab === tab.id
                      ? 'bg-acento/10 text-acento border-r-4 border-acento'
                      : 'text-texto-claro hover:bg-tarjeta-alt/20 hover:text-texto'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="absolute bottom-0 w-full p-4 border-t border-borde-claro">
              <Button 
                variant="cancel" 
                onClick={handleLogout} 
                className="text-sm py-1 px-3"
              >
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CONTENIDO ===== */}
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