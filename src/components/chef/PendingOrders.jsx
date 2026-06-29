import React from 'react';
import { formatElapsedTime, groupItemsForDisplay } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Vista de lotes pendientes en el panel de cocina.
 * Muestra todos los lotes que aún no han comenzado a prepararse,
 * con sus productos agrupados y el tiempo de espera.
 * Permite iniciar la preparación de un lote, previa confirmación.
 *
 * @param {Array} batches - Lista de lotes pendientes.
 * @param {Function} onStartPreparing - Función para iniciar la preparación de un lote.
 * @param {boolean} isLocked - Indica si las acciones están bloqueadas.
 */
const PendingOrders = ({ batches, onStartPreparing, isLocked }) => {
  const { confirm } = useNotification();
  const isOnline = useOnlineStatus();

  /**
   * Maneja el inicio de preparación de un lote.
   * Solicita confirmación al cocinero antes de ejecutar la acción.
   * @param {string} orderId - ID de la orden.
   * @param {number} batchId - ID del lote.
   */
  const handlePrepare = async (orderId, batchId) => {
    const ok = await confirm('¿Iniciar preparación de este lote?');
    if (!ok) return;
    onStartPreparing(orderId, batchId);
  };

  // Mensaje cuando no hay lotes pendientes
  if (batches.length === 0) {
    return (
      <Card className="text-center p-8 text-texto-claro">
        No hay lotes pendientes
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {batches.map(batch => (
        <Card key={`${batch.orderId}_${batch.batchId}`} className="overflow-hidden !p-0">
          {/* ===== CABECERA DEL LOTE ===== */}
          <div className="bg-tarjeta-alt/20 px-5 py-4 border-b border-borde-claro">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-texto-claro uppercase tracking-wide">
                  Lote #{batch.batch.batchId}
                </span>
                <h3 className="text-xl font-display font-bold text-texto mt-1">
                  Mesa: {batch.tableNumber}
                </h3>
                <p className="text-sm text-texto-claro">Cliente: {batch.clientName}</p>
              </div>
              {/* Tiempo de espera del lote */}
              <span className="text-sm text-acento bg-acento/10 px-3 py-1 rounded-full font-medium">
                Espera: {formatElapsedTime(batch.batch.timestamp)}
              </span>
            </div>
          </div>

          {/* ===== LISTA DE PRODUCTOS ===== */}
          <div className="p-4">
            <ul className="space-y-2 text-sm text-texto mb-4">
              {groupItemsForDisplay(batch.batch.items)
                .slice(0, 10)
                .map(item => (
                  <li key={item.ids[0]}>
                    {item.name} x{item.quantity}
                    {item.notes && (
                      <span className="text-texto-claro ml-1">({item.notes})</span>
                    )}
                  </li>
                ))}
            </ul>
            {/* Indicador si hay más de 10 productos en el lote */}
            {batch.batch.items.length > 10 && (
              <p className="text-xs text-texto-claro mb-4">
                +{batch.batch.items.length - 10} productos más
              </p>
            )}

            {/* Botón para iniciar preparación */}
            <Button
              variant="primary"
              onClick={() => handlePrepare(batch.orderId, batch.batch.batchId)}
              disabled={isLocked || !isOnline}
              className="w-full"
            >
              Preparar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default PendingOrders;