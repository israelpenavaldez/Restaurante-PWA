import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// Contexto de autenticación
const AuthContext = createContext();

/** Hook personalizado para acceder al contexto de autenticación. */
export const useAuth = () => useContext(AuthContext);

/**
 * Proveedor del contexto de autenticación.
 * Envuelve la aplicación y proporciona funciones de registro, inicio de sesión,
 * cierre de sesión, recuperación de contraseña y estado del servicio.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isServiceOpen, setIsServiceOpen] = useState(true);
  const unsubscribeUserRef = useRef(null);
  const unsubscribeServiceRef = useRef(null);

  // ===== AUTENTICACIÓN =====

  /**
   * Registra un nuevo usuario con email y contraseña.
   * Crea el documento en Firestore con role 'pending' y enabled false.
   * Cierra sesión automáticamente para no iniciar sesión tras el registro.
   *
   * @param {string} email - Correo electrónico del nuevo usuario.
   * @param {string} password - Contraseña (mínimo 6 caracteres).
   * @param {string} displayName - Nombre completo del usuario.
   * @returns {Promise<Object>} Usuario creado.
   * @throws {Error} Con mensaje descriptivo si ocurre un error.
   */
  const register = async (email, password, displayName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      await setDoc(doc(db, 'users', uid), {
        email,
        displayName,
        role: 'pending',
        enabled: false,
        createdAt: new Date().toISOString(),
      });
      await signOut(auth); // No iniciar sesión automáticamente
      return userCredential.user;
    } catch (error) {
      // Traducción de errores comunes de Firebase
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Este correo ya está registrado.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Correo electrónico no válido.');
      } else if (error.code === 'auth/password-does-not-meet-requirements') {
        throw new Error('La contraseña debe contener al menos una mayúscula, una minúscula y un carácter especial.');
      } else {
        throw error;
      }
    }
  };

  /**
   * Inicia sesión con email y contraseña.
   *
   * @param {string} email - Correo electrónico del usuario.
   * @param {string} password - Contraseña del usuario.
   * @returns {Promise<Object>} Credenciales del usuario.
   * @throws {Error} Con mensaje descriptivo si ocurre un error.
   */
  const login = async (email, password) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/invalid-credential') {
        throw new Error('Correo o contraseña incorrectos.');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('No existe una cuenta con este correo.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Contraseña incorrecta.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Correo electrónico no válido.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Demasiados intentos. Intenta de nuevo más tarde.');
      } else {
        throw error;
      }
    }
  };

  /**
   * Cierra la sesión del usuario actual.
   * Limpia la suscripción a Firestore y los datos en caché.
   */
  const logout = async () => {
    if (unsubscribeUserRef.current) {
      unsubscribeUserRef.current();
      unsubscribeUserRef.current = null;
    }
    await signOut(auth);
    sessionStorage.removeItem('cachedUserData');
  };

  /**
   * Envía un correo de recuperación de contraseña.
   *
   * @param {string} email - Correo electrónico del usuario.
   */
  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  // ===== OBSERVADORES DE ESTADO =====

  /**
   * Escucha cambios en la autenticación del usuario.
   * Cuando el usuario cambia, se suscribe a su documento en Firestore
   * para obtener sus datos en tiempo real.
   */
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      // Limpiar suscripción anterior
      if (unsubscribeUserRef.current) {
        unsubscribeUserRef.current();
        unsubscribeUserRef.current = null;
      }

      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            // Guardar en caché para uso offline
            try {
              sessionStorage.setItem('cachedUserData', JSON.stringify(data));
            } catch (e) {
              /* ignorar errores de storage */
            }
          } else {
            setUserData(null);
            sessionStorage.removeItem('cachedUserData');
          }
        });
        unsubscribeUserRef.current = unsubscribeSnapshot;
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserRef.current) unsubscribeUserRef.current();
    };
  }, []);

  /**
   * Se suscribe al documento de configuración global del servicio
   * para saber si el restaurante está abierto o cerrado.
   */
  useEffect(() => {
    const configRef = doc(db, 'config', 'settings');
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        setIsServiceOpen(docSnap.data().isServiceOpen ?? true);
      } else {
        setIsServiceOpen(true);
      }
    });
    unsubscribeServiceRef.current = unsubscribe;
    return () => unsubscribe();
  }, []);

  // ===== VALOR DEL CONTEXTO =====

  const value = {
    user,
    userData,
    loading,
    register,
    login,
    logout,
    resetPassword,
    isServiceOpen,
    setIsServiceOpen,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};