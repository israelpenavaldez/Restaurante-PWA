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

/**
 * Vista de detalle de una mesa ocupada.
 * Muestra todas las órdenes activas con sus lotes y productos,
 * permitiendo al mesero entregar productos, cancelarlos,
 * agregar nuevos productos o clientes, generar cuentas y liberar la mesa.
 */
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

  /**
   * Obtiene el número real de la mesa desde Firestore.
   * Si no se encuentra, redirige al panel principal.
   */
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

  /**
   * Se suscribe a las órdenes de la mesa en tiempo real.
   * Filtra solo las órdenes activas (no completadas ni pagadas).
   */
  useEffect(() => {
    if (realTableNumber === null) return;
    const unsubscribe = subscribeToTableOrders(realTableNumber, (allOrders) => {
      const activeOrders = allOrders.filter(o => o.status !== 'completed' && o.status !== 'paid');
      setOrders(activeOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [realTableNumber]);

  // ===== OPERACIONES SOBRE PRODUCTOS =====

  /**
   * Marca un producto como entregado.
   * Solicita confirmación al mesero antes de ejecutar la acción.
   * Si todos los productos del lote están entregados o cancelados,
   * el lote se marca automáticamente como entregado.
   * Si todos los lotes están entregados, la orden se marca como entregada.
   */
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
        const allItemsInBatchDelivered = updatedBatch.items.every(
          item => item.status === 'delivered' || item.status === 'cancelled'
        );
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

  /**
   * Cancela un producto (pendiente o listo).
   * Si la cantidad es mayor a 1, pregunta cuántas unidades cancelar.
   * No permite cancelar productos en órdenes con pago anticipado.
   * Si todos los productos del lote quedan entregados o cancelados,
   * el lote se marca como entregado automáticamente.
   */
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
          const input = await prompt(
            `¿Cuántas unidades de "${item.name}" cancelar? (1-${item.quantity})`,
            '1'
          );
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
          // Cancelar todas las unidades
          updatedItems = batch.items.map(i =>
            i.id === itemId ? { ...i, status: 'cancelled', cancelledAt: Timestamp.now() } : i
          );
        } else {
          // Cancelar solo una parte: dividir el producto
          const remaining = { ...item, quantity: item.quantity - quantityToCancel, status: 'pending' };
          const cancelled = { ...item, id: Date.now(), quantity: quantityToCancel, status: 'cancelled', cancelledAt: Timestamp.now() };
          updatedItems = batch.items.filter(i => i.id !== itemId);
          updatedItems.push(remaining, cancelled);
        }

        const updatedBatches = order.batches.map(b =>
          b.batchId === batchId ? { ...b, items: updatedItems } : b
        );

        const updatedBatch = updatedBatches.find(b => b.batchId === batchId);
        const allItemsCompleted = updatedBatch.items.every(
          i => i.status === 'delivered' || i.status === 'cancelled'
        );
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

  // ===== NAVEGACIÓN A OTRAS VISTAS =====

  /** Navega a la vista de generación de cuenta para una orden específica. */
  const goToBill = (orderId, type) => {
    try {
      checkWaiter();
      navigate(`/generate-bill/${tableId}/${orderId}?type=${type}`);
    } catch (err) {
      notify(err.message, 'error');
      navigate('/dashboard');
    }
  };

  /** Cierra una cuenta y la marca como pagada (con confirmación). */
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

  /** Libera la mesa, dejándola disponible nuevamente (con confirmación). */
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

  /** Navega a la vista para agregar un nuevo lote de productos a una orden. */
  const goToAddProduct = (orderId) => {
    try {
      checkWaiter();
      navigate(`/add-product/${tableId}/${orderId}`);
    } catch (err) {
      notify(err.message, 'error');
      navigate('/dashboard');
    }
  };

  /** Navega a la vista para agregar un nuevo cliente a la mesa. */
  const goToAddClient = () => {
    try {
      checkWaiter();
      navigate(`/add-client/${tableId}`);
    } catch (err) {
      notify(err.message, 'error');
      navigate('/dashboard');
    }
  };

  /**
   * Verifica si todos los productos de una orden están
   * en estado entregado o cancelado.
   */
  const allItemsFinalized = (order) => {
    return order.batches.every(batch =>
      batch.items.every(item => item.status === 'delivered' || item.status === 'cancelled')
    );
  };

  // ===== RENDERIZADO =====

  if (loading || realTableNumber === null) {
    return <div className="text-center mt-10 text-texto-claro">Cargando órdenes...</div>;
  }

  // Caso: no hay órdenes activas (todas están pagadas o completadas)
  if (orders.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-4 bg-fondo min-h-screen">
        <Button
          variant="return" 
          onClick={() => navigate('/dashboard')} 
          className="mb-4 inline-flex items-center gap-1"
        >
          ← Volver
        </Button>
        <Card className="text-center p-8">
          <p className="text-texto-claro text-lg">No hay órdenes activas para esta mesa.</p>
        </Card>
        <div className="flex justify-center mt-8">
          <Button 
            variant="success" 
            onClick={liberarMesa} 
            disabled={isLocked || !isOnline}
          >
            {isLocked ? 'Procesando...' : 'Liberar mesa'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 bg-fondo min-h-screen">
      {/* ===== BOTÓN VOLVER ===== */}
      <Button
        variant="return"
        onClick={() => navigate('/dashboard')}
        className="mb-4 inline-flex items-center gap-1"
      >
        ← Volver
      </Button>

      <h2 className="text-3xl font-display font-bold text-texto text-center mb-6">Mesa: {realTableNumber}</h2>

      {/* ===== LISTA DE ÓRDENES ===== */}
      {orders.map(order => {
        const isPrepaid = order.prepaid === true;
        const allFinalized = allItemsFinalized(order);

        return (
          <Card key={order.id} className="mb-6">
            {/* Cabecera de la orden */}
            <div className="flex justify-start items-center mb-4">
              <h3 className="text-2xl font-display font-bold text-texto">Cliente: {order.clientName}</h3>
            </div>
            {/* Botones de acción según estado */}
            <div className="flex flex-wrap justify-between gap-2 mb-4">
              {!isPrepaid && (
                <Button 
                  variant="success" 
                  onClick={() => goToAddProduct(order.id)} 
                  disabled={isLocked || !isOnline} 
                  className="text-sm py-1 px-3"
                >
                  Agregar
                </Button>
              )}
              {!isPrepaid ? (
                allFinalized ? (
                  <Button 
                    variant="success" 
                    onClick={() => goToBill(order.id, 'final')} 
                    disabled={isLocked || !isOnline} 
                    className="text-sm py-1 px-3"
                  >
                    Generar cuenta
                  </Button>
                ) : (
                  <Button 
                    variant="warning" 
                    onClick={() => goToBill(order.id, 'prepay')} 
                    disabled={isLocked || !isOnline} 
                    className="text-sm py-1 px-3"
                  >
                    Pago anticipado
                  </Button>
                )
              ) : (
                allFinalized ? (
                  <Button 
                    variant="success" 
                    onClick={() => handleCloseOrder(order.id)} 
                    disabled={isLocked || !isOnline} 
                    className="text-sm py-1 px-3"
                  >
                    Cerrar cuenta
                  </Button>
                ) : (
                  <span className="text-texto-claro italic self-center">---Pagado---</span>
                )
              )}
            </div>

            {/* ===== LOTES DE LA ORDEN ===== */}
            {order.batches.map(batch => (
              <div key={batch.batchId} className="mb-4 border-2 border-dashed border-borde rounded-xl p-3">
                {/* Cabecera del lote */}
                <div className="bg-tarjeta-alt/20 rounded-lg p-2 text-sm font-medium mb-2 flex justify-between items-center">
                  <span>#{batch.batchId} - {batch.timestamp?.toDate().toLocaleTimeString()}</span>
                </div>

                {/* Tabla de productos del lote */}
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed divide-y divide-borde-claro">
                    <colgroup>
                      <col className="w-[10%]" />   {/* Cantidad: 10% */}
                      <col className="w-[50%]" />   {/* Nombre: 60% */}
                      <col className="w-[10%]" />   {/* Estado: 20% */}
                      <col className="w-[30%]" />   {/* Subtotal/Acciones: 30% */}
                    </colgroup>
                    <tbody>
                      {batch.items.map(item => {
                        let rowClass = '';
                        if (item.status === 'delivered') rowClass = 'text-texto-claro line-through';
                        if (item.status === 'cancelled') rowClass = 'text-insignia-cancelado-texto line-through';

                        return (
                          <tr key={item.id} className={`${rowClass} border-b border-borde-claro last:border-b-0`}>
                            <td className="px-2 py-1">{item.quantity}x</td>
                            <td className="px-2 py-1">
                              {item.name}
                              {item.notes && <div className="text-xs text-texto-claro">{item.notes}</div>}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {/* Estado con íconos SVG */}
                              {item.status === 'pending' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-insignia-pendiente-texto mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" title="Pendiente">
                                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                                  <polyline points="12 6 12 12 16 14" strokeWidth={2} />
                                </svg>
                              )}
                              {item.status === 'ready' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-insignia-listo-texto mx-auto" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="10" cy="10" r="8" />
                                </svg>
                              )}
                              {item.status === 'delivered' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-insignia-entregado-texto mx-auto" viewBox="0 0 20 20" fill="currentColor" title="Entregado">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              )}
                              {item.status === 'cancelled' && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-insignia-cancelado-texto mx-auto" viewBox="0 0 20 20" fill="currentColor" title="Cancelado">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              )}
                            </td>
                            <td className="px-2 py-1">
                              <div className="flex flex-wrap gap-2 justify-end items-center">
                                {/* Botón Entregar (solo para productos listos) */}
                                {item.status === 'ready' && (
                                  <Button
                                    variant="success"
                                    onClick={() => handleDeliverItem(order.id, batch.batchId, item.id)}
                                    disabled={isLocked || !isOnline}
                                    className="text-sm py-1 px-2"
                                    title="Entregar"
                                  >
                                    {/* Ícono de check */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </Button>
                                )}
                                {/* Botón Cancelar (para productos pendientes o listos, excepto prepagados) */}
                                {(item.status === 'pending' || item.status === 'ready') && !isPrepaid && (
                                  <Button
                                    variant="cancel"
                                    onClick={() => handleCancelItem(order.id, batch.batchId, item.id)}
                                    disabled={isLocked || !isOnline}
                                    className="text-sm py-1 px-2"
                                    title="Cancelar"
                                  >
                                    {/* Ícono de X */}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  </Button>
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

      {/* ===== BOTÓN PARA AGREGAR NUEVO CLIENTE ===== */}
      <div className="flex justify-end mt-4">
        <Button variant="primary" onClick={goToAddClient} disabled={isLocked || !isOnline}>
          + Nueva orden (Cliente)
        </Button>
      </div>
    </div>
  );
};

export default ViewTable;