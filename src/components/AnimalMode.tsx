import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Shuffle,
  Volume2,
} from 'lucide-react';
import { Animal, WorldPlace } from '../types';

export interface AnimalEntry {
  animal: Animal;
  place: WorldPlace;
  animalIndexInPlace: number;
}

interface AnimalModeProps {
  entries: AnimalEntry[];
  activeIndex: number;
  searchQuery: string;
  discoveredAnimalIds: Set<string>;
  hasAnimalStudioVoice: (animalId: string) => boolean;
  onChangeActiveIndex: (index: number) => void;
  onSelectAnimal: (entry: AnimalEntry, indexInList: number) => void;
}

type GroupFilter = 'all' | 'Mammal' | 'Bird' | 'Reptile' | 'Marine' | 'Other';

const GROUP_FILTERS: Array<{ id: GroupFilter; label: string }> = [
  { id: 'all', label: '🐾 All Animals' },
  { id: 'Mammal', label: '🦁 Mammals' },
  { id: 'Bird', label: '🦅 Birds' },
  { id: 'Reptile', label: '🐢 Reptiles' },
  { id: 'Marine', label: '🐋 Ocean & Sea' },
  { id: 'Other', label: '🐸 Frogs & Bugs' },
];

export function AnimalMode({
  entries,
  activeIndex,
  searchQuery,
  discoveredAnimalIds,
  hasAnimalStudioVoice,
  onChangeActiveIndex,
  onSelectAnimal,
}: AnimalModeProps) {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [shuffleOrder, setShuffleOrder] = useState<number[] | null>(null);
  const touchStartX = useRef<number | null>(null);
  const filmstripRef = useRef<HTMLDivElement | null>(null);

  const orderedEntries = useMemo(() => {
    if (!shuffleOrder) return entries;
    return shuffleOrder.map((i) => entries[i]).filter(Boolean);
  }, [entries, shuffleOrder]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orderedEntries.filter(({ animal, place }) => {
      if (groupFilter === 'Other') {
        if (animal.group !== 'Amphibian' && animal.group !== 'Insect') return false;
      } else if (groupFilter !== 'all') {
        if (animal.group !== groupFilter) return false;
      }
      if (!q) return true;
      return (
        animal.name.toLowerCase().includes(q) ||
        animal.group.toLowerCase().includes(q) ||
        place.name.toLowerCase().includes(q)
      );
    });
  }, [orderedEntries, groupFilter, searchQuery]);

  const safeIndex =
    filteredEntries.length > 0
      ? ((activeIndex % filteredEntries.length) + filteredEntries.length) %
        filteredEntries.length
      : 0;

  const currentEntry = filteredEntries[safeIndex] ?? null;
  const prevEntry =
    filteredEntries.length > 1
      ? filteredEntries[(safeIndex - 1 + filteredEntries.length) % filteredEntries.length]
      : null;
  const nextEntry =
    filteredEntries.length > 1
      ? filteredEntries[(safeIndex + 1) % filteredEntries.length]
      : null;

  const goPrev = () => {
    if (filteredEntries.length <= 1) return;
    onChangeActiveIndex((safeIndex - 1 + filteredEntries.length) % filteredEntries.length);
  };

  const goNext = () => {
    if (filteredEntries.length <= 1) return;
    onChangeActiveIndex((safeIndex + 1) % filteredEntries.length);
  };

  const handleShuffle = () => {
    const indices = entries.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffleOrder(indices);
    onChangeActiveIndex(0);
  };

  // Keyboard navigation in Animal Mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowRight') {
        if (filteredEntries.length > 1) {
          onChangeActiveIndex((safeIndex + 1) % filteredEntries.length);
        }
      } else if (e.key === 'ArrowLeft') {
        if (filteredEntries.length > 1) {
          onChangeActiveIndex(
            (safeIndex - 1 + filteredEntries.length) % filteredEntries.length
          );
        }
      } else if (e.key === 'Enter' && currentEntry) {
        onSelectAnimal(currentEntry, safeIndex);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredEntries.length, safeIndex, currentEntry, onChangeActiveIndex, onSelectAnimal]);

  // Keep active card centered in the lower carousel strip
  useEffect(() => {
    const strip = filmstripRef.current;
    if (!strip) return;
    const activeEl = strip.querySelector<HTMLElement>('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [safeIndex, groupFilter]);

  return (
    <section className="animal-mode" aria-label="Animal Mode Carousel">
      {/* Group Filter Bar */}
      <div className="animal-mode__toolbar">
        <div className="animal-mode__filters" role="tablist" aria-label="Filter animals by type">
          {GROUP_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={groupFilter === f.id}
              className={`filter-chip ${groupFilter === f.id ? 'filter-chip--active' : ''}`}
              onClick={() => {
                setGroupFilter(f.id);
                onChangeActiveIndex(0);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="animal-mode__meta">
          <span className="animal-mode__count">
            {filteredEntries.length > 0
              ? `${safeIndex + 1} / ${filteredEntries.length} Animals`
              : '0 Animals'}
          </span>
          <button
            type="button"
            className="filter-chip filter-chip--shuffle"
            onClick={handleShuffle}
            title="Shuffle all 100 animals"
          >
            <Shuffle size={15} /> Shuffle
          </button>
        </div>
      </div>

      {filteredEntries.length === 0 || !currentEntry ? (
        <div className="animal-mode__empty">
          <span className="animal-mode__empty-emoji">🔍</span>
          <h2>No matching animals found</h2>
          <p>Try clearing the search box or switching to All Animals!</p>
        </div>
      ) : (
        <div className="animal-mode__content">
          {/* Spotlight Carousel Stage */}
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
            {/* Left Big Arrow */}
            {filteredEntries.length > 1 && (
              <button
                type="button"
                className="carousel-arrow carousel-arrow--left"
                onClick={goPrev}
                aria-label="Previous animal"
              >
                <ChevronLeft size={34} />
              </button>
            )}

            {/* Left Side Peek Card */}
            {prevEntry && (
              <button
                type="button"
                className="carousel-peek carousel-peek--left"
                onClick={goPrev}
                aria-label={`Previous: ${prevEntry.animal.name}`}
              >
                <img
                  src={`./images/animals/${prevEntry.animal.id}.jpg`}
                  alt={prevEntry.animal.name}
                  className="carousel-peek__img"
                />
                <div className="carousel-peek__name">
                  {prevEntry.animal.emoji} {prevEntry.animal.name}
                </div>
              </button>
            )}

            {/* Main Center Featured Animal Card */}
            <button
              type="button"
              className="carousel-hero-card"
              style={
                { '--animal-accent': currentEntry.animal.accentColor } as React.CSSProperties
              }
              onClick={() => onSelectAnimal(currentEntry, safeIndex)}
            >
              <div className="carousel-hero-card__photo-wrap">
                <img
                  src={`./images/animals/${currentEntry.animal.id}.jpg`}
                  alt={currentEntry.animal.name}
                  className="carousel-hero-card__photo"
                />

                <div className="carousel-hero-card__badges">
                  <span className="carousel-group-pill">{currentEntry.animal.group}</span>
                  {hasAnimalStudioVoice(currentEntry.animal.id) && (
                    <span className="carousel-ai-pill">✨ AI Voice</span>
                  )}
                  {discoveredAnimalIds.has(currentEntry.animal.id) && (
                    <span className="carousel-star-pill">⭐ Seen</span>
                  )}
                </div>
              </div>

              <div className="carousel-hero-card__footer">
                <div className="carousel-hero-card__title-row">
                  <span className="carousel-hero-card__emoji">
                    {currentEntry.animal.emoji}
                  </span>
                  <h2>{currentEntry.animal.name}</h2>
                </div>

                <span className="carousel-hero-card__cta">
                  <MapPin size={18} />
                  <span>Tap to see where it lives &amp; listen!</span>
                  <Volume2 size={18} />
                </span>
              </div>
            </button>

            {/* Right Side Peek Card */}
            {nextEntry && (
              <button
                type="button"
                className="carousel-peek carousel-peek--right"
                onClick={goNext}
                aria-label={`Next: ${nextEntry.animal.name}`}
              >
                <img
                  src={`./images/animals/${nextEntry.animal.id}.jpg`}
                  alt={nextEntry.animal.name}
                  className="carousel-peek__img"
                />
                <div className="carousel-peek__name">
                  {nextEntry.animal.emoji} {nextEntry.animal.name}
                </div>
              </button>
            )}

            {/* Right Big Arrow */}
            {filteredEntries.length > 1 && (
              <button
                type="button"
                className="carousel-arrow carousel-arrow--right"
                onClick={goNext}
                aria-label="Next animal"
              >
                <ChevronRight size={34} />
              </button>
            )}
          </div>

          {/* Horizontal Scrollable Picture Carousel Strip of All 100 Animals */}
          <div className="carousel-deck-wrap">
            <div className="carousel-deck-header">
              <span>🐾 Swipe or click any animal below to explore it on the world map:</span>
            </div>
            <div ref={filmstripRef} className="carousel-deck" role="list">
              {filteredEntries.map((entry, idx) => {
                const isActive = idx === safeIndex;
                const seen = discoveredAnimalIds.has(entry.animal.id);
                return (
                  <button
                    key={entry.animal.id}
                    type="button"
                    role="listitem"
                    data-active={isActive}
                    className={`deck-card ${isActive ? 'deck-card--active' : ''}`}
                    onClick={() => onSelectAnimal(entry, idx)}
                  >
                    <div className="deck-card__img-wrap">
                      <img
                        src={`./images/animals/${entry.animal.id}.jpg`}
                        alt={entry.animal.name}
                        className="deck-card__img"
                        loading="lazy"
                      />
                      {seen && <span className="deck-card__star">⭐</span>}
                    </div>
                    <span className="deck-card__name">{entry.animal.name}</span>
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
