import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Card from '../ui/Card';

const AdminEmployees = () => {
  const { user, isServiceOpen } = useAuth();
  const { notify, confirm } = useNotification();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState(null);

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

  const updateRole = async (id, role) => {
    try {
      await updateDoc(doc(db, 'users', id), { role });
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, role } : e));
      setEditingRole(null);
      notify('Rol actualizado correctamente', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo actualizar el rol', 'error');
    }
  };

  const toggleStatus = async (id, current) => {
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
    const respuesta = await confirm('¿Eliminar este empleado? Se perderán sus datos.');
    if (!respuesta) return;
    try {
      await deleteDoc(doc(db, 'users', id));
      setEmployees(prev => prev.filter(e => e.id !== id));
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

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-borde-claro">
            <thead className="bg-tarjeta-alt/20">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-texto-claro uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-claro">
              {employees.map(emp => (
                <tr key={emp.id} className="text-texto">
                  <td className="px-6 py-4 whitespace-nowrap">{emp.displayName || 'Sin nombre'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{emp.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingRole === emp.id ? (
                      <select
                        value={emp.role}
                        onChange={e => updateRole(emp.id, e.target.value)}
                        disabled={isServiceOpen}
                        className="p-1 border-b-2 border-borde bg-transparent rounded-t-md text-texto text-sm focus:border-acento focus:outline-none transition disabled:opacity-50"
                      >
                        <option value="waiter">Mesero</option>
                        <option value="chef">Cocinero</option>
                      </select>
                    ) : (
                      <span className="capitalize">{emp.role === 'waiter' ? 'Mesero' : emp.role === 'chef' ? 'Cocinero' : emp.role}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      emp.enabled ? 'bg-insignia-listo-fondo text-insignia-listo-texto' : 'bg-insignia-cancelado-fondo text-insignia-cancelado-texto'
                    }`}>
                      {emp.enabled ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 space-x-2 whitespace-nowrap">
                    {editingRole === emp.id ? (
                      <button onClick={() => setEditingRole(null)} className="text-texto-claro hover:text-texto text-sm">Cancelar</button>
                    ) : (
                      <button
                        onClick={() => setEditingRole(emp.id)}
                        disabled={isServiceOpen}
                        className="text-acento hover:text-acento-hover text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Editar rol
                      </button>
                    )}
                    <button
                      onClick={() => toggleStatus(emp.id, emp.enabled)}
                      disabled={isServiceOpen}
                      className={`text-sm font-medium ${emp.enabled ? 'text-texto-aviso hover:texto-aviso-hover' : 'text-texto-exito hover:texto-exito-hover'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {emp.enabled ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                    <button
                      onClick={() => deleteEmp(emp.id)}
                      disabled={isServiceOpen}
                      className="text-acento hover:text-acento-hover text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {employees.length === 0 && <p className="text-texto-claro text-center mt-8">No hay empleados registrados</p>}
    </div>
  );
};

export default AdminEmployees;