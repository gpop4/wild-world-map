import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  Flag,
  Globe,
  Map as MapIcon,
  Mountain,
  PawPrint,
  Search,
  Shuffle,
  Sun,
  Trees,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { CONTINENTS } from './data/continents';
import { TOTAL_ANIMALS, WORLD_PLACES } from './data/places';
import { ContinentView, WorldPlace } from './types';
import { useSpeech } from './hooks/useSpeech';
import { WorldMap } from './components/WorldMap';
import { AnimalDrawer } from './components/AnimalDrawer';
import { AnimalEntry, AnimalMode } from './components/AnimalMode';
import { PlaceMode } from './components/PlaceMode';

type AppMode = 'map' | 'animals' | 'parks' | 'deserts' | 'mountains' | 'countries';

const STORAGE_ANIMALS_KEY = 'wild-world-map:discovered-animals:v1';
const STORAGE_PLACES_KEY = 'wild-world-map:discovered-places:v1';

const MODE_META: Record<
  Exclude<AppMode, 'map' | 'animals'>,
  { label: string; emoji: string; category: WorldPlace['category'] }
> = {
  parks: { label: 'Parks & Jungles', emoji: '🏞️', category: 'park' },
  deserts: { label: 'Deserts', emoji: '🏜️', category: 'desert' },
  mountains: { label: 'Mountains', emoji: '🏔️', category: 'mountain' },
  countries: { label: 'Countries', emoji: '🏳️', category: 'country' },
};

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

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findClosestPlace(lat: number, lng: number, places: WorldPlace[]): {
  place: WorldPlace;
  distanceKm: number;
} {
  let best = places[0];
  let bestDist = Infinity;

  for (const place of places) {
    const dist = haversineKm(lat, lng, place.lat, place.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = place;
    }
  }
  return { place: best, distanceKm: bestDist };
}

