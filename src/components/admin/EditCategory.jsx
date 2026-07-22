import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Toggle from '../ui/Toggle';

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

/**
 * Editor de categoría del menú.
 * Permite crear o modificar una categoría (nombre, descripción, imagen, estado)
 * y gestionar sus variantes (agregar, editar, eliminar, activar/desactivar).
 * Incluye validación para evitar guardar variantes sin nombre o con precio ≤ 0.
 */
const EditCategory = () => {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const variantId = queryParams.get('variant');

  // ===== ESTADOS DE LA CATEGORÍA =====
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);           // imagen de categoría

  // ===== ESTADOS PARA MODALES DE VARIANTES =====
  const [showVariantModal, setShowVariantModal] = useState(false);   // modal de edición/creación
  const [editingVariant, setEditingVariant] = useState(null);       // variante que se está editando (null = nueva)
  const [uploadingVariant, setUploadingVariant] = useState(false); // imagen de variante

  const { isServiceOpen } = useAuth();
  const { notify, confirm } = useNotification();

  /**
   * Determina si hay al menos una variante que no cumple
   * con los requisitos mínimos (nombre y precio > 0).
   */
  const hasIncompleteVariants = useMemo(() => {
    return variants.some(v => !v.name.trim() || v.price <= 0);
  }, [variants]);

  // ===== CARGA INICIAL =====

  /** Carga los datos de la categoría desde Firestore (o prepara una nueva). */
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

  /** Si se pasa un variantId por URL, abre el editor de esa variante. */
  useEffect(() => {
    if (variantId && variants.length) {
      const v = variants.find(v => v.id === parseInt(variantId));
      if (v) {
        setEditingVariant(v);
        setShowVariantModal(true);
      }
    }
  }, [variantId, variants]);

  // ===== SUBIDA DE IMÁGENES A IMGBB =====

  /**
   * Sube una imagen al servicio ImgBB y devuelve la URL pública.
   * @param {File} file - Archivo de imagen a subir.
   * @returns {Promise<string>} URL de la imagen subida.
   */
  const uploadToImgBB = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) return data.data.url;
    throw new Error('Error al subir');
  };

  /** Maneja la subida de imagen para la categoría. */
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try { setImageUrl(await uploadToImgBB(file)); }
    catch (err) { notify('No se pudo subir la imagen', 'error'); }
    finally { setUploading(false); }
  };

  /** Maneja la subida de imagen para la variante en el modal. */
  const handleVariantImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingVariant(true);
    try {
      const url = await uploadToImgBB(file);
      setEditingVariant(prev => ({ ...prev, imageUrl: url }));
    } catch (err) {
      notify('No se pudo subir la imagen', 'error');
    } finally {
      setUploadingVariant(false);
    }
  };

  // ===== OPERACIONES SOBRE LA CATEGORÍA =====

  /**
   * Guarda la categoría (crea o actualiza) en Firestore.
   * Solo afecta nombre, descripción e imagen. Las variantes se gestionan aparte.
   */
  const handleSaveCategory = async () => {
    if (!name.trim()) {
      notify('El nombre es obligatorio', 'warning');
      return;
    }

    const ok = await confirm('¿Guardar los cambios?');
    if (!ok) return;

    setSaving(true);
    const data = {
      name: name.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      active: isActive,
      items: variants, // las variantes ya están actualizadas
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

  /** Cancela la edición de categoría y vuelve al menú. */
  const handleCancelCategory = () => {
    navigate('/dashboard', { state: { activeTab: 'menu' } });
  };

  /**
   * Elimina permanentemente la categoría y redirige al menú.
   * Solicita confirmación antes de ejecutar la acción.
   */
  const handleDeleteCategory = async () => {
    if (categoryId === 'new') {
      notify('No se puede eliminar una categoría que aún no se ha creado', 'warning');
      return;
    }

    const ok = await confirm('¿Eliminar esta categoría y todas sus variantes? Esta acción no se puede deshacer.');
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'menuCategories', categoryId));
      notify('Categoría eliminada correctamente', 'success');
      navigate('/dashboard', { state: { activeTab: 'menu' } });
    } catch (error) {
      console.error(error);
      notify('Error al eliminar la categoría', 'error');
    }
  };

  /**
   * Alterna el estado activo/inactivo de la categoría
   * y sincroniza el mismo estado en todas sus variantes.
   */
  const toggleCategoryActive = async () => {
    const ok = await confirm(isActive ? '¿Desactivar esta categoría?' : '¿Activar esta categoría?');
    if (!ok) return;

    const newActive = !isActive;
    const updatedVariants = variants.map(v => ({ ...v, active: newActive }));

    setIsActive(newActive);
    setVariants(updatedVariants);
    try {
      await updateDoc(doc(db, 'menuCategories', categoryId), {
        active: newActive,
        items: updatedVariants,
      });
      notify(newActive ? 'Categoría activada' : 'Categoría desactivada', 'success');
    } catch (error) {
      console.error(error);
      notify('Error al cambiar estado', 'error');
      setIsActive(!newActive); // revertir
      setVariants(variants);
    }
  };

  /** Quita la imagen de la categoría (con confirmación). */
  const handleRemoveImage = async () => {
    if (!imageUrl) return;
    const ok = await confirm('¿Quitar la imagen?');
    if (!ok) return;
    setImageUrl('');
  };

  // ===== OPERACIONES SOBRE VARIANTES =====

  /** Abre el modal para crear una nueva variante. Siempre disponible. */
  const openNewVariant = () => {
    setEditingVariant({
      id: Date.now(),
      name: 'Nuevo',
      price: 0,
      description: '',
      active: true,
      imageUrl: ''
    });
    setShowVariantModal(true);
  };

  /** Abre el modal para editar una variante existente. Solo si el servicio está cerrado. */
  const openEditVariant = (variant) => {
    if (isServiceOpen) {
      notify('No puede editar con el servicio abierto', 'warning');
      return;
    }
    setEditingVariant(variant);
    setShowVariantModal(true);
  };

  /** Cierra el modal de variante sin guardar cambios. */
  const closeVariantModal = () => {
    setShowVariantModal(false);
    setEditingVariant(null);
  };

  /**
   * Guarda la variante que se está editando/creando en el modal.
   * La añade o actualiza en el array local de variantes.
   */
  const saveVariant = async () => {
    const updated = editingVariant;
    if (!updated) return;

    if (!updated.name.trim()) {
      notify('El nombre es obligatorio', 'warning');
      return;
    }
    if (updated.price <= 0) {
      notify('El precio debe ser mayor a 0', 'warning');
      return;
    }

    // Si es una variante nueva (id no existente), la agregamos; si no, la actualizamos
    const exists = variants.find(v => v.id === updated.id);
    let newVariants;
    if (exists) {
      newVariants = variants.map(v => v.id === updated.id ? updated : v);
    } else {
      newVariants = [...variants, updated];
    }

    // Si el servicio está abierto y estamos creando una variante, la guardamos directamente
    // pero no permitimos edición posterior (ya se controla con el botón "Editar" deshabilitado)
    const ok = await confirm('¿Guardar los cambios?');
    if (!ok) return;

    setVariants(newVariants);
    // Si la categoría ya existe, guardamos en Firestore inmediatamente
    if (categoryId !== 'new') {
      try {
        await updateDoc(doc(db, 'menuCategories', categoryId), { items: newVariants });
        notify('Guardado correctamente', 'success');
      } catch (error) {
        console.error(error);
        notify('Error al guardar', 'error');
        return;
      }
    }
    closeVariantModal();
  };

  /** Elimina una variante (con confirmación). */
  const deleteVariant = async (id) => {
    if (isServiceOpen) {
      notify('No puede eliminar con el servicio abierto', 'warning');
      return;
    }
    const respuesta = await confirm('¿Está seguro?');
    if (!respuesta) return;
    const updatedVariants = variants.filter(v => v.id !== id);
    setVariants(updatedVariants);
    if (categoryId !== 'new') {
      try {
        await updateDoc(doc(db, 'menuCategories', categoryId), { items: updatedVariants });
        notify('Eliminado correctamente', 'success');
      } catch (error) {
        notify('Error al eliminar', 'error');
      }
    }
  };

  /** Alterna el estado activo/inactivo de una variante individual. */
  const toggleVariantActive = async (id) => {
    const variant = variants.find(v => v.id === id);
    const ok = await confirm(variant?.active ? '¿Desactivar?' : '¿Activar?');
    if (!ok) return;

    const updatedVariants = variants.map(v =>
      v.id === id ? { ...v, active: !v.active } : v
    );
    setVariants(updatedVariants);
    if (categoryId !== 'new') {
      try {
        await updateDoc(doc(db, 'menuCategories', categoryId), { items: updatedVariants });
        notify('Estado actualizado', 'success');
      } catch (error) {
        console.error(error);
        notify('Error al actualizar', 'error');
      }
    }
  };

  /** Indica si una variante tiene campos obligatorios vacíos o inválidos. */
  const isVariantIncomplete = (v) => !v.name.trim() || v.price <= 0;

  // ===== RENDERIZADO =====

  if (loading) return <div className="text-center mt-10 text-texto-claro">Cargando...</div>;

  const isEditingBlocked = isServiceOpen && categoryId !== 'new';

  return (
    <div className="max-w-4xl mx-auto p-4 bg-fondo min-h-screen">
      <Button 
        variant="return" 
        onClick={() => navigate('/dashboard', { state: { activeTab: 'menu' } })} 
        className="font-medium mb-4 inline-flex items-center gap-1"
      >
        ← Volver
      </Button>

      <Card>
        <h2 className="text-2xl font-display font-bold text-texto mb-6">
          {categoryId === 'new' ? 'Nueva categoría' : `${name}`}
        </h2>

        {/* Aviso cuando el servicio está abierto */}
        {isEditingBlocked && (
          <div className="bg-acento/10 text-acento rounded-xl p-4 mb-6">
            <p className="font-medium">Servicio abierto</p>
            <p className="text-sm">
              Solo puede activar/desactivar categorías y variantes. Las ediciones completas requieren cerrar el servicio.
            </p>
          </div>
        )}

        {/* ===== IMAGEN DE LA CATEGORÍA ===== */}
        <div className="mb-4 flex items-start space-x-4">
          <div className="w-32 h-32 bg-tarjeta-alt/30 rounded-xl overflow-hidden flex-shrink-0">
            <img 
              src={imageUrl || 'https://placehold.co/128x128?text=Sin+imagen'} 
              alt={name || 'Categoría'} 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-2">
            {!isEditingBlocked && (
              <>
                <label className="bg-boton-exito text-boton-exito-texto px-4 py-2 rounded-xl text-sm font-medium cursor-pointer inline-block hover:bg-boton-exito-hover transition">
                  {uploading ? 'Subiendo...' : 'Subir imagen'}
                  <input 
                    type="file" accept="image/*" 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    disabled={uploading} 
                  />
                </label>
                {imageUrl && (
                  <Button 
                    variant="delete"
                    onClick={handleRemoveImage} 
                    className="px-3 py-1 rounded-xl text-sm font-medium transition block"
                  >
                    Eliminar imagen
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ===== CAMPOS DE TEXTO DE LA CATEGORÍA ===== */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block font-bold text-texto mb-1">
              Nombre de categoría:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isEditingBlocked}
              className="w-full p-2 border-b-2 border-borde bg-white/80 rounded-t-md text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block font-bold text-texto mb-1">Descripción:</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              disabled={isEditingBlocked}
              className="w-full p-2 border border-borde rounded-lg bg-white/80 text-texto placeholder:text-texto-claro focus:border-acento focus:outline-none transition resize-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* ===== BOTONES FINALES DE CATEGORÍA (solo si no está bloqueado) ===== */}
          {!isEditingBlocked && (
            <div className="flex justify-between pt-2">
              {/* Botón de eliminación a la izquierda */}
              <div>
                {categoryId !== 'new' && (
                  <Button 
                    variant="delete" 
                    onClick={handleDeleteCategory}
                  >
                    Eliminar categoría
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="cancel" 
                  onClick={handleCancelCategory}
                >
                  Cancelar
                </Button>
                <Button 
                  variant="success" 
                  onClick={handleSaveCategory} 
                  disabled={saving || !name.trim()}
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          )}

          {/* Toggle de categoría (siempre visible) */}
          <div className="flex justify-end items-center gap-2">
            <Toggle
              enabled={isActive}
              onChange={
                categoryId !== 'new'
                ? () => toggleCategoryActive()
                : (val) => setIsActive(val)
              }
              label={isActive ? 'Categoría activa' : 'Categoría inactiva'}
            />
          </div>
        </div>
      </Card>
      <Card className="mt-6">
        {/* ===== GESTIÓN DE VARIANTES ===== */}
        <div className="border-t border-borde-claro pt-6">
          {/* Lista de variantes existentes */}
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
                      <span className={v.active === false ? 'line-through text-texto-claro' : 'text-texto font-bold'}>
                        {v.name || <span className="text-acento italic">Sin nombre</span>}
                      </span>
                      <span className="text-texto-aviso font-medium">
                        {v.price && <div>${v.price}</div>}
                      </span>
                      {v.description && <div className="text-xs text-texto-claro">{v.description}</div>}
                      {incomplete && (
                        <p className="text-xs text-acento mt-1"> ¡¡Debe tener un nombre y un precio mayor a 0!!</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Toggle
                      enabled={v.active}
                      onChange={() => toggleVariantActive(v.id)}
                      label={v.active ? 'Activo' : 'Inactivo'}
                    />
                    {!isServiceOpen && (
                        <Button 
                          variant="warning" 
                          onClick={() => openEditVariant(v)} 
                          className="font-medium"
                        >
                          Editar
                        </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {variants.length === 0 && <p className="text-texto-claro text-sm mt-2">No hay variantes</p>}

          {/* Botón para agregar nueva variante (siempre visible) */}
          <div className="flex justify-center mt-4">
            <Button 
              variant="primary" 
              onClick={openNewVariant} 
              className="text-sm py-1 px-3"
            >
              + Agregar
            </Button>
          </div>
        </div>
      </Card>

      {/* ===== MODAL DE EDICIÓN/CREACIÓN DE VARIANTE ===== */}
      {showVariantModal && editingVariant && (
        <div className="fixed inset-0 bg-texto/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-display font-bold text-texto mb-4">
              {variants.find(v => v.id === editingVariant.id) ? 'Editar variante' : 'Nueva variante'}
            </h3>

            {/* Imagen de la variante */}
            <div className="mb-4 flex items-start space-x-4">
              <div className="w-20 h-20 bg-tarjeta-alt/30 rounded-xl overflow-hidden flex-shrink-0">
                <img 
                  src={editingVariant.imageUrl || 'https://placehold.co/128x128?text=Sin+imagen'} 
                  alt={editingVariant.name} 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="space-y-1">
                <label className="bg-acento text-texto-inverso px-3 py-1 rounded-lg text-xs font-medium cursor-pointer inline-block hover:bg-acento-hover transition">
                  {uploadingVariant ? 'Subiendo...' : 'Subir imagen'}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleVariantImageUpload} 
                    className="hidden" 
                    disabled={uploadingVariant} 
                  />
                </label>
                {editingVariant.imageUrl && (
                  <Button 
                    variant="delete"
                    onClick={() => setEditingVariant(prev => ({ ...prev, imageUrl: '' }))} 
                    className="px-3 py-1 rounded-lg text-xs font-medium transition block"
                  >
                    Quitar imagen
                  </Button>
                )}
              </div>
            </div>

            {/* Campos de la variante */}
            <div className="space-y-3">
              <div>
                <label className="block font-medium text-texto mb-1">Nombre:</label>
                <input 
                  type="text" 
                  value={editingVariant.name} 
                  onChange={e => setEditingVariant(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border-b-2 border-borde bg-white rounded-t-md text-texto focus:border-acento focus:outline-none transition" 
                />
              </div>
              <div>
                <label className="block font-medium text-texto mb-1">Precio:</label>
                <input 
                  type="number" 
                  value={editingVariant.price} 
                  onChange={e => setEditingVariant(prev => ({ ...prev, price: parseFloat(e.target.value) }))}
                  className="w-full p-2 border-b-2 border-borde bg-white rounded-t-md text-texto focus:border-acento focus:outline-none transition" 
                />
              </div>
              <div>
                <label className="block font-medium text-texto mb-1">Descripción:</label>
                <textarea 
                  value={editingVariant.description || ''} 
                  onChange={e => setEditingVariant(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción individual (opcional)" 
                  rows="2" 
                  className="w-full p-2 border border-borde rounded-lg bg-white text-texto focus:border-acento focus:outline-none transition resize-none" 
                />
              </div>
            </div>

            {/* Botones del modal */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-borde-claro">
              <Button 
                variant="delete"
                onClick={() => deleteVariant(editingVariant.id)} 
                className="text-sm py-1"
                disabled={isServiceOpen}
              >
                Eliminar
              </Button>
              <Button 
                variant="cancel" 
                onClick={closeVariantModal} 
                className="text-sm py-1"
              >
                Cancelar
              </Button>
              <Button 
                variant="success" 
                onClick={saveVariant} 
                className="text-sm py-1"
              >
                Guardar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EditCategory;