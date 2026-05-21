/**
 * Botón con variantes temáticas
 * @param {string} variant - 'primary' | 'secondary' | 'success' | 'warning'
 */
const variants = {
  primary: 'bg-chile-guajillo hover:bg-red-700 text-white',
  secondary: 'bg-barro-claro hover:bg-brown-300 text-chocolate-oscuro',
  success: 'bg-verde-nopal hover:bg-green-700 text-white',
  warning: 'bg-maiz-dorado hover:bg-yellow-600 text-chocolate-oscuro',
};

export default function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}) {
  return (
    <button
      className={`px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}