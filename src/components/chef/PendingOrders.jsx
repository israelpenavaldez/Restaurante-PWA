import React from 'react';
import { formatElapsedTime, groupItemsForDisplay } from '../../utils/helpers';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import Card from '../ui/Card';
import Button from '../ui/Button';

const PendingOrders = ({ batches, onStartPreparing, isLocked }) => {
  if (batches.length === 0) {
    return (
      <Card className="text-center p-8 text-texto-claro">
        No hay lotes pendientes
      </Card>
    );
  }
  
  const isOnline = useOnlineStatus();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {batches.map(batch => (
        <Card key={`${batch.orderId}_${batch.batchId}`} className="overflow-hidden !p-0">
          <div className="bg-tarjeta-alt/20 px-5 py-4 border-b border-borde-claro">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs text-texto-claro uppercase tracking-wide">Lote #{batch.batch.batchId}</span>
                <h3 className="text-xl font-display font-bold text-texto mt-1">Mesa {batch.tableNumber}</h3>
                <p className="text-sm text-texto-claro">Cliente: {batch.clientName}</p>
              </div>
              <span className="text-sm text-acento bg-acento/10 px-3 py-1 rounded-full font-medium">
                Espera: {formatElapsedTime(batch.batch.timestamp)}
              </span>
            </div>
          </div>
          <div className="p-4">
            <ul className="space-y-2 text-sm text-texto mb-4">
              {groupItemsForDisplay(batch.batch.items).slice(0, 10).map(item => (
                <li key={item.ids[0]}>
                  {item.name} x{item.quantity}
                  {item.notes && <span className="text-texto-claro ml-1">({item.notes})</span>}
                </li>
              ))}
            </ul>
            {batch.batch.items.length > 10 && (
              <p className="text-xs text-texto-claro mb-4">+{batch.batch.items.length - 10} productos más</p>
            )}
            <Button
              variant="primary"
              onClick={() => onStartPreparing(batch.orderId, batch.batch.batchId)}
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