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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <OfflineBanner />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signout" element={<SignOut />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/occupy/:tableId" element={<ProtectedRoute requiredRole="waiter"><OccupyTable /></ProtectedRoute>} />
            <Route path="/view/:tableId" element={<ProtectedRoute requiredRole="waiter"><ViewTable /></ProtectedRoute>} />
            <Route path="/add-product/:tableId/:orderId" element={<ProtectedRoute requiredRole="waiter"><AddProductToOrder /></ProtectedRoute>} />
            <Route path="/add-client/:tableId" element={<ProtectedRoute requiredRole="waiter"><AddClientToTable /></ProtectedRoute>} />
            <Route path="/generate-bill/:tableId/:orderId" element={<ProtectedRoute requiredRole="waiter"><GenerateBill /></ProtectedRoute>} />
            <Route path="/admin/edit-category/:categoryId" element={<ProtectedRoute requiredRole="admin"><EditCategory /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;