import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import TablesTab from './TablesTab';
import Button from '../ui/Button';

/**
 * Panel principal del mesero.
 * Muestra una cabecera con un botón de menú lateral que contiene
 * los datos del usuario y la opción de cerrar sesión.
 * El contenido principal es la cuadrícula de mesas activas.
 */
const WaiterDashboard = () => {
  const navigate = useNavigate();
  const { userData, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <div className="flex items-center gap-3 py-4">
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
              Panel de Mesero
            </h1>
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

      {/* ===== CUADRÍCULA DE MESAS ===== */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <TablesTab onOccupy={handleOccupy} onView={handleView} />
      </div>
    </div>
  );
};

export default WaiterDashboard;