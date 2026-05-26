import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
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

  const { isServiceOpen } = useAuth();
  const { notify, confirm } = useNotification();

  // Determina si hay variantes incompletas
  const hasIncompleteVariants = useMemo(() => {
    return variants.some(v => !v.name.trim() || v.price <= 0);
  }, [variants]);

  useEffect(() => {
    const fetchCategory = async () => {
      if (categoryId === 'new') { setLoading(false); return; }
      const docRef = doc(db, 'menuCategories', categoryId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setName(data.name || '');
        setDescription(data.description || '');
        setImageUrl(data.imageUrl || '');
        setIsActive(data.active !== false);
        let vars = data.items || [];
        vars.sort((a, b) => a.name.localeCompare(b.name));
        setVariants(vars);
      } else {
        notify('Categoría no encontrada', 'error');
        navigate('/dashboard', { state: { activeTab: 'menu' } });
      }
      setLoading(false);
    };
    fetchCategory();
  }, [categoryId, navigate, notify]);

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
      notify('No se pudo subir la imagen', 'error');
    } finally {
      setUploadingVariant(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      notify('El nombre de la categoría es obligatorio', 'warning');
      return;
    }

    // Validación extra, aunque el botón esté deshabilitado
    const incomplete = variants.find(v => !v.name.trim() || v.price <= 0);
    if (incomplete) {
      notify(`Corrige la variante "${incomplete.name || 'sin nombre'}" antes de guardar.`, 'warning');
      return;
    }

    const ok = await confirm('¿Guardar los cambios de la categoría?');
    if (!ok) return;

    setSaving(true);
    const data = {
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      active: isActive,
      items: variants,
    };
    try {
      if (categoryId === 'new') await setDoc(doc(collection(db, 'menuCategories')), data);
      else await updateDoc(doc(db, 'menuCategories', categoryId), data);
      notify('Categoría guardada correctamente', 'success');
      navigate('/dashboard', { state: { activeTab: 'menu' } });
    } catch (err) {
      console.error(err);
      notify('Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addVariant = () => {
    if (isServiceOpen) {
      notify('No puede agregar variantes con el servicio abierto', 'warning');
      return;
    }
    const v = { id: Date.now(), name: 'Nueva variante', price: 0, description: '', active: true, imageUrl: '' };
    setVariants([...variants, v]);
    setActiveVariant(v);
  };

  const updateVariant = async (updated) => {
    if (!updated.name.trim()) {
      notify('El nombre de la variante es obligatorio', 'warning');
      return;
    }
    if (updated.price <= 0) {
      notify('El precio debe ser mayor a 0', 'warning');
      return;
    }
    const ok = await confirm('¿Guardar los cambios de la variante?');
    if (!ok) return;
    setVariants(variants.map(v => v.id === updated.id ? updated : v));
    setActiveVariant(null);
  };

  const deleteVariant = async (id) => {
    if (isServiceOpen) {
      notify('No puede eliminar variantes con el servicio abierto', 'warning');
      return;
    }
    const respuesta = await confirm('¿Eliminar esta variante?');
    if (!respuesta) return;
    setVariants(variants.filter(v => v.id !== id));
    if (activeVariant?.id === id) setActiveVariant(null);
    try {
      const updatedVariants = variants.filter(v => v.id !== id);
      await updateDoc(doc(db, 'menuCategories', categoryId), { items: updatedVariants });
      notify('Variante eliminada', 'success');
    } catch (error) {
      notify('Error al eliminar', 'error');
    }
  };

  const toggleVariantActive = async (id) => {
    const variant = variants.find(v => v.id === id);
    const ok = await confirm(variant?.active ? '¿Desactivar esta variante?' : '¿Activar esta variante?');
    if (!ok) return;

    const updatedVariants = variants.map(v =>
      v.id === id ? { ...v, active: !v.active } : v
    );
    setVariants(updatedVariants);
    if (activeVariant?.id === id) {
      setActiveVariant(prev => ({ ...prev, active: !prev.active }));
    }
    try {
      await updateDoc(doc(db, 'menuCategories', categoryId), { items: updatedVariants });
      notify('Estado de variante actualizado', 'success');
    } catch (error) {
      console.error(error);
      notify('Error al actualizar', 'error');
    }
  };

  const toggleCategoryActive = async () => {
    const ok = await confirm(isActive ? '¿Desactivar esta categoría?' : '¿Activar esta categoría?');
    if (!ok) return;

    const newActive = !isActive;
    // Siempre sincronizamos el estado de todas las variantes con el de la categoría
    const updatedVariants = variants.map(v => ({ ...v, active: newActive }));

    setIsActive(newActive);
    setVariants(updatedVariants);
    try {
      await updateDoc(doc(db, 'menuCategories', categoryId), {
        active: newActive,
        items: updatedVariants,
      });
      notify(newActive ? 'Categoría activada (todas las variantes fueron activadas)' : 'Categoría desactivada (todas las variantes fueron desactivadas)', 'success');
    } catch (error) {
      console.error(error);
      notify('Error al cambiar estado', 'error');
      setIsActive(!newActive); // revertir
      setVariants(variants);
    }
  };

  const handleRemoveImage = async () => {
    if (!imageUrl) return;
    const ok = await confirm('¿Quitar la imagen de la categoría?');
    if (!ok) return;
    setImageUrl('');
  };

  const handleRemoveVariantImage = async () => {
    if (!activeVariant?.imageUrl) return;
    const ok = await confirm('¿Quitar la imagen de la variante?');
    if (!ok) return;
    setActiveVariant(prev => ({ ...prev, imageUrl: '' }));
  };

  // Función para saber si una variante está incompleta
  const isVariantIncomplete = (v) => !v.name.trim() || v.price <= 0;

  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando...</div>;

  const isEditingBlocked = isServiceOpen && categoryId !== 'new';

  return (
    <div className="max-w-4xl mx-auto p-4 bg-fondo min-h-screen">
      <button onClick={() => navigate('/dashboard', { state: { activeTab: 'menu' } })} className="text-acento hover:text-acento-hover font-medium mb-4 inline-flex items-center gap-1">
        ← Volver al menú
      </button>

      <Card>
        <h2 className="text-2xl font-display font-bold text-texto mb-6">
          {categoryId === 'new' ? 'Nueva categoría' : `Editar ${name}`}
        </h2>

        {isEditingBlocked && (
          <div className="bg-acento/10 text-acento rounded-xl p-4 mb-6">
            <p className="font-medium">Servicio abierto</p>
            <p className="text-sm">Solo puede activar/desactivar categorías y variantes. Las ediciones completas requieren cerrar el servicio.</p>
          </div>
        )}

        <div className="mb-4 flex items-start space-x-4">
          <div className="w-32 h-32 bg-tarjeta-alt/30 rounded-xl overflow-hidden flex-shrink-0">
            <img src={imageUrl || 'https://via.placeholder.com/128?text=Sin+imagen'} alt={name || 'Categoría'} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-2">
            {!isEditingBlocked && (
              <>
                <label className="bg-acento text-texto-inverso px-4 py-2 rounded-xl text-sm font-medium cursor-pointer inline-block hover:bg-acento-hover transition">
                  {uploading ? 'Subiendo...' : 'Subir imagen'}
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                </label>
                {imageUrl && (
                  <button onClick={handleRemoveImage} className="bg-boton-eliminar text-texto-inverso px-3 py-1 rounded-xl text-sm font-medium hover:bg-opacity-80 transition block">
                    Eliminar imagen
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block font-medium text-texto mb-1">Nombre de categoría *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEditingBlocked}
              className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block font-medium text-texto mb-1">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              disabled={isEditingBlocked}
              className="w-full p-2 border border-borde rounded-lg bg-white/80 text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={categoryId !== 'new' ? toggleCategoryActive : (e) => setIsActive(e.target.checked)}
              className="rounded border-borde text-acento focus:ring-acento"
            />
            <label className="text-texto">Categoría activa</label>
          </div>
        </div>

        <div className="border-t border-borde-claro pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-display font-bold text-texto">Variantes</h3>
            <Button variant="success" onClick={addVariant} disabled={isServiceOpen} className="text-sm py-1 px-3">
              + Agregar variante
            </Button>
          </div>

          {activeVariant && (
            <Card className="mb-4 bg-tarjeta-alt/10">
              <h4 className="font-display font-bold text-texto mb-3">
                {isServiceOpen ? 'Vista rápida (servicio abierto)' : 'Editando variante'}
              </h4>

              {isServiceOpen ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-texto">{activeVariant.name}</p>
                    <p className="text-sm text-texto-claro">${activeVariant.price}</p>
                  </div>
                  <button
                    onClick={() => toggleVariantActive(activeVariant.id)}
                    className={`px-3 py-1 rounded-xl text-sm font-medium transition ${
                      activeVariant.active ? 'bg-boton-aviso text-boton-aviso-texto hover:bg-boton-aviso-hover' : 'bg-boton-exito text-boton-exito-texto hover:bg-boton-exito-hover'
                    }`}
                  >
                    {activeVariant.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-start space-x-4">
                    <div className="w-20 h-20 bg-tarjeta-alt/30 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={activeVariant.imageUrl || 'https://via.placeholder.com/80?text=Sin+img'} alt={activeVariant.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-1">
                      <label className="bg-acento text-texto-inverso px-3 py-1 rounded-lg text-xs font-medium cursor-pointer inline-block hover:bg-acento-hover transition">
                        {uploadingVariant ? 'Subiendo...' : 'Subir imagen'}
                        <input type="file" accept="image/*" onChange={handleVariantImageUpload} className="hidden" disabled={uploadingVariant} />
                      </label>
                      {activeVariant.imageUrl && (
                        <button onClick={handleRemoveVariantImage} className="bg-boton-eliminar text-texto-inverso px-3 py-1 rounded-lg text-xs font-medium hover:bg-opacity-80 transition block">
                          Quitar imagen
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input type="text" value={activeVariant.name} onChange={e => setActiveVariant({ ...activeVariant, name: e.target.value })}
                      placeholder="Nombre de la variante" className="w-full p-2 border-b-2 border-borde bg-white rounded-t-md text-texto focus:border-acento focus:outline-none transition" />
                    <input type="number" value={activeVariant.price} onChange={e => setActiveVariant({ ...activeVariant, price: parseFloat(e.target.value) })}
                      placeholder="Precio" className="w-full p-2 border-b-2 border-borde bg-white rounded-t-md text-texto focus:border-acento focus:outline-none transition" />
                    <textarea value={activeVariant.description || ''} onChange={e => setActiveVariant({ ...activeVariant, description: e.target.value })}
                      placeholder="Descripción individual (opcional)" rows="2" className="w-full p-2 border border-borde rounded-lg bg-white text-texto focus:border-acento focus:outline-none transition resize-none" />
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={activeVariant.active !== false} onChange={e => setActiveVariant({ ...activeVariant, active: e.target.checked })}
                        className="rounded border-borde text-acento focus:ring-acento" />
                      <label className="text-texto text-sm">Activo</label>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={() => updateVariant(activeVariant)} className="text-sm py-1">Guardar variante</Button>
                      <Button variant="secondary" onClick={() => setActiveVariant(null)} className="text-sm py-1">Cancelar</Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          )}

          <ul className="space-y-2">
            {variants.map(v => {
              const incomplete = isVariantIncomplete(v);
              return (
                <li key={v.id} className={`flex justify-between items-center border-b ${incomplete ? 'border-acento' : 'border-borde-claro'} pb-3`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-tarjeta-alt/30 rounded-lg overflow-hidden flex-shrink-0">
                      {v.imageUrl ? <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-texto-claro text-xs">🍽️</div>}
                    </div>
                    <div>
                      <span className={v.active === false ? 'line-through text-texto-claro' : 'text-texto font-medium'}>
                        {v.name || <span className="text-acento italic">Sin nombre</span>} - <span className="text-texto-aviso font-bold">${v.price}</span>
                      </span>
                      {v.description && <div className="text-xs text-texto-claro">{v.description}</div>}
                      {incomplete && (
                        <p className="text-xs text-acento mt-1">⚠️ Debe tener un nombre y un precio mayor a 0</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 text-sm">
                    {!isServiceOpen && (
                      <button onClick={() => setActiveVariant(v)} className="text-acento hover:text-acento-hover font-medium">Editar</button>
                    )}
                    <button
                      onClick={() => toggleVariantActive(v.id)}
                      className={`font-medium ${v.active ? 'text-texto-aviso hover:text-texto-aviso-hover' : 'text-texto-exito hover:text-texto-exito-hover'}`}
                    >
                      {v.active ? 'Desactivar' : 'Activar'}
                    </button>
                    {!isServiceOpen && (
                      <button onClick={() => deleteVariant(v.id)} className="text-acento hover:text-acento-hover font-medium">Eliminar</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {variants.length === 0 && <p className="text-texto-claro text-sm mt-2">No hay variantes</p>}
        </div>

        <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-borde-claro">
          <Button variant="secondary" onClick={() => navigate('/dashboard', { state: { activeTab: 'menu' } })}>Cancelar</Button>
          {!isServiceOpen && (
            <Button variant="primary" onClick={handleSave} disabled={saving || hasIncompleteVariants || !name.trim()}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default EditCategory;