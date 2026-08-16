'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

/**
 * Cria a instância do Firestore de forma resiliente para jogos ao vivo:
 * - `experimentalAutoDetectLongPolling`: detecta quando o streaming (WebChannel)
 *   é bloqueado por proxies/operadoras/redes corporativas e cai para long-polling,
 *   evitando que o jogador "congele" numa questão sem receber os updates do host.
 * - `persistentLocalCache`: mantém o último estado conhecido em cache (IndexedDB),
 *   dando resiliência offline e reconexão suave entre múltiplas abas.
 *
 * `initializeFirestore` só pode ser chamado uma vez por app; em recarregamentos
 * (HMR) ou segunda chamada, caímos para `getFirestore` já existente.
 */
function createResilientFirestore(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
}

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production because it's normal to use the firebaseConfig to initialize
      // during development
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

export function getSdks(firebaseApp: FirebaseApp) {
  const auth = getAuth(firebaseApp);

  // Garante que a sessão do host sobreviva a recarregamentos e trocas de aba,
  // evitando "deslogamentos" no meio do jogo por perda de sessão.
  if (typeof window !== 'undefined') {
    setPersistence(auth, browserLocalPersistence).catch(() => {
      /* ambientes sem storage (modo privado) — mantém persistência em memória */
    });
  }

  return {
    firebaseApp,
    auth,
    firestore: createResilientFirestore(firebaseApp),
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
