import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { getMenuCategories } from '../../services/firestoreService';
import { useNotification } from '../../context/NotificationContext';
import { getProductCategory, groupItemsForDisplay } from '../../utils/helpers';
import { generateOrderPDF } from '../../utils/pdfHelpers';
import { usePermissions } from '../../hooks/usePermissions';
import { useActionLock } from '../../hooks/useActionLock';
import useOnlineStatus from '../../hooks/useOnlineStatus';
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
  const { notify, confirm } = useNotification();
  const isOnline = useOnlineStatus();

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

        const mensaje = billType === 'prepay'
          ? '¿Registrar pago anticipado?'
          : '¿Confirmar pago de la cuenta?';

        const ok = await confirm(mensaje);
        if (!ok) return;

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

  if (loading || realTableNumber === null) return <div className="text-center mt-10 text-texto-claro">Cargando cuenta...</div>;
  if (!order) return null;

  const allItems = (order.batches || []).flatMap(batch => batch.items.filter(item => item.status !== 'cancelled'));
  const cancelledItems = (order.batches || []).flatMap(batch => batch.items.filter(item => item.status === 'cancelled'));
  const groupedCancelled = groupItemsForDisplay(cancelledItems);

  const grouped = {};
  allItems.forEach(item => {
    const cat = getProductCategory(item.name, categories);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });
  Object.keys(grouped).forEach(cat => {
    grouped[cat] = groupItemsForDisplay(grouped[cat]);
  });

  const total = allItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="max-w-3xl mx-auto p-4 bg-fondo min-h-screen">
      <button onClick={() => navigate(`/view/${tableId}`)} className="text-acento hover:text-acento-hover font-medium mb-4 inline-flex items-center gap-1">
        ← Volver
      </button>

      <Card className="text-center mb-6 border-b-4 border-borde">
        <h2 className="text-2xl font-display font-bold text-texto">
          {billType === 'prepay' ? 'Pago anticipado' : 'Cuenta final'} - Mesa: {realTableNumber}
        </h2>
        <p className="text-texto"><strong>Cliente:</strong> {order.clientName}</p>
        <p className="text-texto-claro"><strong>Fecha:</strong> {new Date().toLocaleString()}</p>
      </Card>

      {Object.keys(grouped).map(category => (
        <div key={category} className="mb-6">
          <h3 className="bg-tarjeta-alt/30 text-texto px-4 py-2 rounded-t-xl font-display font-bold">{category}</h3>
          <Card className="rounded-t-none">
            <table className="w-full">
              <thead>
                <tr className="text-texto border-b border-borde-claro">
                  <th className="text-left p-2">Producto</th>
                  <th className="text-left p-2">Cant.</th>
                  <th className="text-left p-2">Precio</th>
                  <th className="text-left p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {grouped[category].map(group => (
                  <tr key={group.ids[0]} className="border-b border-borde-claro">
                    <td className="p-2 text-texto">
                      {group.name}
                      {group.notes && <span className="text-texto-claro text-sm ml-2">({group.notes})</span>}
                    </td>
                    <td className="p-2">{group.quantity}</td>
                    <td className="p-2">${group.price}</td>
                    <td className="p-2 font-bold text-texto-aviso">${(group.price * group.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ))}

      {groupedCancelled.length > 0 && (
        <div className="mb-6">
          <h3 className="bg-acento/10 text-acento px-4 py-2 rounded-t-xl font-display font-bold">Cancelados</h3>
          <Card className="rounded-t-none">
            <table className="w-full">
              <thead>
                <tr className="text-texto-claro border-b border-borde-claro">
                  <th className="text-left p-2">Producto</th>
                  <th className="text-left p-2">Cant.</th>
                  <th className="text-left p-2">Precio</th>
                  <th className="text-left p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {groupedCancelled.map(group => (
                  <tr key={group.ids[0]} className="border-b border-borde-claro line-through text-texto-claro">
                    <td className="p-2">{group.name}</td>
                    <td className="p-2">{group.quantity}</td>
                    <td className="p-2">${group.price}</td>
                    <td className="p-2">${(group.price * group.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      <div className="text-right mt-6 pt-4 border-t-2 border-borde">
        <h3 className="text-2xl font-display font-bold text-texto">Total a pagar: <span className="text-acento">${total}</span></h3>
      </div>

      <div className="flex justify-end mt-6">
        <Button variant="secondary" onClick={() => generateOrderPDF(order, categories, billType)}>
          Descargar comprobante
        </Button>        
        <Button variant="success" onClick={handleConfirm} disabled={isLocked || !isOnline} className="px-8 py-3 text-lg">
          {isLocked ? 'Procesando...' : (billType === 'prepay' ? 'Confirmar pago anticipado' : 'Confirmar pago')}
        </Button>
      </div>
    </div>
  );
};

export default GenerateBill;