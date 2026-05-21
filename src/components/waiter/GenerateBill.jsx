import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getMenuCategories } from '../../services/firestoreService';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import { getProductCategory } from '../../utils/helpers';

const GenerateBill = () => {
  const { tableId, orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const billType = queryParams.get('type');
  const validTypes = ['prepay', 'final'];
  if (!validTypes.includes(billType)) {
    // Redirigir o mostrar error
    useEffect(() => {
      alert('Tipo de factura no válido');
      navigate(`/view/${tableId}`, { replace: true });
    }, []);
    return null; // O un mensaje de carga/error
  }

  const [order, setOrder] = useState(null);
  const [categories, setCategories] = useState([]);
  const [realTableNumber, setRealTableNumber] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hooks de permisos y bloqueo
  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();

  // Obtener número real de la mesa (para mostrar)
  useEffect(() => {
    const fetchTableNumber = async () => {
      const tableDoc = await getDoc(doc(db, 'tables', tableId));
      if (tableDoc.exists()) {
        setRealTableNumber(tableDoc.data().number);
      } else {
        console.error('Mesa no encontrada');
      }
    };
    fetchTableNumber();
  }, [tableId]);

  // Obtener orden y categorías
  useEffect(() => {
    const fetchData = async () => {
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
        alert('Orden no encontrada');
        navigate(`/view/${tableId}`);
        return;
      }
      const orderData = { id: orderDoc.id, ...orderDoc.data() };
      setOrder(orderData);

      const cats = await getMenuCategories();
      setCategories(cats);
      setLoading(false);
    };
    fetchData();
  }, [orderId, tableId, navigate]);

  const handleConfirm = () => {
    withLock(async () => {
      try {
        checkWaiter(); // verifica rol, habilitado y servicio abierto

        if (billType === 'prepay') {
          await updateDoc(doc(db, 'orders', orderId), { prepaid: true });
          alert('Pago anticipado registrado');
        } else {
          await updateDoc(doc(db, 'orders', orderId), { 
            status: 'completed', 
            completedAt: Timestamp.now(), 
            paidAt: Timestamp.now() 
          });
          alert('Cuenta pagada');
        }
        navigate(`/view/${tableId}`);
      } catch (err) {
        alert(err.message);
        navigate('/dashboard');
      }
    });
  };

  if (loading || realTableNumber === null) return <div className="text-center mt-10">Cargando cuenta...</div>;
  if (!order) return null;

  // Obtener todos los items de todos los lotes (excluyendo cancelados)
  const allItems = (order.batches || []).flatMap(batch => batch.items.filter(item => item.status !== 'cancelled'));
  const cancelledItems = (order.batches || []).flatMap(batch => batch.items.filter(item => item.status === 'cancelled'));

  const grouped = {};
  allItems.forEach(item => {
    const cat = getProductCategory(item.name, categories);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  const total = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <button onClick={() => navigate(`/view/${tableId}`)} className="text-blue-500 hover:underline mb-4">← Volver</button>

      <div className="text-center mb-6 border-b pb-4">
        <h2 className="text-2xl font-bold">
          {billType === 'prepay' ? 'Pago anticipado' : 'Cuenta final'} - Mesa {realTableNumber}
        </h2>
        <p><strong>Cliente:</strong> {order.clientName}</p>
        <p><strong>Fecha:</strong> {new Date().toLocaleString()}</p>
      </div>

      {Object.keys(grouped).map(category => (
        <div key={category} className="mb-6">
          <h3 className="bg-gray-100 p-2 rounded font-semibold">{category}</h3>
          <table className="w-full mt-2">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Producto</th>
                <th className="text-left p-2">Cant.</th>
                <th className="text-left p-2">Precio</th>
                <th className="text-left p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {grouped[category].map(item => (
                <tr key={item.id} className="border-b">
                  <td className="p-2">{item.name}{item.notes && <span className="text-gray-500 text-sm ml-2">({item.notes})</span>}</td>
                  <td className="p-2">{item.quantity}</td>
                  <td className="p-2">${item.price}</td>
                  <td className="p-2">${item.price * item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {cancelledItems.length > 0 && (
        <div className="mb-6">
          <h3 className="bg-red-100 text-red-800 p-2 rounded font-semibold">Cancelados</h3>
          <table className="w-full mt-2">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Producto</th>
                <th className="text-left p-2">Cant.</th>
                <th className="text-left p-2">Precio</th>
                <th className="text-left p-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {cancelledItems.map(item => (
                <tr key={item.id} className="border-b line-through text-gray-400">
                  <td className="p-2">{item.name}</td>
                  <td className="p-2">{item.quantity}</td>
                  <td className="p-2">${item.price}</td>
                  <td className="p-2">${item.price * item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-right mt-6 pt-4 border-t">
        <h3 className="text-2xl font-bold">Total a pagar: ${total}</h3>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleConfirm}
          disabled={isLocked}
          className="bg-green-600 text-white px-6 py-3 rounded-lg text-lg font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {isLocked ? 'Procesando...' : (billType === 'prepay' ? 'Confirmar pago anticipado' : 'Confirmar pago')}
        </button>
      </div>
    </div>
  );
};

export default GenerateBill;