import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscribeToAllOrders, updateOrder } from '../../services/firestoreService';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import PendingOrders from './PendingOrders';
import PreparingOrder from './PreparingOrder';

const ChefDashboard = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userData, logout } = useAuth();
  const navigate = useNavigate();

  const { checkChef } = usePermissions();
  const { withLock, isLocked } = useActionLock();

  // Suscripción a todas las órdenes (en tiempo real)
  useEffect(() => {
    const unsubscribe = subscribeToAllOrders((allOrders) => {
      setOrders(allOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Aplanar los lotes
  const allBatches = orders.flatMap(order =>
    (order.batches || []).map(batch => ({
      orderId: order.id,
      batchId: batch.batchId,
      batch: batch,
      tableNumber: order.tableNumber,
      clientName: order.clientName,
      prepaid: order.prepaid || false
    }))
  );

  const pendingBatches = allBatches.filter(b => b.batch.status === 'pending');
  pendingBatches.sort((a, b) => a.batch.timestamp.toDate() - b.batch.timestamp.toDate());

  const preparingBatches = allBatches.filter(b => b.batch.status === 'preparing');
  preparingBatches.sort((a, b) => a.batch.timestamp.toDate() - b.batch.timestamp.toDate());

  // Proteger startPreparing
  const startPreparing = (orderId, batchId) => {
    withLock(async () => {
      try {
        checkChef();
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        const updatedBatches = order.batches.map(b =>
          b.batchId === batchId ? { ...b, status: 'preparing' } : b
        );
        await updateOrder(orderId, { batches: updatedBatches });
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  // Proteger markItemReady
  const markItemReady = (orderId, batchId, itemId) => {
    withLock(async () => {
      try {
        checkChef();
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        const updatedBatches = order.batches.map(batch => {
          if (batch.batchId !== batchId) return batch;
          const updatedItems = batch.items.map(item =>
            item.id === itemId ? { ...item, status: 'ready' } : item
          );
          return { ...batch, items: updatedItems };
        });
        await updateOrder(orderId, { batches: updatedBatches });
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  // Proteger unmarkItemReady
  const unmarkItemReady = (orderId, batchId, itemId) => {
    withLock(async () => {
      try {
        checkChef();
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        const updatedBatches = order.batches.map(batch => {
          if (batch.batchId !== batchId) return batch;
          const updatedItems = batch.items.map(item =>
            item.id === itemId ? { ...item, status: 'pending' } : item
          );
          return { ...batch, items: updatedItems };
        });
        await updateOrder(orderId, { batches: updatedBatches });
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  if (loading) return <div className="text-center mt-10">Cargando órdenes...</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Panel de Cocina</h1>
          <div className="flex items-center space-x-4">
            <span>{userData?.displayName || userData?.email} (Cocinero)</span>
            <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-md">Cerrar sesión</button>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-2 ${activeTab === 'pending' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            >
              Pendiente ({pendingBatches.length})
            </button>
            <button
              onClick={() => setActiveTab('preparing')}
              className={`py-2 ${activeTab === 'preparing' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
            >
              En preparación ({preparingBatches.length})
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'pending' && (
          <PendingOrders
            batches={pendingBatches}
            onStartPreparing={startPreparing}
            isLocked={isLocked}
          />
        )}
        {activeTab === 'preparing' && (
          <div className="space-y-6">
            {preparingBatches.map(batch => (
              <PreparingOrder
                key={`${batch.orderId}_${batch.batchId}`}
                orderId={batch.orderId}
                batch={batch.batch}
                tableNumber={batch.tableNumber}
                clientName={batch.clientName}
                prepaid={batch.prepaid}
                onMarkItemReady={markItemReady}
                onUnmarkItemReady={unmarkItemReady}
                isLocked={isLocked}
              />
            ))}
            {preparingBatches.length === 0 && (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No hay lotes en preparación.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChefDashboard;