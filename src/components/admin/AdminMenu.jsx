import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Card from '../ui/Card';
import Button from '../ui/Button';

const AdminMenu = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const { isServiceOpen } = useAuth();
  const { notify, confirm } = useNotification();

  useEffect(() => {
    const fetchCategories = async () => {
      const snapshot = await getDocs(collection(db, 'menuCategories'));
      let cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      cats.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(cats);
      setLoading(false);
    };
    fetchCategories();
  }, []);

  const filtered = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (id) => navigate(`/admin/edit-category/${id}`);
  const handleNew = () => navigate('/admin/edit-category/new');

  const toggleCategoryActive = async (categoryId, currentActive) => {
    const ok = await confirm(
      currentActive ? '¿Desactivar esta categoría?' : '¿Activar esta categoría?'
    );
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'menuCategories', categoryId), { active: !currentActive });
      setCategories(prev =>
        prev.map(cat =>
          cat.id === categoryId ? { ...cat, active: !currentActive } : cat
        )
      );
      notify(!currentActive ? 'Categoría activada' : 'Categoría desactivada', 'success');
    } catch (error) {
      console.error(error);
      notify('No se pudo cambiar el estado', 'error');
    }
  };

  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando menú...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-display font-bold text-texto">Categorías del menú</h2>
        <div className="flex items-center gap-3">
          {isServiceOpen && (
            <span className="text-sm text-acento bg-acento/10 px-3 py-1 rounded-full">
              Servicio abierto: solo puede activar/desactivar
            </span>
          )}
          <Button variant="success" onClick={handleNew} disabled={isServiceOpen}>
            + Nueva categoría
          </Button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Buscar categoría..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-6 transition"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(category => (
          <Card key={category.id} className="overflow-hidden !p-0 flex flex-col">
            <div className="flex">
              <div className="w-32 h-32 bg-tarjeta-alt/30 flex items-center justify-center flex-shrink-0">
                {category.imageUrl ? (
                  <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">🍽️</span>
                )}
              </div>
              <div className="flex-1 p-4">
                <h3 className="text-xl font-display font-bold text-texto mb-1">{category.name}</h3>
                {category.description && (
                  <p className="text-texto-claro text-sm mb-3">{category.description}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleEdit(category.id)}
                    className="text-acento hover:text-acento-hover font-medium text-sm transition"
                  >
                    {isServiceOpen ? 'Ver' : 'Editar'}
                  </button>
                  <button
                    onClick={() => toggleCategoryActive(category.id, category.active)}
                    className={`text-sm font-medium transition ${
                      category.active ? 'text-texto-aviso hover:text-texto-aviso-hover' : 'text-texto-exito hover:text-texto-exito-hover'
                    }`}
                  >
                    {category.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
            {category.items?.length > 0 && (
              <div className="border-t border-borde-claro px-4 py-3 bg-tarjeta-alt/10">
                <div className="flex flex-wrap gap-1 text-sm text-texto">
                  {category.items.slice(0, 5).map(variant => (
                    <span key={variant.id} className="bg-tarjeta-alt/30 px-2 py-0.5 rounded-full text-xs">
                      {variant.name} (${variant.price})
                    </span>
                  ))}
                  {category.items.length > 5 && (
                    <span className="text-xs text-texto-claro">+{category.items.length - 5} más</span>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-texto-claro text-center mt-8">No se encontraron categorías</p>
      )}
    </div>
  );
};

export default AdminMenu;