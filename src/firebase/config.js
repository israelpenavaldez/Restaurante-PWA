import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

/**
 * Configuración de Firebase.
 * Las credenciales se obtienen desde variables de entorno definidas en el archivo .env
 * utilizando el prefijo VITE_ requerido por Vite para exponerlas al cliente.
 *
 * @see https://vitejs.dev/guide/env-and-mode.html
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/**
 * Inicializa la aplicación de Firebase con la configuración proporcionada.
 * Esta instancia es compartida por todos los servicios de Firebase.
 */
const app = initializeApp(firebaseConfig);

/** Servicio de autenticación de Firebase. */
export const auth = getAuth(app);

/** Servicio de base de datos Firestore. */
export const db = getFirestore(app);

/** Servicio de almacenamiento de archivos (Cloud Storage). */
export const storage = getStorage(app);