import React from 'react';

const PreparingOrder = ({ orderId, batch, tableNumber, clientName, prepaid, onMarkItemReady, onUnmarkItemReady, isLocked }) => {
  const formatElapsedTime = (timestamp) => {
    if (!timestamp) return '';
    const diff = Math.floor((Date.now() - timestamp.toDate()) / 1000);
    const minutes = Math.floor(diff / 60);
    return `${minutes} min`;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="bg-gray-50 px-6 py-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Mesa {tableNumber}</h2>
            <p className="text-gray-600">Cliente: {clientName}</p>
            <p className="text-sm text-gray-500">Lote #{batch.batchId} · Pedido: {formatElapsedTime(batch.timestamp)}</p>
            {prepaid && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Prepagado</span>}
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">En preparación desde:</p>
            <p className="font-medium">{formatElapsedTime(batch.timestamp)}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Productos</h3>
        <div className="space-y-3">
          {batch.items.map(item => {
            // Si está entregado o cancelado, no mostrar botones
            if (item.status === 'delivered') {
              return (
                <div key={item.id} className="flex justify-between items-center border-b pb-2 text-gray-400">
                  <div>
                    <span className="font-medium line-through">{item.name}</span>
                    <span className="ml-2">x{item.quantity}</span>
                    {item.notes && <p className="text-sm text-gray-500">{item.notes}</p>}
                  </div>
                  <span className="text-green-600">Entregado</span>
                </div>
              );
            }
            if (item.status === 'cancelled') {
              return (
                <div key={item.id} className="flex justify-between items-center border-b pb-2 text-red-400">
                  <div>
                    <span className="font-medium line-through">{item.name}</span>
                    <span className="ml-2">x{item.quantity}</span>
                    {item.notes && <p className="text-sm text-gray-500">{item.notes}</p>}
                  </div>
                  <span className="text-red-500">Cancelado</span>
                </div>
              );
            }
            // Producto pendiente o listo
            return (
              <div key={item.id} className="flex justify-between items-center border-b pb-2">
                <div>
                  <span className="font-medium">{item.name}</span>
                  <span className="ml-2 text-gray-600">x{item.quantity}</span>
                  {item.notes && <p className="text-sm text-gray-500">{item.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'ready' ? (
                    <>
                      <span className="text-green-600 font-medium">✓ Listo</span>
                      <button
                        onClick={() => onUnmarkItemReady(orderId, batch.batchId, item.id)}
                        disabled={isLocked}
                        className="text-yellow-600 hover:text-yellow-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Desmarcar"
                      >
                        Deshacer
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onMarkItemReady(orderId, batch.batchId, item.id)}
                      disabled={isLocked}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Marcar listo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PreparingOrder;