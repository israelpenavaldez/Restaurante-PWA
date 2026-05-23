import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { subscribeToAllOrders, updateOrder } from '../../services/firestoreService';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import PendingOrders from './PendingOrders';
import PreparingOrder from './PreparingOrder';
import Card from '../ui/Card';
import Button from '../ui/Button';

const ChefDashboard = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { userData, logout } = useAuth();
  const navigate = useNavigate();

  const { checkChef } = usePermissions();
  const { withLock, isLocked } = useActionLock();
  const { notify } = useNotification();
  const isOnline = useOnlineStatus();

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
        notify(err.message, 'error');
        navigate('/dashboard');
      }
    });
  };

  const markItemReady = (orderId, batchId, itemId, readyQuantity) => {
    withLock(async () => {
      try {
        checkChef();
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const updatedBatches = order.batches.map(batch => {
          if (batch.batchId !== batchId) return batch;
          const itemIndex = batch.items.findIndex(item => item.id === itemId);
          if (itemIndex === -1) return batch;
          const item = { ...batch.items[itemIndex] };
          const quantity = item.quantity || 1;
          const qtyToMark = Math.min(readyQuantity, quantity);
          if (qtyToMark <= 0) return batch;

          let updatedItems;
          if (qtyToMark === quantity) {
            updatedItems = batch.items.map((it, idx) =>
              idx === itemIndex ? { ...it, status: 'ready' } : it
            );
          } else {
            const readyItem = { ...item, id: Date.now(), quantity: qtyToMark, status: 'ready' };
            const pendingItem = { ...item, quantity: quantity - qtyToMark, status: 'pending' };
            updatedItems = [
              ...batch.items.slice(0, itemIndex),
              pendingItem,
              readyItem,
              ...batch.items.slice(itemIndex + 1)
            ];
          }
          return { ...batch, items: updatedItems };
        });
        await updateOrder(orderId, { batches: updatedBatches });
      } catch (err) {
        notify(err.message, 'error');
        navigate('/dashboard');
      }
    });
  };

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
        notify(err.message, 'error');
        navigate('/dashboard');
      }
    });
  };

  if (loading) return <div className="text-center mt-10 text-texto-claro font-body">Cargando órdenes...</div>;

  return (
    <div className="min-h-screen bg-fondo">
      {/* Header */}
      <div className="bg-tarjeta shadow-md border-b border-borde-claro">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-display font-bold text-texto">Panel de Cocina</h1>
          <div className="flex items-center space-x-4">
            <span className="text-texto font-medium">{userData?.displayName || userData?.email} (Cocinero)</span>
            <Button variant="primary" onClick={handleLogout} className="text-sm py-1 px-3">
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="border-b border-borde-claro bg-tarjeta">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'pending'
                  ? 'border-acento text-acento'
                  : 'border-transparent text-texto-claro hover:text-texto hover:border-borde'
              }`}
            >
              Pendiente ({pendingBatches.length})
            </button>
            <button
              onClick={() => setActiveTab('preparing')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'preparing'
                  ? 'border-acento text-acento'
                  : 'border-transparent text-texto-claro hover:text-texto hover:border-borde'
              }`}
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
              <Card className="text-center p-8">
                <p className="text-texto-claro">No hay lotes en preparación.</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChefDashboard;