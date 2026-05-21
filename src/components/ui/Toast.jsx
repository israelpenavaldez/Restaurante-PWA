const typeStyles = {
  success: 'bg-verde-nopal text-white',
  error: 'bg-chile-guajillo text-white',
  warning: 'bg-maiz-dorado text-chocolate-oscuro',
};

export default function Toast({ message, type = 'success' }) {
  return (
    <div className={`px-5 py-3 rounded-2xl shadow-lg font-body text-sm flex items-center gap-2 animate-slide-in ${typeStyles[type] || typeStyles.success}`}>
      <span>{message}</span>
    </div>
  );
}