export function App() {
  const [mode, setMode] = useState<AppMode>('map');
  const [inspectingOnMap, setInspectingOnMap] = useState<boolean>(false);
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({
    animals: 0,
    parks: 0,
    deserts: 0,
    mountains: 0,
    countries: 0,
  });

  const [selectedPlace, setSelectedPlace] = useState<WorldPlace | null>(null);
  const [clickedPoint, setClickedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [closestBannerText, setClosestBannerText] = useState<string | null>(null);
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

  // Build complete 200-animal library for Animal Mode
  const allAnimalEntries = useMemo<AnimalEntry[]>(() => {
    const list: AnimalEntry[] = [];
    const seen = new Set<string>();
    for (const place of WORLD_PLACES) {
      place.animals.forEach((animal, idx) => {
        if (!seen.has(animal.id)) {
          seen.add(animal.id);
          list.push({ animal, place, animalIndexInPlace: idx });
        }
      });
    }
    return list;
  }, []);

  const placesByMode = useMemo(
    () => ({
      parks: WORLD_PLACES.filter((p) => p.category === 'park'),
      deserts: WORLD_PLACES.filter((p) => p.category === 'desert'),
      mountains: WORLD_PLACES.filter((p) => p.category === 'mountain'),
      countries: WORLD_PLACES.filter((p) => p.category === 'country'),
    }),
    []
  );

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

    return results.slice(0, 12);
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

  const startPlaceTour = useCallback(
    (place: WorldPlace) => {
      if (!speech.supported) return;
      speech.playPlaceTour(place, (idx) => {
        setAnimalIndex(idx);
        markDiscovered(place, idx);
      });
    },
    [speech, markDiscovered]
  );

  const handleSelectPlace = useCallback(
    (
      place: WorldPlace,
      startAnimalIdx = 0,
      options?: {
        forceReadAnimalOnly?: boolean;
        runTour?: boolean;
        clickedLatLng?: { lat: number; lng: number } | null;
        bannerText?: string | null;
      }
    ) => {
      setSelectedPlace(place);
      setAnimalIndex(startAnimalIdx);
      setClickedPoint(options?.clickedLatLng ?? null);
      setClosestBannerText(options?.bannerText ?? null);
      setSearchOpen(false);
      setSearchQuery('');
      markDiscovered(place, startAnimalIdx);

      const animal = place.animals[startAnimalIdx] ?? place.animals[0];
      if (options?.runTour && speech.supported) {
        startPlaceTour(place);
      } else if (options?.forceReadAnimalOnly && speech.supported) {
        speech.playNarration(place, animal, false);
      } else if (autoRead && speech.supported) {
        speech.playNarration(place, animal, true);
      } else {
        speech.stop();
      }
    },
    [autoRead, speech, markDiscovered, startPlaceTour]
  );

  // Clicking ANYWHERE on the clean world map finds the closest wildlife!
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const { place } = findClosestPlace(lat, lng, WORLD_PLACES);
      handleSelectPlace(place, 0, {
        clickedLatLng: { lat, lng },
        bannerText: `📍 Closest wildlife to where you clicked`,
      });
    },
    [handleSelectPlace]
  );

  const handleSelectFromAnimalMode = useCallback(
    (entry: AnimalEntry, indexInList: number) => {
      setCarouselIndices((prev) => ({ ...prev, animals: indexInList }));
      setInspectingOnMap(true);
      handleSelectPlace(entry.place, entry.animalIndexInPlace, {
        forceReadAnimalOnly: true,
      });
    },
    [handleSelectPlace]
  );

  const handleSelectFromPlaceMode = useCallback(
    (place: WorldPlace, indexInList: number) => {
      setCarouselIndices((prev) => ({ ...prev, [mode]: indexInList }));
      setInspectingOnMap(true);
      handleSelectPlace(place, 0, { runTour: true });
    },
    [mode, handleSelectPlace]
  );

  const handleBackToCarousel = useCallback(() => {
    speech.stop();
    setSelectedPlace(null);
    setClickedPoint(null);
    setClosestBannerText(null);
    setInspectingOnMap(false);
  }, [speech]);

  const handleSwitchMode = useCallback(
    (nextMode: AppMode) => {
      if (nextMode === mode && !inspectingOnMap) return;
      speech.stop();
      setMode(nextMode);
      setInspectingOnMap(false);
      setSearchOpen(false);
      setSearchQuery('');
      setClickedPoint(null);
      setClosestBannerText(null);
      setSelectedPlace(null);
    },
    [mode, inspectingOnMap, speech]
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
    setClickedPoint(null);
    setClosestBannerText(null);
    if (mode !== 'map') {
      setInspectingOnMap(false);
    }
  }, [speech, mode]);

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
    if (mode === 'animals' && !inspectingOnMap) {
      const randomIdx = Math.floor(Math.random() * allAnimalEntries.length);
      handleSelectFromAnimalMode(allAnimalEntries[randomIdx], randomIdx);
      return;
    }

    if (mode !== 'map' && mode !== 'animals' && !inspectingOnMap) {
      const list = placesByMode[mode];
      const randomIdx = Math.floor(Math.random() * list.length);
      handleSelectFromPlaceMode(list[randomIdx], randomIdx);
      return;
    }

    const otherPlaces =
      WORLD_PLACES.length > 1 && selectedPlace
        ? WORLD_PLACES.filter((p) => p.id !== selectedPlace.id)
        : WORLD_PLACES;
    const randomPlace =
      otherPlaces[Math.floor(Math.random() * otherPlaces.length)];
    const randomAnimalIdx = Math.floor(
      Math.random() * randomPlace.animals.length
    );
    handleSelectPlace(randomPlace, randomAnimalIdx);
  }, [
    mode,
    inspectingOnMap,
    allAnimalEntries,
    placesByMode,
    handleSelectFromAnimalMode,
    handleSelectFromPlaceMode,
    selectedPlace,
    handleSelectPlace,
  ]);

  const handleJumpContinent = useCallback((continent: ContinentView) => {
    setContinentTarget({ ...continent });
  }, []);

  const handleResetWorld = useCallback(() => {
    speech.stop();
    setSelectedPlace(null);
    setClickedPoint(null);
    setClosestBannerText(null);
    setContinentTarget(null);
    setInspectingOnMap(false);
    setMode('map');
    setResetSignal((n) => n + 1);
  }, [speech]);

  const showingCarousel = mode !== 'map' && !inspectingOnMap;
  const activePlaceMode: Exclude<AppMode, 'map' | 'animals'> | null =
    showingCarousel && mode !== 'animals' ? mode : null;
  const focusedAnimal =
    mode === 'animals' && inspectingOnMap && selectedPlace
      ? {
          animal: selectedPlace.animals[animalIndex] ?? selectedPlace.animals[0],
          place: selectedPlace,
        }
      : null;

  const backLabel =
    mode === 'animals'
      ? 'Back to Animal Carousel'
      : mode !== 'map'
        ? `Back to ${MODE_META[mode].label}`
        : '';

  return (
    <div className="app-shell">
      {/* Top Floating Header */}
      <header className="top-bar">
        <button
          type="button"
          className="brand-btn"
          onClick={handleResetWorld}
          title="Back to Clean World Map"
        >
          <span className="brand-btn__globe">🌍</span>
          <div className="brand-btn__text">
            <h1>Wild World Map</h1>
            <span>
              {mode === 'map'
                ? 'Tap anywhere on Earth to meet nearby animals!'
                : `200 animals across 64 wild places`}
            </span>
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
              placeholder={
                showingCarousel
                  ? 'Filter this carousel...'
                  : 'Search any of 200 animals or 64 places...'
              }
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

          {!showingCarousel && searchOpen && searchQuery.trim().length > 0 && (
            <div className="search-dropdown">
              {searchResults.length === 0 ? (
                <div className="search-empty">
                  No matches yet—try "Capybara", "Meerkat", "Kilimanjaro", or "Sahara"!
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
            title="Discover a surprise place or animal!"
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

      {/* Explorer Mode Bar (6 Modes!) */}
      <nav className="mode-bar" aria-label="Explorer Modes">
        <button
          type="button"
          className={`mode-tab ${mode === 'map' ? 'mode-tab--active' : ''}`}
          onClick={() => handleSwitchMode('map')}
        >
          <MapIcon size={16} />
          <span>Map Mode</span>
        </button>

        <button
          type="button"
          className={`mode-tab ${mode === 'animals' ? 'mode-tab--active' : ''}`}
          onClick={() => handleSwitchMode('animals')}
        >
          <PawPrint size={16} />
          <span>Animals</span>
          <span className="mode-tab__count">{allAnimalEntries.length}</span>
        </button>

        <button
          type="button"
          className={`mode-tab ${mode === 'parks' ? 'mode-tab--active' : ''}`}
          onClick={() => handleSwitchMode('parks')}
        >
          <Trees size={16} />
          <span>Parks &amp; Jungles</span>
          <span className="mode-tab__count">{placesByMode.parks.length}</span>
        </button>

        <button
          type="button"
          className={`mode-tab ${mode === 'deserts' ? 'mode-tab--active' : ''}`}
          onClick={() => handleSwitchMode('deserts')}
        >
          <Sun size={16} />
          <span>Deserts</span>
          <span className="mode-tab__count">{placesByMode.deserts.length}</span>
        </button>

        <button
          type="button"
          className={`mode-tab ${mode === 'mountains' ? 'mode-tab--active' : ''}`}
          onClick={() => handleSwitchMode('mountains')}
        >
          <Mountain size={16} />
          <span>Mountains</span>
          <span className="mode-tab__count">{placesByMode.mountains.length}</span>
        </button>

        <button
          type="button"
          className={`mode-tab ${mode === 'countries' ? 'mode-tab--active' : ''}`}
          onClick={() => handleSwitchMode('countries')}
        >
          <Flag size={16} />
          <span>Countries</span>
          <span className="mode-tab__count">{placesByMode.countries.length}</span>
        </button>

        {mode === 'map' && (
          <button
            type="button"
            className="filter-chip filter-chip--world"
            onClick={handleResetWorld}
          >
            <Globe size={15} /> World View
          </button>
        )}
      </nav>

      {/* Main Content Area: Carousel OR Map View */}
      {showingCarousel && mode === 'animals' ? (
        <AnimalMode
          entries={allAnimalEntries}
          activeIndex={carouselIndices.animals ?? 0}
          searchQuery={searchQuery}
          discoveredAnimalIds={discoveredAnimals}
          hasAnimalStudioVoice={speech.hasAnimalStudioVoice}
          onChangeActiveIndex={(idx) =>
            setCarouselIndices((prev) => ({ ...prev, animals: idx }))
          }
          onSelectAnimal={handleSelectFromAnimalMode}
        />
      ) : activePlaceMode ? (
        <PlaceMode
          title={MODE_META[activePlaceMode].label}
          emoji={MODE_META[activePlaceMode].emoji}
          places={placesByMode[activePlaceMode]}
          activeIndex={carouselIndices[activePlaceMode] ?? 0}
          searchQuery={searchQuery}
          discoveredPlaceIds={discoveredPlaces}
          onChangeActiveIndex={(idx) =>
            setCarouselIndices((prev) => ({ ...prev, [activePlaceMode]: idx }))
          }
          onSelectPlace={handleSelectFromPlaceMode}
        />
      ) : (
        <>
          {/* Clean, Uncluttered Interactive World Map */}
          <main className="map-stage">
            <WorldMap
              selectedPlace={selectedPlace}
              clickedPoint={clickedPoint}
              focusedAnimal={focusedAnimal}
              continentTarget={continentTarget}
              resetSignal={resetSignal}
              onMapClick={handleMapClick}
              onSelectPlace={(p) => handleSelectPlace(p, 0)}
            />

            {/* Back to Carousel floating button when inspecting from any Carousel Mode */}
            {mode !== 'map' && inspectingOnMap && (
              <button
                type="button"
                className="back-carousel-btn"
                onClick={handleBackToCarousel}
              >
                <ArrowLeft size={18} />
                <span>{backLabel}</span>
              </button>
            )}

            {/* Friendly Welcome Hint on the clean Map Mode */}
            {!selectedPlace && mode === 'map' && (
              <div className="welcome-toast">
                <Compass size={18} />
                <span>
                  Tap anywhere on the world map to discover the animals living closest to that spot!
                </span>
              </div>
            )}

            {/* Animal Explorer Drawer */}
            {selectedPlace && (
              <AnimalDrawer
                place={selectedPlace}
                animalIndex={animalIndex}
                discoveredAnimalIds={discoveredAnimals}
                closestBannerText={closestBannerText}
                autoRead={autoRead}
                onToggleAutoRead={handleToggleAutoRead}
                speech={speech}
                onSelectAnimalIndex={handleSelectAnimalIndex}
                onStartPlaceTour={() => startPlaceTour(selectedPlace)}
                onClose={handleCloseDrawer}
              />
            )}
          </main>

          {/* Bottom Continent Quick-Jump Bar in Map Mode */}
          {mode === 'map' && (
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
          )}
        </>
      )}
    </div>
  );
}

export default App;
