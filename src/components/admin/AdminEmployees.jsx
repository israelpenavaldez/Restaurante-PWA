import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AdminEmployees = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const users = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.email !== user.email) { // excluir al admin actual
            users.push({ id: docSnap.id, ...data });
          }
        });
        setEmployees(users);
      } catch (error) {
        console.error('Error al cargar empleados:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, [user.email]);

  const updateEmployeeRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setEmployees(employees.map(emp => emp.id === userId ? { ...emp, role: newRole } : emp));
      setEditingRole(null);
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      alert('No se pudo actualizar el rol');
    }
  };

  const toggleEmployeeStatus = async (userId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await updateDoc(doc(db, 'users', userId), { enabled: newStatus });
      setEmployees(employees.map(emp => emp.id === userId ? { ...emp, enabled: newStatus } : emp));
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('No se pudo cambiar el estado');
    }
  };

  const deleteEmployee = async (userId) => {
    if (window.confirm('¿Eliminar este empleado? Se perderán sus datos.')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
        setEmployees(employees.filter(emp => emp.id !== userId));
      } catch (error) {
        console.error('Error al eliminar empleado:', error);
        alert('No se pudo eliminar el empleado');
      }
    }
  };

  if (loading) return <div className="text-center mt-10">Cargando empleados...</div>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Gestión de empleados</h2>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="px-6 py-4 whitespace-nowrap">{emp.displayName || 'Sin nombre'}</td>
                <td className="px-6 py-4 whitespace-nowrap">{emp.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingRole === emp.id ? (
                    <select
                      value={emp.role}
                      onChange={(e) => updateEmployeeRole(emp.id, e.target.value)}
                      className="border rounded p-1 text-sm"
                    >
                      <option value="waiter">Mesero</option>
                      <option value="chef">Cocinero</option>
                    </select>
                  ) : (
                    <span className="capitalize">
                      {emp.role === 'waiter' ? 'Mesero' : emp.role === 'chef' ? 'Cocinero' : emp.role}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    emp.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {emp.enabled ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap space-x-2">
                  {editingRole === emp.id ? (
                    <button onClick={() => setEditingRole(null)} className="text-gray-500 hover:text-gray-700 text-sm">
                      Cancelar
                    </button>
                  ) : (
                    <button onClick={() => setEditingRole(emp.id)} className="text-blue-500 hover:text-blue-700 text-sm">
                      Editar rol
                    </button>
                  )}
                  <button onClick={() => toggleEmployeeStatus(emp.id, emp.enabled)} className={`text-sm ${emp.enabled ? 'text-yellow-500' : 'text-green-500'}`}>
                    {emp.enabled ? 'Deshabilitar' : 'Habilitar'}
                  </button>
                  <button onClick={() => deleteEmployee(emp.id)} className="text-red-500 hover:text-red-700 text-sm">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {employees.length === 0 && (
        <p className="text-gray-500 text-center mt-8">No hay empleados registrados</p>
      )}
    </div>
  );
};

export default AdminEmployees;