import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';

/**
 * Panel de gestión de empleados.
 * Muestra los usuarios en tarjetas individuales con su información,
 * un toggle para habilitar/deshabilitar y un modal de edición
 * para cambiar el rol o eliminar al empleado.
 */
const AdminEmployees = () => {
  const { user, isServiceOpen } = useAuth();
  const { notify, confirm } = useNotification();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      const snap = await getDocs(collection(db, 'users'));
      const list = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.email !== user.email) list.push({ id: doc.id, ...data });
      });
      setEmployees(list);
      setLoading(false);
    };
    fetchEmployees();
  }, [user.email]);

  const updateRole = async (id, newRole) => {
    try {
      await updateDoc(doc(db, 'users', id), { role: newRole });
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, role: newRole } : e));
      setEditingEmployee(prev => prev ? { ...prev, role: newRole } : null);
      notify('Rol actualizado correctamente', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo actualizar el rol', 'error');
    }
  };

  const toggleStatus = async (id, current) => {
    const ok = await confirm(current ? '¿Deshabilitar este empleado?' : '¿Habilitar este empleado?');
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'users', id), { enabled: !current });
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, enabled: !current } : e));
      notify(current ? 'Empleado deshabilitado' : 'Empleado habilitado', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo cambiar el estado', 'error');
    }
  };

  const deleteEmp = async (id) => {
    const ok = await confirm('¿Eliminar este empleado? Se perderán sus datos.');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      setEmployees(prev => prev.filter(e => e.id !== id));
      setEditingEmployee(null);
      notify('Empleado eliminado', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo eliminar el empleado', 'error');
    }
  };

  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando empleados...</div>;

  return (
    <div>
      <h2 className="text-2xl font-display font-bold text-texto mb-6">Gestión de empleados</h2>

      {isServiceOpen && (
        <div className="mb-4 text-center text-acento bg-acento/10 px-4 py-2 rounded-full text-sm">
          Cierre el servicio para gestionar empleados
        </div>
      )}

      {/* Grid de tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map(emp => (
          <Card key={emp.id} className="flex flex-col gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-display font-bold text-texto">
                {emp.displayName || 'Sin nombre'}
              </h3>
              <p className="text-sm text-texto-claro">{emp.email}</p>
              <p className="text-sm text-texto-claro mt-1">
                Rol: <span className="capitalize font-medium">
                  {emp.role === 'waiter' ? 'Mesero' : emp.role === 'chef' ? 'Cocinero' : emp.role}
                </span>
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-borde-claro">
              <Toggle
                enabled={emp.enabled}
                onChange={() => toggleStatus(emp.id, emp.enabled)}
                label={emp.enabled ? 'Activo' : 'Inactivo'}
              />
              {!isServiceOpen && (
                <Button
                  variant="warning"
                  onClick={() => setEditingEmployee(emp)}
                  className="text-sm py-1"
                >
                  Editar
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {employees.length === 0 && (
        <p className="text-texto-claro text-center mt-8">No hay empleados registrados</p>
      )}

      {/* Modal de edición: cambiar rol y eliminar */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-texto/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-tarjeta rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-borde-claro">
            <h3 className="text-lg font-display font-bold text-texto mb-4 text-center">
              {editingEmployee.displayName || editingEmployee.email}
            </h3>

            <p className="text-sm text-texto-aviso text-center mb-4">
              Rol actual: {editingEmployee.role === 'waiter' ? 'Mesero' : editingEmployee.role === 'chef' ? 'Cocinero' : editingEmployee.role}
            </p>

            <div className="flex justify-center gap-3 mb-4">
              <Button
                variant="secondary"
                onClick={() => updateRole(editingEmployee.id, 'waiter')}
                className="text-sm"
              >
                Mesero
              </Button>
              <Button
                variant="secondary"
                onClick={() => updateRole(editingEmployee.id, 'chef')}
                className="text-sm"
              >
                Cocinero
              </Button>
            </div>

            <hr className="border-borde-claro mb-4" />

            <div className="flex justify-between gap-3">
              <Button
                variant="delete"
                onClick={() => deleteEmp(editingEmployee.id)}
                className="text-sm"
              >
                Eliminar
              </Button>
              <Button
                variant="primary"
                onClick={() => setEditingEmployee(null)}
                className="text-sm"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEmployees;