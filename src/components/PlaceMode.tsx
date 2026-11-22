import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Shuffle,
  Volume2,
} from 'lucide-react';
import { WorldPlace } from '../types';

interface PlaceModeProps {
  title: string;
  emoji: string;
  places: WorldPlace[];
  activeIndex: number;
  searchQuery: string;
  discoveredPlaceIds: Set<string>;
  onChangeActiveIndex: (index: number) => void;
  onSelectPlace: (place: WorldPlace, indexInList: number) => void;
}

export function PlaceMode({
  title,
  emoji,
  places,
  activeIndex,
  searchQuery,
  discoveredPlaceIds,
  onChangeActiveIndex,
  onSelectPlace,
}: PlaceModeProps) {
  const [shuffleOrder, setShuffleOrder] = useState<number[] | null>(null);
  const touchStartX = useRef<number | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);

  // Reset shuffle whenever switching between Parks/Deserts/Mountains/Countries
  useEffect(() => {
    setShuffleOrder(null);
  }, [title]);

  const orderedPlaces = useMemo(() => {
    if (!shuffleOrder) return places;
    return shuffleOrder.map((i) => places[i]).filter(Boolean);
  }, [places, shuffleOrder]);

  const filteredPlaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orderedPlaces;
    return orderedPlaces.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.animals.some((a) => a.name.toLowerCase().includes(q))
    );
  }, [orderedPlaces, searchQuery]);

  const safeIndex =
    filteredPlaces.length > 0
      ? ((activeIndex % filteredPlaces.length) + filteredPlaces.length) %
        filteredPlaces.length
      : 0;

  const currentPlace = filteredPlaces[safeIndex] ?? null;
  const prevPlace =
    filteredPlaces.length > 1
      ? filteredPlaces[(safeIndex - 1 + filteredPlaces.length) % filteredPlaces.length]
      : null;
  const nextPlace =
    filteredPlaces.length > 1
      ? filteredPlaces[(safeIndex + 1) % filteredPlaces.length]
      : null;

  const goPrev = () => {
    if (filteredPlaces.length <= 1) return;
    onChangeActiveIndex((safeIndex - 1 + filteredPlaces.length) % filteredPlaces.length);
  };

  const goNext = () => {
    if (filteredPlaces.length <= 1) return;
    onChangeActiveIndex((safeIndex + 1) % filteredPlaces.length);
  };

  const handleShuffle = () => {
    const indices = places.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffleOrder(indices);
    onChangeActiveIndex(0);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowRight') {
        if (filteredPlaces.length > 1) {
          onChangeActiveIndex((safeIndex + 1) % filteredPlaces.length);
        }
      } else if (e.key === 'ArrowLeft') {
        if (filteredPlaces.length > 1) {
          onChangeActiveIndex(
            (safeIndex - 1 + filteredPlaces.length) % filteredPlaces.length
          );
        }
      } else if (e.key === 'Enter' && currentPlace) {
        onSelectPlace(currentPlace, safeIndex);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredPlaces.length, safeIndex, currentPlace, onChangeActiveIndex, onSelectPlace]);

  useEffect(() => {
    const strip = filmstripRef.current;
    if (!strip) return;
    const activeEl = strip.querySelector<HTMLElement>('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [safeIndex, title]);

  return (
    <section className="animal-mode place-mode" aria-label={`${title} Carousel`}>
      <div className="animal-mode__toolbar">
        <div className="place-mode__heading">
          <span className="place-mode__heading-emoji">{emoji}</span>
          <h2>{title}</h2>
          <span className="place-mode__heading-hint">
            Tap any place to see it on the map &amp; meet the animals that live there!
          </span>
        </div>

        <div className="animal-mode__meta">
          <span className="animal-mode__count">
            {filteredPlaces.length > 0
              ? `${safeIndex + 1} / ${filteredPlaces.length} ${title}`
              : `0 ${title}`}
          </span>
          <button
            type="button"
            className="filter-chip filter-chip--shuffle"
            onClick={handleShuffle}
            title={`Shuffle ${title}`}
          >
            <Shuffle size={15} /> Shuffle
          </button>
        </div>
      </div>

      {filteredPlaces.length === 0 || !currentPlace ? (
        <div className="animal-mode__empty">
          <span className="animal-mode__empty-emoji">🔍</span>
          <h2>No matching {title.toLowerCase()} found</h2>
          <p>Try clearing the search box to browse all {places.length}!</p>
        </div>
      ) : (
        <div className="animal-mode__content">
          {/* Spotlight Carousel */}
          <div
            className="carousel-stage"
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
              const delta = endX - touchStartX.current;
              touchStartX.current = null;
              if (delta > 45) goPrev();
              else if (delta < -45) goNext();
            }}
          >
            {filteredPlaces.length > 1 && (
              <button
                type="button"
                className="carousel-arrow carousel-arrow--left"
                onClick={goPrev}
                aria-label={`Previous ${title}`}
              >
                <ChevronLeft size={34} />
              </button>
            )}

            {prevPlace && (
              <button
                type="button"
                className="carousel-peek carousel-peek--left"
                onClick={goPrev}
                aria-label={`Previous: ${prevPlace.name}`}
              >
                <img
                  src={`./images/animals/${prevPlace.animals[0].id}.jpg`}
                  alt={prevPlace.name}
                  className="carousel-peek__img"
                />
                <div className="carousel-peek__name">
                  {prevPlace.emoji} {prevPlace.name}
                </div>
              </button>
            )}

            {/* Center Place Card with Multi-Animal Photo Collage */}
            <button
              type="button"
              className="carousel-hero-card place-hero-card"
              style={{ '--animal-accent': currentPlace.color } as React.CSSProperties}
              onClick={() => onSelectPlace(currentPlace, safeIndex)}
            >
              <div className="place-collage">
                {currentPlace.animals.slice(0, 4).map((a) => (
                  <div key={a.id} className="place-collage__tile">
                    <img
                      src={`./images/animals/${a.id}.jpg`}
                      alt={a.name}
                      className="place-collage__img"
                    />
                    <span className="place-collage__label">
                      {a.emoji} {a.name}
                    </span>
                  </div>
                ))}

                <div className="carousel-hero-card__badges">
                  <span className="carousel-group-pill">
                    🐾 {currentPlace.animals.length} Animals
                  </span>
                  {discoveredPlaceIds.has(currentPlace.id) && (
                    <span className="carousel-star-pill">⭐ Visited</span>
                  )}
                </div>
              </div>

              <div className="carousel-hero-card__footer">
                <div className="carousel-hero-card__title-row">
                  <span className="carousel-hero-card__emoji">{currentPlace.emoji}</span>
                  <h2>{currentPlace.name}</h2>
                </div>
                <p className="place-hero-card__subtitle">
                  <MapPin size={14} /> {currentPlace.subtitle}
                </p>

                <span className="carousel-hero-card__cta">
                  <MapPin size={18} />
                  <span>Tap to see on map &amp; hear about its animals!</span>
                  <Volume2 size={18} />
                </span>
              </div>
            </button>

            {nextPlace && (
              <button
                type="button"
                className="carousel-peek carousel-peek--right"
                onClick={goNext}
                aria-label={`Next: ${nextPlace.name}`}
              >
                <img
                  src={`./images/animals/${nextPlace.animals[0].id}.jpg`}
                  alt={nextPlace.name}
                  className="carousel-peek__img"
                />
                <div className="carousel-peek__name">
                  {nextPlace.emoji} {nextPlace.name}
                </div>
              </button>
            )}

            {filteredPlaces.length > 1 && (
              <button
                type="button"
                className="carousel-arrow carousel-arrow--right"
                onClick={goNext}
                aria-label={`Next ${title}`}
              >
                <ChevronRight size={34} />
              </button>
            )}
          </div>

          {/* Lower Scrollable Deck of All Places in This Mode */}
          <div className="carousel-deck-wrap">
            <div className="carousel-deck-header">
              <span>
                {emoji} Click any place below to show it on the map and hear about its animals:
              </span>
            </div>
            <div ref={filmstripRef} className="carousel-deck" role="list">
              {filteredPlaces.map((place, idx) => {
                const isActive = idx === safeIndex;
                const seen = discoveredPlaceIds.has(place.id);
                return (
                  <button
                    key={place.id}
                    type="button"
                    role="listitem"
                    data-active={isActive}
                    className={`deck-card deck-card--place ${
                      isActive ? 'deck-card--active' : ''
                    }`}
                    onClick={() => onSelectPlace(place, idx)}
                  >
                    <div className="deck-card__img-wrap">
                      <img
                        src={`./images/animals/${place.animals[0].id}.jpg`}
                        alt={place.name}
                        className="deck-card__img"
                        loading="lazy"
                      />
                      <span className="deck-card__place-emoji">{place.emoji}</span>
                      {seen && <span className="deck-card__star">⭐</span>}
                    </div>
                    <span className="deck-card__name">{place.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
