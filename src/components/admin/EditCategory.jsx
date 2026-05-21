import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';
import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';
import Card from '../ui/Card';
import Button from '../ui/Button';

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
  const [uploadingVariant, setUploadingVariant] = useState(false);
  const { notify, confirm } = useNotification();

  useEffect(() => {
    const fetch = async () => {
      if (categoryId === 'new') { setLoading(false); return; }
      const ref = doc(db, 'menuCategories', categoryId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        setName(d.name || '');
        setDescription(d.description || '');
        setImageUrl(d.imageUrl || '');
        setIsActive(d.active !== false);
        let vars = d.items || [];
        vars.sort((a, b) => a.name.localeCompare(b.name));
        setVariants(vars);
      } else {
        notify('Categoría no encontrada', 'error');
        navigate('/dashboard', { state: { activeTab: 'menu' } });
      }
      setLoading(false);
    };
    fetch();
  }, [categoryId, navigate]);

  useEffect(() => {
    if (variantId && variants.length) {
      const v = variants.find(v => v.id === parseInt(variantId));
      if (v) setActiveVariant(v);
    }
  }, [variantId, variants]);

  const uploadToImgBB = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) return data.data.url;
    throw new Error('Error al subir');
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try { setImageUrl(await uploadToImgBB(file)); }
    catch (err) { notify('No se pudo subir la imagen', 'error'); }
    finally { setUploading(false); }
  };

  const handleVariantImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingVariant(true);
    try {
      const url = await uploadToImgBB(file);
      setActiveVariant(prev => ({ ...prev, imageUrl: url }));
    } catch (err) {
      console.error(err);
      notify('No se pudo subir la imagen de la variante', 'error');
    } finally {
      setUploadingVariant(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return notify('Nombre obligatorio', 'warning');
    setSaving(true);
    const data = { name: name.trim(), description: description.trim(), imageUrl: imageUrl.trim(), active: isActive, items: variants };
    try {
      if (categoryId === 'new') await setDoc(doc(collection(db, 'menuCategories')), data);
      else await updateDoc(doc(db, 'menuCategories', categoryId), data);
      notify('Categoría guardada correctamente', 'success');
      navigate('/dashboard', { state: { activeTab: 'menu' } });
    } catch (err) { console.error(err); notify('Error al guardar', 'error'); }
    finally { setSaving(false); }
  };

  const addVariant = () => {
    const v = { id: Date.now(), name: 'Nueva variante', price: 0, description: '', active: true, imageUrl: '' };
    setVariants([...variants, v]);
    setActiveVariant(v);
  };

  const updateVariant = (updated) => {
    setVariants(variants.map(v => v.id === updated.id ? updated : v));
    setActiveVariant(null);
  };

  const deleteVariant = async (id) => {
    const respuesta = await confirm('¿Eliminar esta variante?');
    if (!respuesta) return;
    setVariants(variants.filter(v => v.id !== id));
    notify('Variante eliminada', 'success');
    if (activeVariant?.id === id) setActiveVariant(null);
  };

  const toggleVariantActive = (id) => {
    setVariants(variants.map(v => v.id === id ? { ...v, active: !v.active } : v));
  };

  if (loading) return <div className="text-center mt-10 text-tierra-clara">Cargando...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 bg-crema min-h-screen">
      <button onClick={() => navigate('/dashboard', { state: { activeTab: 'menu' } })} className="text-chile-guajillo hover:text-red-800 font-medium mb-4 inline-flex items-center gap-1">
        ← Volver al menú
      </button>

      <Card>
        <h2 className="text-2xl font-display font-bold text-chocolate-oscuro mb-6">
          {categoryId === 'new' ? 'Nueva categoría' : `Editar ${name}`}
        </h2>

        {/* Imagen categoría */}
        <div className="mb-4 flex items-start space-x-4">
          <div className="w-32 h-32 bg-barro-claro/30 rounded-xl overflow-hidden flex-shrink-0">
            <img src={imageUrl || 'https://via.placeholder.com/128?text=Sin+imagen'} alt={name || 'Categoría'} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-2">
            <label className="bg-chile-guajillo text-white px-4 py-2 rounded-xl text-sm font-medium cursor-pointer inline-block hover:bg-red-700 transition">
              {uploading ? 'Subiendo...' : 'Subir imagen'}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
            </label>
            {imageUrl && (
              <button onClick={() => setImageUrl('')} className="bg-tierra-clara text-white px-3 py-1 rounded-xl text-sm font-medium hover:bg-brown-700 transition block">
                Eliminar imagen
              </button>
            )}
          </div>
        </div>

        {/* Campos */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block font-medium text-chocolate-oscuro mb-1">Nombre de categoría *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full p-2 border-b-2 border-barro-claro bg-white/80 rounded-t-md text-chocolate-oscuro placeholder:text-tierra-clara focus:border-chile-guajillo focus:outline-none transition" />
          </div>
          <div>
            <label className="block font-medium text-chocolate-oscuro mb-1">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows="3"
              className="w-full p-2 border border-barro-claro rounded-lg bg-white/80 text-chocolate-oscuro placeholder:text-tierra-clara focus:border-chile-guajillo focus:outline-none transition resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded border-barro-claro text-chile-guajillo focus:ring-chile-guajillo" />
            <label className="text-chocolate-oscuro">Categoría activa</label>
          </div>
        </div>

        {/* Variantes */}
        <div className="border-t border-barro-claro/30 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold text-chocolate-oscuro">Variantes</h3>
            <Button variant="success" onClick={addVariant} className="text-sm py-1 px-3">+ Agregar variante</Button>
          </div>

          {activeVariant && (
            <Card className="mb-4 bg-barro-claro/10">
              <h4 className="font-display font-bold text-chocolate-oscuro mb-3">Editando variante</h4>
              <div className="mb-3 flex items-start space-x-4">
                <div className="w-20 h-20 bg-barro-claro/30 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={activeVariant.imageUrl || 'https://via.placeholder.com/80?text=Sin+img'} alt={activeVariant.name} className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1">
                  <label className="bg-chile-guajillo text-white px-3 py-1 rounded-lg text-xs font-medium cursor-pointer inline-block hover:bg-red-700 transition">
                    {uploadingVariant ? 'Subiendo...' : 'Subir imagen'}
                    <input type="file" accept="image/*" onChange={handleVariantImageUpload} className="hidden" disabled={uploadingVariant} />
                  </label>
                  {activeVariant.imageUrl && (
                    <button onClick={() => setActiveVariant({ ...activeVariant, imageUrl: '' })} className="bg-tierra-clara text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-brown-700 transition block">
                      Quitar imagen
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <input type="text" value={activeVariant.name} onChange={e => setActiveVariant({ ...activeVariant, name: e.target.value })}
                  placeholder="Nombre de la variante" className="w-full p-2 border-b-2 border-barro-claro bg-white rounded-t-md text-chocolate-oscuro focus:border-chile-guajillo focus:outline-none transition" />
                <input type="number" value={activeVariant.price} onChange={e => setActiveVariant({ ...activeVariant, price: parseFloat(e.target.value) })}
                  placeholder="Precio" className="w-full p-2 border-b-2 border-barro-claro bg-white rounded-t-md text-chocolate-oscuro focus:border-chile-guajillo focus:outline-none transition" />
                <textarea value={activeVariant.description || ''} onChange={e => setActiveVariant({ ...activeVariant, description: e.target.value })}
                  placeholder="Descripción individual (opcional)" rows="2" className="w-full p-2 border border-barro-claro rounded-lg bg-white text-chocolate-oscuro focus:border-chile-guajillo focus:outline-none transition resize-none" />
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={activeVariant.active !== false} onChange={e => setActiveVariant({ ...activeVariant, active: e.target.checked })}
                    className="rounded border-barro-claro text-chile-guajillo focus:ring-chile-guajillo" />
                  <label className="text-chocolate-oscuro text-sm">Activo</label>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" onClick={() => updateVariant(activeVariant)} className="text-sm py-1">Guardar variante</Button>
                  <Button variant="secondary" onClick={() => setActiveVariant(null)} className="text-sm py-1">Cancelar</Button>
                </div>
              </div>
            </Card>
          )}

          <ul className="space-y-2">
            {variants.map(v => (
              <li key={v.id} className="flex justify-between items-center border-b border-barro-claro/20 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-barro-claro/30 rounded-lg overflow-hidden flex-shrink-0">
                    {v.imageUrl ? <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">X</div>}
                  </div>
                  <div>
                    <span className={v.active === false ? 'line-through text-gray-400' : 'text-chocolate-oscuro font-medium'}>
                      {v.name} - <span className="text-maiz-dorado font-bold">${v.price}</span>
                    </span>
                    {v.description && <div className="text-xs text-tierra-clara">{v.description}</div>}
                  </div>
                </div>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => setActiveVariant(v)} className="text-chile-guajillo hover:text-red-800 font-medium">Editar</button>
                  <button onClick={() => toggleVariantActive(v.id)} className={`font-medium ${v.active ? 'text-maiz-dorado hover:text-yellow-700' : 'text-verde-nopal hover:text-green-700'}`}>
                    {v.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => deleteVariant(v.id)} className="text-chile-guajillo hover:text-red-800 font-medium">Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
          {variants.length === 0 && <p className="text-tierra-clara text-sm mt-2">No hay variantes</p>}
        </div>

        {/* Botones finales */}
        <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-barro-claro/30">
          <Button variant="secondary" onClick={() => navigate('/dashboard', { state: { activeTab: 'menu' } })}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default EditCategory;