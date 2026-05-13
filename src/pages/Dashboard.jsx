import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WaiterDashboard from '../components/waiter/WaiterDashboard';
import AdminDashboard from '../components/admin/AdminDashboard';
import ChefDashboard from '../components/chef/ChefDashboard';

const Dashboard = () => {
  const { userData, loading } = useAuth();
  if (loading) return <div className="text-center mt-10">Cargando...</div>;
  if (!userData) return <Navigate to="/login" replace />;
  
  switch (userData.role) {
    case 'waiter':
      return <WaiterDashboard />;
    case 'chef': 
      return <ChefDashboard />;
    case 'admin': 
      return <AdminDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
};

export default Dashboard;