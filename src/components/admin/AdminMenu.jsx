import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Panel de gestión del menú.
 * Muestra todas las categorías de platillos y bebidas, permite buscar,
 * crear nuevas categorías, editarlas y activarlas/desactivarlas.
 * Al desactivar una categoría, automáticamente se desactivan todas sus variantes;
 * al activarla, también se activan todas.
 */
const AdminMenu = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const { isServiceOpen } = useAuth();
  const { notify, confirm } = useNotification();

  /**
   * Carga todas las categorías del menú desde Firestore
   * y las ordena alfabéticamente por nombre.
   */
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

  // Filtra las categorías según el término de búsqueda
  const filtered = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /** Navega al editor de la categoría seleccionada. */
  const handleEdit = (id) => navigate(`/admin/edit-category/${id}`);

  /** Navega al formulario de creación de una nueva categoría. */
  const handleNew = () => navigate('/admin/edit-category/new');

  /**
   * Activa o desactiva una categoría y sincroniza el estado
   * de todas sus variantes en Firestore.
   * @param {string} categoryId - ID de la categoría.
   * @param {boolean} currentActive - Estado actual de la categoría.
   */
  const toggleCategoryActive = async (categoryId, currentActive) => {
    const ok = await confirm(
      currentActive ? '¿Desactivar esta categoría?' : '¿Activar esta categoría?'
    );
    if (!ok) return;

    try {
      const newActive = !currentActive;

      // Leer la categoría actual para obtener sus variantes
      const catSnap = await getDoc(doc(db, 'menuCategories', categoryId));
      if (catSnap.exists()) {
        const items = catSnap.data().items || [];
        const updatedItems = items.map(item => ({ ...item, active: newActive }));
        await updateDoc(doc(db, 'menuCategories', categoryId), {
          active: newActive,
          items: updatedItems,
        });
      } else {
        await updateDoc(doc(db, 'menuCategories', categoryId), { active: newActive });
      }

      // Actualizar el estado local para reflejar el cambio inmediatamente
      setCategories(prev =>
        prev.map(cat => {
          if (cat.id !== categoryId) return cat;
          const updatedItems = (cat.items || []).map(item => ({ ...item, active: newActive }));
          return { ...cat, active: newActive, items: updatedItems };
        })
      );

      notify(
        newActive
          ? 'Categoría activada (todas las variantes fueron activadas)'
          : 'Categoría desactivada (todas las variantes fueron desactivadas)',
        'success'
      );
    } catch (error) {
      console.error(error);
      notify('No se pudo cambiar el estado', 'error');
    }
  };

  // Estado de carga inicial
  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando menú...</div>;

  return (
    <div>
      {/* ===== CABECERA CON BOTÓN DE NUEVA CATEGORÍA ===== */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-display font-bold text-texto">Categorías</h2>
        <div className="flex items-center gap-3">
          {isServiceOpen && (
            <span className="text-sm text-acento bg-acento/10 px-3 py-1 rounded-full">
              Servicio abierto: solo puede activar/desactivar
            </span>
          )}
        </div>
      </div>

      {/* ===== BARRA DE BÚSQUEDA ===== */}
      <input
        type="text"
        placeholder="Buscar categoría..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none mb-6 transition"
      />
      <div className="flex justify-end mb-4">
        <Button 
          variant="primary" 
          onClick={handleNew} 
          disabled={isServiceOpen}
        >
          + Nueva categoría
        </Button>
      </div>

      {/* ===== CUADRÍCULA DE CATEGORÍAS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(category => (
          <Card key={category.id} className="overflow-hidden !p-0 flex flex-col">
            <div className="flex">
              {/* Imagen de la categoría o placeholder */}
              <div className="w-32 h-32 bg-tarjeta-alt/30 flex items-center justify-center flex-shrink-0">
                {category.imageUrl ? (
                  <img 
                    src={category.imageUrl} 
                    alt={category.name} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <span className="text-4xl">🍽️</span>
                )}
              </div>

              {/* Información y acciones de la categoría */}
              <div className="flex-1 p-4">
                <div className="flex justify-center items-center mb-2">
                  <h3 className="text-xl font-display font-bold text-texto">{category.name}</h3>
                </div>
                <div className="mt-2 gap-2 items-center justify-between">
                  {/* Lista de variantes (máximo 5 visibles) */}
                  {category.items?.length > 0 && (
                    <div className="border-t border-borde-claro px-4 py-3 bg-tarjeta-alt/10">
                      <div className="flex flex-col gap-1 text-sm text-texto">
                        {category.items.slice(0, 5).map(variant => (
                          <span key={variant.id} className="bg-tarjeta-alt/30 px-2 py-0.5 rounded-full text-xs">
                            {variant.name}
                          </span>
                        ))}
                        {category.items.length > 5 && (
                          <span className="text-xs text-texto-claro">+{category.items.length - 5} más</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-center items-center p-4 border-t border-borde-claro bg-tarjeta-alt/10">
              <Button
                variant="warning"
                onClick={() => handleEdit(category.id)}
                className="font-medium text-sm transition"
              >
                {isServiceOpen ? 'Ver' : 'Editar'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Mensaje cuando no hay resultados de búsqueda */}
      {filtered.length === 0 && (
        <p className="text-texto-claro text-center mt-8">No se encontraron categorías</p>
      )}
    </div>
  );
};

export default AdminMenu;