import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { subscribeToTableOrders, updateOrder } from '../../services/firestoreService';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';

const ViewTable = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();

  const [realTableNumber, setRealTableNumber] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Hooks de permisos y bloqueo
  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();

  // 1. Obtener el número real de la mesa (solo para mostrar)
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

  // 2. Suscripción a órdenes usando el número real (cuando esté disponible)
  useEffect(() => {
    if (realTableNumber === null) return;
    const unsubscribe = subscribeToTableOrders(realTableNumber, (allOrders) => {
      const activeOrders = allOrders.filter(o => o.status !== 'completed' && o.status !== 'paid');
      setOrders(activeOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [realTableNumber]);

  // Entregar un producto
  const handleDeliverItem = (orderId, batchId, itemId) => {
    withLock(async () => {
      try {
        checkWaiter();

        const order = orders.find(o => o.id === orderId);
        if (!order) return;

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

        await updateOrder(orderId, {
          batches: updatedBatches,
          status: updatedOrderStatus,
          deliveredAt
        });
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  // Cancelar un producto
  const handleCancelItem = (orderId, batchId, itemId) => {
    withLock(async () => {
      try {
        checkWaiter();

        const order = orders.find(o => o.id === orderId);
        if (!order || order.prepaid) {
          alert('No se pueden cancelar productos en una orden prepagada');
          return;
        }
        const batch = order.batches.find(b => b.batchId === batchId);
        const item = batch.items.find(i => i.id === itemId);
        if (item.status !== 'pending') return;

        let quantityToCancel = item.quantity;
        if (item.quantity > 1) {
          const input = prompt(`¿Cuántas unidades de "${item.name}" cancelar? (1-${item.quantity})`);
          if (!input) return;
          const qty = parseInt(input);
          if (isNaN(qty) || qty < 1 || qty > item.quantity) return;
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

        await updateOrder(orderId, {
          batches: updatedBatches,
          status: updatedOrderStatus,
          deliveredAt
        });
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  // Navegaciones con verificación de permisos (sin lock, porque no modifican datos)
  const goToBill = (orderId, type) => {
    try {
      checkWaiter();
      navigate(`/generate-bill/${tableId}/${orderId}?type=${type}`);
    } catch (err) {
      alert(err.message);
      navigate('/dashboard');
    }
  };

  const handleCloseOrder = (orderId) => {
    withLock(async () => {
      try {
        checkWaiter();
        await updateOrder(orderId, { status: 'completed', completedAt: Timestamp.now() });
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  const liberarMesa = () => {
    withLock(async () => {
      try {
        checkWaiter();
        await updateDoc(doc(db, 'tables', tableId), {
          status: 'free',
          occupiedSince: null,
          currentOrderId: null
        });
        navigate('/dashboard');
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  const goToAddProduct = (orderId) => {
    try {
      checkWaiter();
      navigate(`/add-product/${tableId}/${orderId}`);
    } catch (err) {
      alert(err.message);
      navigate('/dashboard');
    }
  };

  const goToAddClient = () => {
    try {
      checkWaiter();
      navigate(`/add-client/${tableId}`);
    } catch (err) {
      alert(err.message);
      navigate('/dashboard');
    }
  };

  const allItemsFinalized = (order) => {
    return order.batches.every(batch =>
      batch.items.every(item => item.status === 'delivered' || item.status === 'cancelled')
    );
  };

  if (loading || realTableNumber === null) {
    return <div className="text-center mt-10">Cargando órdenes...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <button onClick={() => navigate('/dashboard')} className="text-blue-500 hover:underline mb-4">← Volver</button>
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay órdenes activas para esta mesa.
        </div>
        <div className="flex justify-center mt-8">
          <button onClick={liberarMesa} disabled={isLocked} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
            {isLocked ? 'Procesando...' : 'Liberar mesa'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <button onClick={() => navigate('/dashboard')} className="text-blue-500 hover:underline mb-4">← Volver</button>
      <h2 className="text-2xl font-bold mb-6">Mesa {realTableNumber} - Órdenes</h2>

      {orders.map(order => {
        const isPrepaid = order.prepaid === true;
        const allFinalized = allItemsFinalized(order);
        return (
          <div key={order.id} className="bg-white rounded-lg shadow mb-6 p-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold">{order.clientName}</h3>
              <div className="space-x-2">
                {!isPrepaid && (
                  <button
                    onClick={() => goToAddProduct(order.id)}
                    disabled={isLocked}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    Agregar producto
                  </button>
                )}
                {!isPrepaid ? (
                  allFinalized ? (
                    <button
                      onClick={() => goToBill(order.id, 'final')}
                      disabled={isLocked}
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 disabled:opacity-50"
                    >
                      Generar cuenta
                    </button>
                  ) : (
                    <button
                      onClick={() => goToBill(order.id, 'prepay')}
                      disabled={isLocked}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 disabled:opacity-50"
                    >
                      Pago anticipado
                    </button>
                  )
                ) : (
                  allFinalized ? (
                    <button
                      onClick={() => handleCloseOrder(order.id)}
                      disabled={isLocked}
                      className="bg-green-700 text-white px-3 py-1 rounded hover:bg-green-800 disabled:opacity-50"
                    >
                      Cerrar cuenta
                    </button>
                  ) : (
                    <span className="text-gray-500 italic">Pagado por anticipado</span>
                  )
                )}
              </div>
            </div>

            {order.batches.map(batch => (
              <div key={batch.batchId} className="mb-4 border rounded p-2">
                <div className="bg-gray-100 p-1 text-sm font-medium">
                  Lote #{batch.batchId} - {batch.timestamp?.toDate().toLocaleTimeString()}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left">Producto</th>
                        <th className="px-2 py-1 text-left">Cant.</th>
                        <th className="px-2 py-1 text-left">Precio</th>
                        <th className="px-2 py-1 text-left">Estado</th>
                        <th className="px-2 py-1 text-left">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.items.map(item => {
                        let rowClass = '';
                        if (item.status === 'delivered') rowClass = 'text-gray-400 line-through';
                        if (item.status === 'cancelled') rowClass = 'text-red-400 line-through';
                        return (
                          <tr key={item.id} className={rowClass}>
                            <td className="px-2 py-1">
                              {item.name}
                              {item.notes && <div className="text-xs text-gray-500">{item.notes}</div>}
                            </td>
                            <td className="px-2 py-1">{item.quantity}</td>
                            <td className="px-2 py-1">${item.price}</td>
                            <td className="px-2 py-1">
                              {item.status === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded-full text-xs">Pendiente</span>}
                              {item.status === 'ready' && <span className="bg-green-100 text-green-800 px-1 py-0.5 rounded-full text-xs">Listo</span>}
                              {item.status === 'delivered' && <span className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded-full text-xs">Entregado</span>}
                              {item.status === 'cancelled' && <span className="bg-red-100 text-red-800 px-1 py-0.5 rounded-full text-xs">Cancelado</span>}
                            </td>
                            <td className="px-2 py-1">
                              {item.status === 'ready' && (
                                <button
                                  onClick={() => handleDeliverItem(order.id, batch.batchId, item.id)}
                                  disabled={isLocked}
                                  className="text-green-600 hover:text-green-800 text-sm disabled:opacity-50"
                                >
                                  Entregar
                                </button>
                              )}
                              {item.status === 'pending' && !isPrepaid && (
                                <button
                                  onClick={() => handleCancelItem(order.id, batch.batchId, item.id)}
                                  disabled={isLocked}
                                  className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                                >
                                  Cancelar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="flex justify-end mt-4">
        <button
          onClick={goToAddClient}
          disabled={isLocked}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          + Agregar Orden (Cliente)
        </button>
      </div>
    </div>
  );
};

export default ViewTable;