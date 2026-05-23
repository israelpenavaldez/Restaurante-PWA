import Button from './Button';

export default function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-texto/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-tarjeta rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-borde-claro">
        <p className="text-texto text-lg mb-6 text-center">{message}</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={onConfirm}>Confirmar</Button>
        </div>
      </div>
    </div>
  );
}