import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { subscribeToTableOrders, updateOrder } from '../../services/firestoreService';
import { useNotification } from '../../context/NotificationContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const ViewTable = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();

  const [realTableNumber, setRealTableNumber] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();

  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();
  const { notify, confirm, prompt } = useNotification();

  useEffect(() => {
    const fetchTableNumber = async () => {
      const tableDoc = await getDoc(doc(db, 'tables', tableId));
      if (tableDoc.exists()) {
        setRealTableNumber(tableDoc.data().number);
      } else {
        console.error('Mesa no encontrada');
        navigate('/dashboard');
      }
    };
    fetchTableNumber();
  }, [tableId, navigate]);

  useEffect(() => {
    if (realTableNumber === null) return;
    const unsubscribe = subscribeToTableOrders(realTableNumber, (allOrders) => {
      const activeOrders = allOrders.filter(o => o.status !== 'completed' && o.status !== 'paid');
      setOrders(activeOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [realTableNumber]);

  // Entregar un producto (ahora con confirmación)
  const handleDeliverItem = (orderId, batchId, itemId) => {
    withLock(async () => {
      try {
        checkWaiter();
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const batch = order.batches.find(b => b.batchId === batchId);
        const item = batch?.items.find(i => i.id === itemId);
        if (!item) return;

        const ok = await confirm(`¿Entregar "${item.name}"?`);
        if (!ok) return;

        const updatedBatches = order.batches.map(batch => {
          if (batch.batchId !== batchId) return batch;
          const updatedItems = batch.items.map(item =>
            item.id === itemId ? { ...item, status: 'delivered' } : item
          );
          return { ...batch, items: updatedItems };
        });

        const updatedBatch = updatedBatches.find(b => b.batchId === batchId);
        const allItemsInBatchDelivered = updatedBatch.items.every(item => item.status === 'delivered' || item.status === 'cancelled');
        if (allItemsInBatchDelivered && updatedBatch.status !== 'delivered') {
          updatedBatch.status = 'delivered';
          updatedBatch.deliveredAt = Timestamp.now();
        }
        const allBatchesDelivered = updatedBatches.every(batch => batch.status === 'delivered');
        let updatedOrderStatus = order.status;
        let deliveredAt = order.deliveredAt;
        if (allBatchesDelivered && order.status !== 'delivered') {
          updatedOrderStatus = 'delivered';
          if (!deliveredAt) deliveredAt = Timestamp.now();
        }
        await updateOrder(orderId, { batches: updatedBatches, status: updatedOrderStatus, deliveredAt });
      } catch (err) {
        notify(err.message, 'error');
        navigate('/dashboard');
      }
    });
  };

  // Cancelar un producto (ahora permite cancelar también si está 'ready', con confirmación)
  const handleCancelItem = (orderId, batchId, itemId) => {
    withLock(async () => {
      try {
        checkWaiter();
        const order = orders.find(o => o.id === orderId);
        if (!order || order.prepaid) {
          notify('No se pueden cancelar productos en una orden prepagada', 'warning');
          return;
        }
        const batch = order.batches.find(b => b.batchId === batchId);
        const item = batch?.items.find(i => i.id === itemId);
        if (!item || (item.status !== 'pending' && item.status !== 'ready')) return;

        const ok = await confirm(`¿Cancelar "${item.name}"?`);
        if (!ok) return;

        let quantityToCancel = item.quantity;
        if (item.quantity > 1) {
          const input = await prompt(`¿Cuántas unidades de "${item.name}" cancelar? (1-${item.quantity})`, '1');
          if (!input) return;
          const qty = parseInt(input);
          if (isNaN(qty) || qty < 1 || qty > item.quantity) {
            notify('Cantidad no válida', 'warning');
            return;
          }
          quantityToCancel = qty;
        }

        let updatedItems;
        if (quantityToCancel === item.quantity) {
          updatedItems = batch.items.map(i =>
            i.id === itemId ? { ...i, status: 'cancelled', cancelledAt: Timestamp.now() } : i
          );
        } else {
          const remaining = { ...item, quantity: item.quantity - quantityToCancel, status: 'pending' };
          const cancelled = { ...item, id: Date.now(), quantity: quantityToCancel, status: 'cancelled', cancelledAt: Timestamp.now() };
          updatedItems = batch.items.filter(i => i.id !== itemId);
          updatedItems.push(remaining, cancelled);
        }

        const updatedBatches = order.batches.map(b =>
          b.batchId === batchId ? { ...b, items: updatedItems } : b
        );
        const updatedBatch = updatedBatches.find(b => b.batchId === batchId);
        const allItemsCompleted = updatedBatch.items.every(i => i.status === 'delivered' || i.status === 'cancelled');
        if (allItemsCompleted && updatedBatch.status !== 'delivered') {
          updatedBatch.status = 'delivered';
        }
        const allBatchesCompleted = updatedBatches.every(b => b.status === 'delivered');
        let updatedOrderStatus = order.status;
        let deliveredAt = order.deliveredAt;
        if (allBatchesCompleted && order.status !== 'delivered') {
          updatedOrderStatus = 'delivered';
          if (!deliveredAt) deliveredAt = Timestamp.now();
        }
        await updateOrder(orderId, { batches: updatedBatches, status: updatedOrderStatus, deliveredAt });
      } catch (err) {
        notify(err.message, 'error');
        navigate('/dashboard');
      }
    });
  };

  const goToBill = (orderId, type) => {
    try {
      checkWaiter();
      navigate(`/generate-bill/${tableId}/${orderId}?type=${type}`);
    } catch (err) {
      notify(err.message, 'error');
      navigate('/dashboard');
    }
  };

  // Cerrar cuenta (con confirmación)
  const handleCloseOrder = (orderId) => {
    withLock(async () => {
      try {
        checkWaiter();
        const ok = await confirm('¿Cerrar cuenta y marcar como pagada?');
        if (!ok) return;
        await updateOrder(orderId, { status: 'completed', completedAt: Timestamp.now() });
      } catch (err) {
        notify(err.message, 'error');
        navigate('/dashboard');
      }
    });
  };

  const liberarMesa = () => {
    withLock(async () => {
      try {
        checkWaiter();
        const ok = await confirm('¿Estás seguro de liberar la mesa?');
        if (!ok) return;
        await updateDoc(doc(db, 'tables', tableId), {
          status: 'free',
          occupiedSince: null,
          currentOrderId: null
        });
        notify('Mesa liberada', 'success');
        navigate('/dashboard');
      } catch (err) {
        notify(err.message, 'error');
      }
    });
  };

  const goToAddProduct = (orderId) => {
    try {
      checkWaiter();
      navigate(`/add-product/${tableId}/${orderId}`);
    } catch (err) {
      notify(err.message, 'error');
      navigate('/dashboard');
    }
  };

  const goToAddClient = () => {
    try {
      checkWaiter();
      navigate(`/add-client/${tableId}`);
    } catch (err) {
      notify(err.message, 'error');
      navigate('/dashboard');
    }
  };

  const allItemsFinalized = (order) => {
    return order.batches.every(batch =>
      batch.items.every(item => item.status === 'delivered' || item.status === 'cancelled')
    );
  };

  if (loading || realTableNumber === null) {
    return <div className="text-center mt-10 text-texto-claro">Cargando órdenes...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-4 bg-fondo min-h-screen">
        <button onClick={() => navigate('/dashboard')} className="text-acento hover:text-acento-hover font-medium mb-4 inline-flex items-center gap-1">
          ← Volver
        </button>
        <Card className="text-center p-8">
          <p className="text-texto-claro text-lg">No hay órdenes activas para esta mesa.</p>
        </Card>
        <div className="flex justify-center mt-8">
          <Button variant="primary" onClick={liberarMesa} disabled={isLocked || !isOnline}>
            {isLocked ? 'Procesando...' : 'Liberar mesa'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 bg-fondo min-h-screen">
      <button onClick={() => navigate('/dashboard')} className="text-acento hover:text-acento-hover font-medium mb-4 inline-flex items-center gap-1">
        ← Volver
      </button>
      <h2 className="text-3xl font-display font-bold text-texto mb-6">Mesa: {realTableNumber} - Órdenes</h2>

      {orders.map(order => {
        const isPrepaid = order.prepaid === true;
        const allFinalized = allItemsFinalized(order);
        return (
          <Card key={order.id} className="mb-6">
            <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
              <h3 className="text-2xl font-display font-bold text-texto">{order.clientName}</h3>
              <div className="flex flex-wrap gap-2">
                {!isPrepaid && (
                  <Button variant="secondary" onClick={() => goToAddProduct(order.id)} disabled={isLocked || !isOnline} className="text-sm py-1 px-3">
                    Agregar producto
                  </Button>
                )}
                {!isPrepaid ? (
                  allFinalized ? (
                    <Button variant="success" onClick={() => goToBill(order.id, 'final')} disabled={isLocked || !isOnline} className="text-sm py-1 px-3">
                      Generar cuenta
                    </Button>
                  ) : (
                    <Button variant="warning" onClick={() => goToBill(order.id, 'prepay')} disabled={isLocked || !isOnline} className="text-sm py-1 px-3">
                      Pago anticipado
                    </Button>
                  )
                ) : (
                  allFinalized ? (
                    <Button variant="success" onClick={() => handleCloseOrder(order.id)} disabled={isLocked || !isOnline} className="text-sm py-1 px-3">
                      Cerrar cuenta
                    </Button>
                  ) : (
                    <span className="text-texto-claro italic self-center">Pagado por anticipado</span>
                  )
                )}
              </div>
            </div>

            {order.batches.map(batch => (
              <div key={batch.batchId} className="mb-4 border-2 border-dashed border-borde rounded-xl p-3">
                <div className="bg-tarjeta-alt/20 rounded-lg p-2 text-sm font-medium mb-2 flex justify-between items-center">
                  <span>Lote #{batch.batchId} - {batch.timestamp?.toDate().toLocaleTimeString()}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-borde-claro">
                    <thead className="bg-tarjeta-alt/10">
                      <tr>
                        <th className="px-2 py-1 text-left text-texto">Producto</th>
                        <th className="px-2 py-1 text-left text-texto">Cant.</th>
                        <th className="px-2 py-1 text-left text-texto">Precio</th>
                        <th className="px-2 py-1 text-left text-texto">Estado</th>
                        <th className="px-2 py-1 text-left text-texto">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.items.map(item => {
                        let rowClass = '';
                        if (item.status === 'delivered') rowClass = 'text-texto-claro line-through';
                        if (item.status === 'cancelled') rowClass = 'text-insignia-cancelado-texto line-through';
                        return (
                          <tr key={item.id} className={rowClass}>
                            <td className="px-2 py-1">
                              {item.name}
                              {item.notes && <div className="text-xs text-texto-claro">{item.notes}</div>}
                            </td>
                            <td className="px-2 py-1">{item.quantity}</td>
                            <td className="px-2 py-1">${item.price}</td>
                            <td className="px-2 py-1">
                              <Badge status={item.status} />
                            </td>
                            <td className="px-2 py-1">
                              <div className="flex flex-wrap gap-2">
                                {item.status === 'ready' && (
                                  <button
                                    onClick={() => handleDeliverItem(order.id, batch.batchId, item.id)}
                                    disabled={isLocked || !isOnline}
                                    className="text-texto-exito hover:text-texto-exito-hover text-sm font-medium disabled:opacity-50"
                                  >
                                    Entregar
                                  </button>
                                )}
                                {(item.status === 'pending' || item.status === 'ready') && !isPrepaid && (
                                  <button
                                    onClick={() => handleCancelItem(order.id, batch.batchId, item.id)}
                                    disabled={isLocked || !isOnline}
                                    className="text-acento hover:text-acento-hover text-sm font-medium disabled:opacity-50"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </Card>
        );
      })}

      <div className="flex justify-end mt-4">
        <Button variant="primary" onClick={goToAddClient} disabled={isLocked || !isOnline}>
          + Nueva orden (Cliente)
        </Button>
      </div>
    </div>
  );
};

export default ViewTable;