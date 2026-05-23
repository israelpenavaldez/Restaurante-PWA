export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-tarjeta rounded-2xl shadow-md border border-borde-claro/20 p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}