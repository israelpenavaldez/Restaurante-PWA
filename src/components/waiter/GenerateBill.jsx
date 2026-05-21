import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getMenuCategories } from '../../services/firestoreService';
import { useNotification } from '../../context/NotificationContext';
import { getProductCategory } from '../../utils/helpers';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import Card from '../ui/Card';
import Button from '../ui/Button';

const GenerateBill = () => {
  const { tableId, orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const billType = queryParams.get('type');

  const [order, setOrder] = useState(null);
  const [categories, setCategories] = useState([]);
  const [realTableNumber, setRealTableNumber] = useState(null);
  const [loading, setLoading] = useState(true);

  const { checkWaiter } = usePermissions();
  const { withLock, isLocked } = useActionLock();
  const { notify } = useNotification();

  // Validación de billType
  useEffect(() => {
    const validTypes = ['prepay', 'final'];
    if (!validTypes.includes(billType)) {
      notify('Tipo de factura no válido', 'error');
      navigate(`/view/${tableId}`, { replace: true });
    }
  }, [billType, navigate, tableId]);

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

  useEffect(() => {
    const fetchData = async () => {
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
        notify('Orden no encontrada', 'error');
        navigate(`/view/${tableId}`);
        return;
      }
      setOrder({ id: orderDoc.id, ...orderDoc.data() });
      const cats = await getMenuCategories();
      setCategories(cats);
      setLoading(false);
    };
    fetchData();
  }, [orderId, tableId, navigate]);

  const handleConfirm = () => {
    withLock(async () => {
      try {
        checkWaiter();
        if (billType === 'prepay') {
          await updateDoc(doc(db, 'orders', orderId), { prepaid: true });
          notify('Pago anticipado registrado', 'success');
        } else {
          await updateDoc(doc(db, 'orders', orderId), { status: 'completed', completedAt: Timestamp.now(), paidAt: Timestamp.now() });
          notify('Cuenta pagada', 'success');
        }
        navigate(`/view/${tableId}`);
      } catch (err) {
        notify(err.message, 'error');
        navigate('/dashboard');
      }
    });
  };

  if (loading || realTableNumber === null) return <div className="text-center mt-10 text-tierra-clara">Cargando cuenta...</div>;
  if (!order) return null;

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
    <div className="max-w-3xl mx-auto p-4 bg-crema min-h-screen">
      <button onClick={() => navigate(`/view/${tableId}`)} className="text-chile-guajillo hover:text-red-800 font-medium mb-4 inline-flex items-center gap-1">
        ← Volver
      </button>

      <Card className="text-center mb-6 border-b-4 border-barro-claro">
        <h2 className="text-2xl font-display font-bold text-chocolate-oscuro">
          {billType === 'prepay' ? 'Pago anticipado' : 'Cuenta final'} - Mesa {realTableNumber}
        </h2>
        <p className="text-chocolate-oscuro"><strong>Cliente:</strong> {order.clientName}</p>
        <p className="text-tierra-clara"><strong>Fecha:</strong> {new Date().toLocaleString()}</p>
      </Card>

      {Object.keys(grouped).map(category => (
        <div key={category} className="mb-6">
          <h3 className="bg-barro-claro/30 text-chocolate-oscuro px-4 py-2 rounded-t-xl font-display font-bold">{category}</h3>
          <Card className="rounded-t-none">
            <table className="w-full">
              <thead>
                <tr className="text-chocolate-oscuro border-b border-barro-claro/30">
                  <th className="text-left p-2">Producto</th>
                  <th className="text-left p-2">Cant.</th>
                  <th className="text-left p-2">Precio</th>
                  <th className="text-left p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {grouped[category].map(item => (
                  <tr key={item.id} className="border-b border-barro-claro/20">
                    <td className="p-2 text-chocolate-oscuro">
                      {item.name}
                      {item.notes && <span className="text-tierra-clara text-sm ml-2">({item.notes})</span>}
                    </td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">${item.price}</td>
                    <td className="p-2 font-bold text-maiz-dorado">${item.price * item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ))}

      {cancelledItems.length > 0 && (
        <div className="mb-6">
          <h3 className="bg-chile-guajillo/10 text-chile-guajillo px-4 py-2 rounded-t-xl font-display font-bold">Cancelados</h3>
          <Card className="rounded-t-none">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 border-b border-barro-claro/30">
                  <th className="text-left p-2">Producto</th>
                  <th className="text-left p-2">Cant.</th>
                  <th className="text-left p-2">Precio</th>
                  <th className="text-left p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {cancelledItems.map(item => (
                  <tr key={item.id} className="border-b border-barro-claro/20 line-through text-gray-400">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">${item.price}</td>
                    <td className="p-2">${item.price * item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <div className="text-right mt-6 pt-4 border-t-2 border-barro-claro">
        <h3 className="text-2xl font-display font-bold text-chocolate-oscuro">Total a pagar: <span className="text-chile-guajillo">${total}</span></h3>
      </div>

      <div className="flex justify-end mt-6">
        <Button variant="success" onClick={handleConfirm} disabled={isLocked} className="px-8 py-3 text-lg">
          {isLocked ? 'Procesando...' : (billType === 'prepay' ? 'Confirmar pago anticipado' : 'Confirmar pago')}
        </Button>
      </div>
    </div>
  );
};

export default GenerateBill;