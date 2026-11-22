import { useEffect, useState } from 'react';

const wikiFallbackCache = new Map<string, string | null>();

export function useAnimalPhoto(animalId: string, wikiTitle: string) {
  const localUrl = `./images/animals/${animalId}.jpg`;
  const [src, setSrc] = useState<string | null>(localUrl);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);

  useEffect(() => {
    setSrc(`./images/animals/${animalId}.jpg`);
    setUsingFallback(false);
  }, [animalId]);

  const handleImageError = () => {
    if (usingFallback) {
      setSrc(null);
      return;
    }
    setUsingFallback(true);

    if (wikiFallbackCache.has(wikiTitle)) {
      setSrc(wikiFallbackCache.get(wikiTitle) ?? null);
      return;
    }

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${wikiTitle}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const imgUrl: string | null =
          data?.thumbnail?.source || data?.originalimage?.source || null;
        wikiFallbackCache.set(wikiTitle, imgUrl);
        setSrc(imgUrl);
      })
      .catch(() => {
        wikiFallbackCache.set(wikiTitle, null);
        setSrc(null);
      });
  };

  return { src, handleImageError };
}
