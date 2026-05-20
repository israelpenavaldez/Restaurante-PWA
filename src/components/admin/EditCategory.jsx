import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

const EditCategory = () => {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const variantId = queryParams.get('variant');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [variants, setVariants] = useState([]);
  const [activeVariant, setActiveVariant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVariant, setUploadingVariant] = useState(false); // imagen de la variante

  // Cargar categoría existente o inicializar nueva
  useEffect(() => {
    const fetchCategory = async () => {
      if (categoryId === 'new') {
        setLoading(false);
        return;
      }
      const docRef = doc(db, 'menuCategories', categoryId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        let variants = data.items || [];
        variants.sort((a, b) => a.name.localeCompare(b.name));
        setName(data.name || '');
        setDescription(data.description || '');
        setImageUrl(data.imageUrl || '');
        setIsActive(data.active !== false);
        setVariants(variants);
      } else {
        alert('Categoría no encontrada');
        navigate('/dashboard', { state: { activeTab: 'menu' } });
      }
      setLoading(false);
    };
    fetchCategory();
  }, [categoryId, navigate]);

  // Si hay variantId, seleccionar esa variante para editar
  useEffect(() => {
    if (variantId && variants.length) {
      const variant = variants.find(v => v.id === parseInt(variantId));
      if (variant) setActiveVariant(variant);
    }
  }, [variantId, variants]);

  // Subir imagen a ImgBB (para categoría)
  const uploadToImgBB = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    if (data.success) {
      return data.data.url;
    } else {
      throw new Error('Error al subir imagen');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadToImgBB(file);
      setImageUrl(url);
    } catch (error) {
      console.error(error);
      alert('No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  // Subir imagen a ImgBB (para variante)
  const handleVariantImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingVariant(true);
    try {
      const url = await uploadToImgBB(file);
      setActiveVariant({ ...activeVariant, imageUrl: url });
    } catch (error) {
      console.error(error);
      alert('No se pudo subir la imagen');
    } finally {
      setUploadingVariant(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('El nombre de la categoría es obligatorio');
      return;
    }
    setSaving(true);
    const data = {
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      active: isActive,
      items: variants,
    };
    try {
      if (categoryId === 'new') {
        const newRef = doc(collection(db, 'menuCategories'));
        await setDoc(newRef, data);
      } else {
        await updateDoc(doc(db, 'menuCategories', categoryId), data);
      }
      alert('Categoría guardada correctamente');
      navigate('/dashboard', { state: { activeTab: 'menu' } });
    } catch (error) {
      console.error(error);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariant = () => {
    const newId = Date.now();
    const newVariant = {
      id: newId,
      name: 'Nueva variante',
      price: 0,
      description: '',
      active: true,
      imageUrl: '',
    };
    setVariants([...variants, newVariant]);
    setActiveVariant(newVariant);
  };

  const handleUpdateVariant = (updated) => {
    setVariants(variants.map(v => v.id === updated.id ? updated : v));
    setActiveVariant(null);
  };

  const handleDeleteVariant = (id) => {
    if (window.confirm('¿Eliminar esta variante?')) {
      setVariants(variants.filter(v => v.id !== id));
      if (activeVariant?.id === id) setActiveVariant(null);
    }
  };

  const handleToggleVariantActive = (id) => {
    setVariants(variants.map(v => v.id === id ? { ...v, active: !v.active } : v));
  };

  if (loading) return <div className="text-center mt-10">Cargando...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <button onClick={() => navigate('/dashboard', { state: { activeTab: 'menu' } })} className="text-blue-500 hover:underline mb-4">
        ← Volver al menú
      </button>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-6">
          {categoryId === 'new' ? 'Nueva categoría' : `Editar ${name}`}
        </h2>

        {/* Imagen de la categoría */}
        <div className="mb-4 flex items-start space-x-4">
          <div className="w-32 h-32 bg-gray-100 rounded overflow-hidden flex-shrink-0">
            <img
              src={imageUrl || 'https://via.placeholder.com/128?text=Sin+imagen'}
              alt={name || 'Categoría'}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-2">
            <label className="bg-blue-500 text-white px-3 py-1 rounded text-sm cursor-pointer inline-block">
              {uploading ? 'Subiendo...' : 'Subir imagen'}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
            </label>
            {imageUrl && (
              <button onClick={() => setImageUrl('')} className="bg-red-500 text-white px-3 py-1 rounded text-sm">
                Eliminar imagen
              </button>
            )}
          </div>
        </div>

        {/* Campos generales */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block font-medium mb-1">Nombre de categoría *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mr-2"
            />
            <label>Categoría activa (visible en el menú)</label>
          </div>
        </div>

        {/* Gestión de variantes */}
        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Variantes</h3>
            <button
              onClick={handleAddVariant}
              className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
            >
              + Agregar variante
            </button>
          </div>

          {/* Formulario de edición de variante activa */}
          {activeVariant && (
            <div className="bg-gray-50 p-4 rounded mb-4">
              <h4 className="font-semibold mb-2">Editando variante</h4>
              
              {/* Imagen de la variante */}
              <div className="mb-3 flex items-start space-x-4">
                <div className="w-20 h-20 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={activeVariant.imageUrl || 'https://via.placeholder.com/80?text=Sin+imagen'}
                    alt={activeVariant.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-1">
                  <label className="bg-blue-500 text-white px-3 py-1 rounded text-xs cursor-pointer inline-block">
                    {uploadingVariant ? 'Subiendo...' : 'Subir imagen'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleVariantImageUpload}
                      className="hidden"
                      disabled={uploadingVariant}
                    />
                  </label>
                  {activeVariant.imageUrl && (
                    <button
                      onClick={() => setActiveVariant({ ...activeVariant, imageUrl: '' })}
                      className="bg-red-500 text-white px-3 py-1 rounded text-xs"
                    >
                      Quitar imagen
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={activeVariant.name}
                  onChange={(e) => setActiveVariant({ ...activeVariant, name: e.target.value })}
                  placeholder="Nombre de la variante"
                  className="w-full p-2 border border-gray-300 rounded"
                />
                <input
                  type="number"
                  value={activeVariant.price}
                  onChange={(e) => setActiveVariant({ ...activeVariant, price: parseFloat(e.target.value) })}
                  placeholder="Precio"
                  className="w-full p-2 border border-gray-300 rounded"
                />
                <textarea
                  value={activeVariant.description || ''}
                  onChange={(e) => setActiveVariant({ ...activeVariant, description: e.target.value })}
                  placeholder="Descripción individual (opcional)"
                  rows="2"
                  className="w-full p-2 border border-gray-300 rounded"
                />
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={activeVariant.active !== false}
                    onChange={(e) => setActiveVariant({ ...activeVariant, active: e.target.checked })}
                    className="mr-2"
                  />
                  <label>Activo</label>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleUpdateVariant(activeVariant)}
                    className="bg-blue-500 text-white px-3 py-1 rounded"
                  >
                    Guardar variante
                  </button>
                  <button
                    onClick={() => setActiveVariant(null)}
                    className="bg-gray-500 text-white px-3 py-1 rounded"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de variantes */}
          <ul className="space-y-2">
            {variants.map(variant => (
              <li key={variant.id} className="flex justify-between items-center border-b pb-2">
                <div className="flex items-center space-x-3">
                  {/* Miniatura de la variante */}
                  <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    {variant.imageUrl ? (
                      <img src={variant.imageUrl} alt={variant.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">X</div>
                    )}
                  </div>
                  <div>
                    <span className={variant.active === false ? 'line-through text-gray-400' : ''}>
                      {variant.name} - ${variant.price}
                    </span>
                    {variant.description && (
                      <div className="text-xs text-gray-500">{variant.description}</div>
                    )}
                  </div>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => setActiveVariant(variant)}
                    className="text-blue-500 hover:text-blue-700 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleToggleVariantActive(variant.id)}
                    className={`text-sm ${variant.active ? 'text-yellow-500' : 'text-green-500'}`}
                  >
                    {variant.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => handleDeleteVariant(variant.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {variants.length === 0 && <p className="text-gray-500">No hay variantes</p>}
        </div>

        {/* Botones guardar/cancelar */}
        <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
          <button
            onClick={() => navigate('/dashboard', { state: { activeTab: 'menu' } })}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditCategory;