import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Card from '../ui/Card';
import Button from '../ui/Button';

const AdminMenu = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="text-center mt-10 text-tierra-clara">Cargando menú...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-display font-bold text-chocolate-oscuro">Categorías del menú</h2>
        <Button variant="success" onClick={handleNew}>
          + Nueva categoría
        </Button>
      </div>

      <input
        type="text"
        placeholder="Buscar categoría..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-2 border-b-2 border-barro-claro bg-white/80 rounded-t-md text-chocolate-oscuro placeholder:text-tierra-clara focus:border-chile-guajillo focus:outline-none mb-6 transition"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map(category => (
          <Card key={category.id} className="overflow-hidden !p-0 flex flex-col">
            <div className="flex">
              <div className="w-32 h-32 bg-barro-claro/30 flex items-center justify-center flex-shrink-0">
                {category.imageUrl ? (
                  <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl">X</span>
                )}
              </div>
              <div className="flex-1 p-4">
                <h3 className="text-xl font-display font-bold text-chocolate-oscuro mb-1">{category.name}</h3>
                {category.description && (
                  <p className="text-tierra-clara text-sm mb-3">{category.description}</p>
                )}
                <button
                  onClick={() => handleEdit(category.id)}
                  className="text-chile-guajillo hover:text-red-800 font-medium text-sm transition"
                >
                  Editar categoría
                </button>
              </div>
            </div>
            {category.items?.length > 0 && (
              <div className="border-t border-barro-claro/30 px-4 py-3 bg-barro-claro/10">
                <div className="flex flex-wrap gap-1 text-sm text-chocolate-oscuro">
                  {category.items.slice(0, 5).map(variant => (
                    <span key={variant.id} className="bg-barro-claro/30 px-2 py-0.5 rounded-full text-xs">
                      {variant.name} (${variant.price})
                    </span>
                  ))}
                  {category.items.length > 5 && (
                    <span className="text-xs text-tierra-clara">+{category.items.length - 5} más</span>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-tierra-clara text-center mt-8">No se encontraron categorías</p>
      )}
    </div>
  );
};

export default AdminMenu;