import React from 'react';
import { formatElapsedTime } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

/**
 * Vista de un lote en preparación en el panel de cocina.
 * Muestra los productos del lote con su estado actual (pendiente, listo, entregado, cancelado)
 * y permite marcar productos como listos (con cantidad opcional) o desmarcarlos.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.orderId - ID de la orden a la que pertenece el lote.
 * @param {Object} props.batch - Datos del lote (batches, items, etc.).
 * @param {string} props.tableNumber - Número de mesa asociada.
 * @param {string} props.clientName - Nombre del cliente.
 * @param {boolean} props.prepaid - Indica si la orden fue pagada por anticipado.
 * @param {Function} props.onMarkItemReady - Función para marcar un producto como listo.
 * @param {Function} props.onUnmarkItemReady - Función para desmarcar un producto listo.
 * @param {boolean} props.isLocked - Indica si las acciones están bloqueadas.
 */
const PreparingOrder = ({
  orderId,
  batch,
  tableNumber,
  clientName,
  prepaid,
  onMarkItemReady,
  onUnmarkItemReady,
  isLocked,
}) => {
  const { notify, confirm, prompt } = useNotification();
  const isOnline = useOnlineStatus();

  /**
   * Marca un producto como listo.
   * Si la cantidad es 1, solicita confirmación y lo marca directamente.
   * Si la cantidad es mayor a 1, pregunta cuántas unidades están listas (por defecto, todas)
   * y valida que el valor ingresado sea correcto.
   * @param {Object} item - Producto a marcar como listo.
   */
  const handleMarkReady = async (item) => {
    if (item.quantity === 1) {
      // Caso simple: una sola unidad
      const ok = await confirm(`¿"${item.name}" está listo?`);
      if (!ok) return;
      onMarkItemReady(orderId, batch.batchId, item.id, 1);
    } else {
      // Caso con cantidad > 1: preguntar cuántas unidades
      const input = await prompt(
        `¿Cuántos "${item.name}" están listos? (1-${item.quantity})`,
        String(item.quantity) // valor por defecto: todas
      );
      if (!input) return;
      const qty = parseInt(input);
      if (isNaN(qty) || qty < 1 || qty > item.quantity) {
        notify('Cantidad no válida', 'warning');
        return;
      }
      onMarkItemReady(orderId, batch.batchId, item.id, qty);
    }
  };

  /**
   * Revierte el estado de un producto de 'listo' a 'pendiente'.
   * Solicita confirmación antes de ejecutar la acción.
   * @param {Object} item - Producto a desmarcar.
   */
  const handleUnmarkReady = async (item) => {
    const ok = await confirm(`¿Desmarcar "${item.name}" como listo?`);
    if (!ok) return;
    onUnmarkItemReady(orderId, batch.batchId, item.id);
  };

  return (
    <Card className="overflow-hidden !p-0">
      {/* ===== CABECERA DEL LOTE ===== */}
      <div className="bg-tarjeta-alt/20 px-6 py-4 border-b border-borde-claro">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-display font-bold text-texto">Mesa: {tableNumber}</h2>
            <p className="text-texto-claro">Cliente: {clientName}</p>
            <p className="text-sm text-texto-claro mt-1">
              Lote #{batch.batchId} · Pedido hace {formatElapsedTime(batch.timestamp)}
            </p>
            {/* Etiqueta visible si la orden fue prepagada */}
            {prepaid && (
              <span className="inline-block mt-2 text-xs bg-boton-aviso/20 text-insignia-pendiente-texto px-3 py-1 rounded-full font-medium">
                Pagado
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-texto-claro uppercase tracking-wide">En preparación</p>
            <p className="text-acento font-bold">{formatElapsedTime(batch.timestamp)}</p>
          </div>
        </div>
      </div>

      {/* ===== LISTA DE PRODUCTOS DEL LOTE ===== */}
      <div className="p-6">
        <h3 className="text-lg font-display font-bold text-texto mb-4">Productos</h3>
        <div className="space-y-3">
          {batch.items.map(item => {
            // Producto ya entregado
            if (item.status === 'delivered') {
              return (
                <div key={item.id} className="flex justify-between items-center border-b border-borde-claro pb-2 text-texto-claro">
                  <div>
                    <span className="font-medium line-through">{item.name}</span>
                    <span className="ml-2">x{item.quantity}</span>
                    {item.notes && <p className="text-sm text-texto-claro">{item.notes}</p>}
                  </div>
                  <Badge status="delivered" />
                </div>
              );
            }

            // Producto cancelado
            if (item.status === 'cancelled') {
              return (
                <div key={item.id} className="flex justify-between items-center border-b border-borde-claro pb-2 text-insignia-cancelado-texto">
                  <div>
                    <span className="font-medium line-through">{item.name}</span>
                    <span className="ml-2">x{item.quantity}</span>
                    {item.notes && <p className="text-sm text-texto-claro">{item.notes}</p>}
                  </div>
                  <Badge status="cancelled" />
                </div>
              );
            }

            // Producto pendiente o listo (con acciones disponibles)
            return (
              <div key={item.id} className="flex justify-between items-center border-b border-borde-claro pb-2">
                <div>
                  <span className="font-medium text-texto">{item.name}</span>
                  <span className="ml-2 text-texto-claro">x{item.quantity}</span>
                  {item.notes && <p className="text-sm text-texto-claro">{item.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'ready' ? (
                    /* Producto listo: permite desmarcarlo */
                    <>
                      <Badge status="ready" />
                      <button
                        onClick={() => handleUnmarkReady(item)}
                        disabled={isLocked || !isOnline}
                        className="text-texto-advertencia hover:text-texto-advertencia-hover text-sm font-medium disabled:opacity-50 transition"
                        title="Desmarcar"
                      >
                        Deshacer
                      </button>
                    </>
                  ) : (
                    /* Producto pendiente: permite marcarlo como listo */
                    <Button
                      variant="success"
                      onClick={() => handleMarkReady(item)}
                      disabled={isLocked || !isOnline}
                      className="text-sm py-1 px-3"
                    >
                      Marcar listo
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

export default PreparingOrder;