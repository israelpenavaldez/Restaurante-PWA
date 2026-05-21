import React from 'react';
import { formatElapsedTime } from '../../utils/helpers';

const PendingOrders = ({ batches, onStartPreparing, isLocked }) => {

  if (batches.length === 0) {
    return <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No hay lotes pendientes</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {batches.map(batch => (
        <div key={`${batch.orderId}_${batch.batchId}`} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-gray-500">Lote #{batch.batch.batchId}</span>
                <h3 className="text-lg font-semibold">Mesa {batch.tableNumber}</h3>
                <p className="text-sm text-gray-600">Cliente: {batch.clientName}</p>
              </div>
              <span className="text-sm text-gray-500">
                Espera: {formatElapsedTime(batch.batch.timestamp)}
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex justify-between">
              <div className="flex-1">
                <ul className="space-y-1 text-sm">
                  {batch.batch.items.slice(0, 10).map(item => (
                    <li key={item.id}>
                      {item.name} x{item.quantity}
                      {item.notes && <span className="text-gray-400 ml-1">({item.notes})</span>}
                    </li>
                  ))}
                </ul>
                {batch.batch.items.length > 10 && (
                  <p className="text-xs text-gray-400 mt-2">+{batch.batch.items.length - 10} más</p>
                )}
              </div>
              <div className="ml-4">
                <button
                  onClick={() => onStartPreparing(batch.orderId, batch.batch.batchId)}
                  disabled={isLocked}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Preparar
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingOrders;