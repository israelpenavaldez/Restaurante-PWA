import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Punto de entrada principal de la aplicación.
 *
 * Monta el componente raíz <App /> dentro del elemento con id "root"
 * definido en el archivo index.html. Se utiliza StrictMode para
 * detectar problemas potenciales durante el desarrollo.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);