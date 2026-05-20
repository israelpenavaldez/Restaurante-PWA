import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AdminMenu = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Cargar categorías desde Firestore
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

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditCategory = (categoryId) => {
    navigate(`/admin/edit-category/${categoryId}`);
  };

  const handleNewCategory = () => {
    navigate('/admin/edit-category/new');
  };

  if (loading) return <div className="text-center mt-10">Cargando menú...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Categorías del menú</h2>
        <button
          onClick={handleNewCategory}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          + Nueva categoría
        </button>
      </div>

      {/* Buscador */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>

      {/* Grid de categorías */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {filteredCategories.map(category => (
          <div key={category.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="flex">
              {/* Imagen de la categoría (o placeholder) */}
              <div className="w-32 h-32 bg-gray-200 flex items-center justify-center">
                {category.imageUrl ? (
                  <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">X</span>
                )}
              </div>
              <div className="flex-1 p-4">
                <h3 className="text-xl font-bold mb-2">{category.name}</h3>
                {category.description && <p className="text-gray-600 mb-2">{category.description}</p>}
                <div className="mt-2">
                  <button
                    onClick={() => handleEditCategory(category.id)}
                    className="text-blue-500 hover:text-blue-700 text-sm"
                  >
                    Editar categoría
                  </button>
                </div>
              </div>
            </div>
            {/* Lista de variantes (solo texto) */}
            {category.items && category.items.length > 0 && (
              <div className="border-t px-4 py-2 bg-gray-50">
                <div className="flex flex-wrap gap-1 text-sm text-gray-600">
                  {category.items.slice(0, 5).map(variant => (
                    <span key={variant.id} className="bg-gray-200 px-2 py-0.5 rounded">
                      {variant.name} (${variant.price})
                    </span>
                  ))}
                  {category.items.length > 5 && <span className="text-xs text-gray-400">+{category.items.length-5} más</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {filteredCategories.length === 0 && (
        <p className="text-gray-500 text-center mt-8">No se encontraron categorías</p>
      )}
    </div>
  );
};

export default AdminMenu;