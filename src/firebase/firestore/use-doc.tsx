'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  /** True quando o documento foi confirmado como inexistente/removido no servidor. */
  isMissing: boolean;
  /** True quando os dados vêm do cache local (offline / reconectando). */
  isStale: boolean;
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  // Initialize isLoading as true if we have a ref to avoid race conditions
  const [isLoading, setIsLoading] = useState<boolean>(!!memoizedDocRef);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [isMissing, setIsMissing] = useState<boolean>(false);
  const [isStale, setIsStale] = useState<boolean>(false);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      setIsMissing(false);
      setIsStale(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      // `includeMetadataChanges` deixa a UI reagir a idas/voltas do cache (reconexão).
      memoizedDocRef,
      { includeMetadataChanges: true },
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
          setIsMissing(false);
        } else {
          // Só tratamos como "removido" quando a confirmação vem do servidor.
          // Um snapshot vazio vindo apenas do cache não deve derrubar o jogador.
          if (!snapshot.metadata.fromCache) {
            setData(null);
            setIsMissing(true);
          }
        }
        setIsStale(snapshot.metadata.fromCache);
        setError(null);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        })

        // IMPORTANTE: mantemos o último estado conhecido (não zeramos `data`).
        // Erros transitórios de rede/permissão não devem chutar o jogador da
        // sala; o listener continua tentando reconectar sozinho.
        setError(contextualError)
        setIsStale(true)
        setIsLoading(false)

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef]);

  return { data, isLoading, error, isMissing, isStale };
}
