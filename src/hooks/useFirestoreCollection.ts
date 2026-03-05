"use client";

import { useEffect, useState } from "react";
import {
  query,
  onSnapshot,
  QueryConstraint,
  DocumentData,
} from "firebase/firestore";
import { safeCollection } from "@/lib/firebase";

interface UseFirestoreCollectionOptions {
  collectionPath: string;
  constraints?: QueryConstraint[];
  enabled?: boolean;
}

export function useFirestoreCollection<T extends DocumentData>({
  collectionPath,
  constraints = [],
  enabled = true,
}: UseFirestoreCollectionOptions) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const collRef = safeCollection(collectionPath);
    const q = constraints.length > 0
      ? query(collRef, ...constraints)
      : query(collRef);

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as (T & { id: string })[];
        setData(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, enabled]);

  return { data, loading, error };
}
