import React from 'react';
import { formatElapsedTime } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const PreparingOrder = ({ orderId, batch, tableNumber, clientName, prepaid, onMarkItemReady, onUnmarkItemReady, isLocked }) => {
  const { notify, confirm, prompt } = useNotification();
  const isOnline = useOnlineStatus();

  const handleMarkReady = async (item) => {
    if (item.quantity === 1) {
      const ok = await confirm(`¿"${item.name}" esta listo?`);
      if (!ok) return;
      onMarkItemReady(orderId, batch.batchId, item.id, 1);
    } else {
      const input = await prompt(
        `¿Cuántos "${item.name}" estan listos? (1-${item.quantity})`,
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

  const handleUnmarkReady = async (item) => {
    const ok = await confirm(`¿Desmarcar "${item.name}" como listo?`);
    if (!ok) return;
    onUnmarkItemReady(orderId, batch.batchId, item.id);
  };

  return (
    <Card className="overflow-hidden !p-0">
      {/* Cabecera */}
      <div className="bg-tarjeta-alt/20 px-6 py-4 border-b border-borde-claro">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-display font-bold text-texto">Mesa {tableNumber}</h2>
            <p className="text-texto-claro">Cliente: {clientName}</p>
            <p className="text-sm text-texto-claro mt-1">
              Lote #{batch.batchId} · Pedido hace {formatElapsedTime(batch.timestamp)}
            </p>
            {prepaid && (
              <span className="inline-block mt-2 text-xs bg-boton-aviso/20 text-insignia-pendiente-texto px-3 py-1 rounded-full font-medium">
                Prepagado
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-texto-claro uppercase tracking-wide">En preparación</p>
            <p className="text-acento font-bold">{formatElapsedTime(batch.timestamp)}</p>
          </div>
        </div>
      </div>

      {/* Lista de productos */}
      <div className="p-6">
        <h3 className="text-lg font-display font-bold text-texto mb-4">Productos</h3>
        <div className="space-y-3">
          {batch.items.map(item => {
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

            // Pendiente o listo
            return (
              <div key={item.id} className="flex justify-between items-center border-b border-borde-claro pb-2">
                <div>
                  <span className="font-medium text-texto">{item.name}</span>
                  <span className="ml-2 text-texto-claro">x{item.quantity}</span>
                  {item.notes && <p className="text-sm text-texto-claro">{item.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'ready' ? (
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