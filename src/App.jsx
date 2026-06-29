import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SignOut from './pages/SignOut';
import OccupyTable from './components/waiter/OccupyTable';
import ViewTable from './components/waiter/ViewTable';
import AddProductToOrder from './components/waiter/AddProductToOrder';
import AddClientToTable from './components/waiter/AddClientToTable';
import GenerateBill from './components/waiter/GenerateBill';
import EditCategory from './components/admin/EditCategory';
import OfflineBanner from './components/ui/OfflineBanner';

/**
 * Componente raíz de la aplicación.
 *
 * Establece la estructura principal de rutas y proveedores de contexto.
 * El orden de los proveedores es importante:
 * - `BrowserRouter` envuelve todo para habilitar el enrutamiento.
 * - `AuthProvider` proporciona el contexto de autenticación a toda la app.
 * - `NotificationProvider` proporciona el sistema de notificaciones (toasts, modales).
 * - `OfflineBanner` se muestra en todas las vistas si no hay conexión.
 *
 * Las rutas están protegidas según el rol del usuario mediante `ProtectedRoute`.
 * La ruta raíz ("/") redirige al panel correspondiente según el rol del usuario autenticado.
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          {/* Banner de desconexión visible en todas las vistas */}
          <OfflineBanner />

          <Routes>
            {/* ===== AUTENTICACIÓN ===== */}
            <Route path="/login" element={<Login />} />
            <Route path="/signout" element={<SignOut />} />

            {/* ===== PANEL PRINCIPAL (redirige según rol) ===== */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* ===== MESERO ===== */}
            <Route
              path="/occupy/:tableId"
              element={
                <ProtectedRoute requiredRole="waiter">
                  <OccupyTable />
                </ProtectedRoute>
              }
            />
            <Route
              path="/view/:tableId"
              element={
                <ProtectedRoute requiredRole="waiter">
                  <ViewTable />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-product/:tableId/:orderId"
              element={
                <ProtectedRoute requiredRole="waiter">
                  <AddProductToOrder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-client/:tableId"
              element={
                <ProtectedRoute requiredRole="waiter">
                  <AddClientToTable />
                </ProtectedRoute>
              }
            />
            <Route
              path="/generate-bill/:tableId/:orderId"
              element={
                <ProtectedRoute requiredRole="waiter">
                  <GenerateBill />
                </ProtectedRoute>
              }
            />

            {/* ===== ADMINISTRADOR ===== */}
            <Route
              path="/admin/edit-category/:categoryId"
              element={
                <ProtectedRoute requiredRole="admin">
                  <EditCategory />
                </ProtectedRoute>
              }
            />

            {/* ===== RUTA POR DEFECTO ===== */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;