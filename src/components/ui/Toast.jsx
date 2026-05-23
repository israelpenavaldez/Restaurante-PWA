const typeStyles = {
  success: 'bg-aviso-exito-fondo text-aviso-exito-texto',
  error: 'bg-aviso-error-fondo text-aviso-error-texto',
  warning: 'bg-aviso-alerta-fondo text-aviso-alerta-texto',
};

export default function Toast({ message, type = 'success' }) {
  return (
    <div className={`px-5 py-3 rounded-2xl shadow-lg font-body text-sm flex items-center gap-2 animate-slide-in ${typeStyles[type] || typeStyles.success}`}>
      <span>{message}</span>
    </div>
  );
}