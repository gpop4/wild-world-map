import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Globe,
  Search,
  Shuffle,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { CONTINENTS } from './data/continents';
import { TOTAL_ANIMALS, WORLD_PLACES } from './data/places';
import { ContinentView, PlaceCategory, WorldPlace } from './types';
import { useSpeech } from './hooks/useSpeech';
import { WorldMap } from './components/WorldMap';
import { AnimalDrawer } from './components/AnimalDrawer';

type CategoryFilter = 'all' | PlaceCategory;

const STORAGE_ANIMALS_KEY = 'wild-world-map:discovered-animals:v1';
const STORAGE_PLACES_KEY = 'wild-world-map:discovered-places:v1';

function loadSavedSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

export function App() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedPlace, setSelectedPlace] = useState<WorldPlace | null>(null);
  const [animalIndex, setAnimalIndex] = useState<number>(0);
  const [continentTarget, setContinentTarget] = useState<ContinentView | null>(null);
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [autoRead, setAutoRead] = useState<boolean>(true);

  const [discoveredAnimals, setDiscoveredAnimals] = useState<Set<string>>(() =>
    loadSavedSet(STORAGE_ANIMALS_KEY)
  );
  const [discoveredPlaces, setDiscoveredPlaces] = useState<Set<string>>(() =>
    loadSavedSet(STORAGE_PLACES_KEY)
  );

  const speech = useSpeech();

  // Persist passport progress
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_ANIMALS_KEY,
        JSON.stringify(Array.from(discoveredAnimals))
      );
      localStorage.setItem(
        STORAGE_PLACES_KEY,
        JSON.stringify(Array.from(discoveredPlaces))
      );
    } catch {
      // ignore storage errors
    }
  }, [discoveredAnimals, discoveredPlaces]);

  const filteredPlaces = useMemo(() => {
    if (categoryFilter === 'all') return WORLD_PLACES;
    return WORLD_PLACES.filter((p) => p.category === categoryFilter);
  }, [categoryFilter]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results: Array<{
      key: string;
      emoji: string;
      title: string;
      subtitle: string;
      place: WorldPlace;
      animalIdx: number;
    }> = [];

    for (const place of WORLD_PLACES) {
      if (
        place.name.toLowerCase().includes(q) ||
        place.subtitle.toLowerCase().includes(q) ||
        place.category.toLowerCase().includes(q)
      ) {
        results.push({
          key: `place-${place.id}`,
          emoji: place.emoji,
          title: place.name,
          subtitle: `${place.subtitle} • ${place.animals.length} animals`,
          place,
          animalIdx: 0,
        });
      }

      place.animals.forEach((animal, idx) => {
        if (animal.name.toLowerCase().includes(q)) {
          results.push({
            key: `animal-${place.id}-${animal.id}`,
            emoji: animal.emoji,
            title: animal.name,
            subtitle: `Lives in ${place.name}`,
            place,
            animalIdx: idx,
          });
        }
      });
    }

    return results.slice(0, 10);
  }, [searchQuery]);

  const markDiscovered = useCallback((place: WorldPlace, animalIdx: number) => {
    setDiscoveredPlaces((prev) => {
      if (prev.has(place.id)) return prev;
      const next = new Set(prev);
      next.add(place.id);
      return next;
    });

    const animal = place.animals[animalIdx];
    if (animal) {
      setDiscoveredAnimals((prev) => {
        if (prev.has(animal.id)) return prev;
        const next = new Set(prev);
        next.add(animal.id);
        return next;
      });
    }
  }, []);

  const handleSelectPlace = useCallback(
    (place: WorldPlace, startAnimalIdx = 0) => {
      setSelectedPlace(place);
      setAnimalIndex(startAnimalIdx);
      setSearchOpen(false);
      setSearchQuery('');
      markDiscovered(place, startAnimalIdx);

      if (autoRead && speech.supported) {
        const animal = place.animals[startAnimalIdx] ?? place.animals[0];
        speech.playNarration(place, animal, true);
      } else {
        speech.stop();
      }
    },
    [autoRead, speech, markDiscovered]
  );

  const handleSelectAnimalIndex = useCallback(
    (nextIdx: number) => {
      if (!selectedPlace) return;
      setAnimalIndex(nextIdx);
      markDiscovered(selectedPlace, nextIdx);

      if (autoRead && speech.supported) {
        const animal = selectedPlace.animals[nextIdx];
        if (animal) {
          speech.playNarration(selectedPlace, animal, false);
        }
      } else {
        speech.stop();
      }
    },
    [selectedPlace, autoRead, speech, markDiscovered]
  );

  const handleCloseDrawer = useCallback(() => {
    speech.stop();
    setSelectedPlace(null);
  }, [speech]);

  const handleToggleAutoRead = useCallback(() => {
    setAutoRead((prev) => {
      const next = !prev;
      if (!next) {
        speech.stop();
      }
      return next;
    });
  }, [speech]);

  const handleSurpriseMe = useCallback(() => {
    const pool = filteredPlaces.length > 0 ? filteredPlaces : WORLD_PLACES;
    const otherPlaces =
      pool.length > 1 && selectedPlace
        ? pool.filter((p) => p.id !== selectedPlace.id)
        : pool;
    const randomPlace =
      otherPlaces[Math.floor(Math.random() * otherPlaces.length)];
    const randomAnimalIdx = Math.floor(
      Math.random() * randomPlace.animals.length
    );
    handleSelectPlace(randomPlace, randomAnimalIdx);
  }, [filteredPlaces, selectedPlace, handleSelectPlace]);

  const handleJumpContinent = useCallback((continent: ContinentView) => {
    setContinentTarget({ ...continent });
    setCategoryFilter('all');
  }, []);

  const handleResetWorld = useCallback(() => {
    speech.stop();
    setSelectedPlace(null);
    setContinentTarget(null);
    setCategoryFilter('all');
    setResetSignal((n) => n + 1);
  }, [speech]);

  return (
    <div className="app-shell">
      {/* Top Floating Header */}
      <header className="top-bar">
        <button
          type="button"
          className="brand-btn"
          onClick={handleResetWorld}
          title="Zoom back out to the whole world"
        >
          <span className="brand-btn__globe">🌍</span>
          <div className="brand-btn__text">
            <h1>Wild World Map</h1>
            <span>Click any place to meet its animals!</span>
          </div>
        </button>

        {/* Search Box */}
        <div className="search-wrap">
          <div className="search-input-box">
            <Search size={17} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search animal, desert, ocean, park..."
              aria-label="Search animals or places"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {searchOpen && searchQuery.trim().length > 0 && (
            <div className="search-dropdown">
              {searchResults.length === 0 ? (
                <div className="search-empty">
                  No matches yet—try "Tiger", "Sahara", "Ocean", or "Penguin"!
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="search-item"
                    onClick={() => handleSelectPlace(item.place, item.animalIdx)}
                  >
                    <span className="search-item__emoji">{item.emoji}</span>
                    <div className="search-item__text">
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="top-actions">
          {speech.supported && (
            <button
              type="button"
              className={`action-pill ${autoRead ? 'action-pill--read-on' : ''}`}
              onClick={handleToggleAutoRead}
              title="Toggle Read-Aloud Mode"
            >
              {autoRead ? <Volume2 size={18} /> : <VolumeX size={18} />}
              <span>Read Aloud: {autoRead ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <button
            type="button"
            className="action-pill action-pill--surprise"
            onClick={handleSurpriseMe}
            title="Fly to a surprise animal anywhere on Earth!"
          >
            <Shuffle size={17} />
            <span>Surprise Me!</span>
          </button>

          <div
            className="passport-badge"
            title={`You have discovered ${discoveredAnimals.size} out of ${TOTAL_ANIMALS} animals!`}
          >
            <span>🐾</span>
            <strong>
              {discoveredAnimals.size} / {TOTAL_ANIMALS}
            </strong>
          </div>
        </div>
      </header>

      {/* Category Filter Row */}
      <nav className="filter-bar" aria-label="Filter map places">
        {(
          [
            { id: 'all', label: '🌍 All Places' },
            { id: 'country', label: '🗺️ Countries & Regions' },
            { id: 'park', label: '🏞️ Parks & Jungles' },
            { id: 'desert', label: '🏜️ Deserts' },
            { id: 'ocean', label: '🌊 Oceans & Reefs' },
          ] as Array<{ id: CategoryFilter; label: string }>
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            className={`filter-chip ${
              categoryFilter === item.id ? 'filter-chip--active' : ''
            }`}
            onClick={() => setCategoryFilter(item.id)}
          >
            {item.label}
          </button>
        ))}

        <button
          type="button"
          className="filter-chip filter-chip--world"
          onClick={handleResetWorld}
        >
          <Globe size={15} /> World View
        </button>
      </nav>

      {/* Main Interactive Map */}
      <main className="map-stage">
        <WorldMap
          places={filteredPlaces}
          selectedPlace={selectedPlace}
          discoveredPlaceIds={discoveredPlaces}
          continentTarget={continentTarget}
          resetSignal={resetSignal}
          onSelectPlace={(p) => handleSelectPlace(p, 0)}
        />

        {/* Friendly Welcome Hint when nothing is open */}
        {!selectedPlace && (
          <div className="welcome-toast">
            <Compass size={18} />
            <span>
              Tap any glowing badge on the map to explore animals &amp; hear fun facts!
            </span>
          </div>
        )}

        {/* Animal Explorer Drawer */}
        {selectedPlace && (
          <AnimalDrawer
            place={selectedPlace}
            animalIndex={animalIndex}
            discoveredAnimalIds={discoveredAnimals}
            autoRead={autoRead}
            onToggleAutoRead={handleToggleAutoRead}
            speech={speech}
            onSelectAnimalIndex={handleSelectAnimalIndex}
            onClose={handleCloseDrawer}
          />
        )}
      </main>

      {/* Bottom Continent Quick-Jump Bar */}
      <footer className="continent-bar" aria-label="Jump to a continent">
        {CONTINENTS.map((cont) => (
          <button
            key={cont.id}
            type="button"
            className="continent-btn"
            style={{ '--cont-color': cont.color } as React.CSSProperties}
            onClick={() => handleJumpContinent(cont)}
          >
            <span>{cont.emoji}</span>
            <span>{cont.name}</span>
          </button>
        ))}
      </footer>
    </div>
  );
}

export default App;
