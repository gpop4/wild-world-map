import { useEffect, useState } from 'react';

const photoCache = new Map<string, string | null>();

export function useWikiPhoto(wikiTitle: string) {
  const [url, setUrl] = useState<string | null>(() =>
    photoCache.has(wikiTitle) ? photoCache.get(wikiTitle) ?? null : null
  );
  const [loading, setLoading] = useState<boolean>(() => !photoCache.has(wikiTitle));

  useEffect(() => {
    if (photoCache.has(wikiTitle)) {
      setUrl(photoCache.get(wikiTitle) ?? null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setUrl(null);

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const imgUrl: string | null =
          data?.thumbnail?.source || data?.originalimage?.source || null;
        photoCache.set(wikiTitle, imgUrl);
        setUrl(imgUrl);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        photoCache.set(wikiTitle, null);
        setUrl(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [wikiTitle]);

  return { url, loading };
}
