import { useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Square,
  Volume2,
  X,
  Sparkles,
  MapPin,
  Ruler,
  Utensils,
  Trees,
} from 'lucide-react';
import { Animal, WorldPlace } from '../types';
import { SpeechSegment } from '../hooks/useSpeech';
import { useWikiPhoto } from '../hooks/useWikiPhoto';

interface AnimalDrawerProps {
  place: WorldPlace;
  animalIndex: number;
  discoveredAnimalIds: Set<string>;
  autoRead: boolean;
  onToggleAutoRead: () => void;
  speech: {
    supported: boolean;
    rate: number;
    setRate: (rate: number) => void;
    isSpeaking: boolean;
    isPaused: boolean;
    activeSegmentId: string | null;
    speakQueue: (segments: SpeechSegment[]) => void;
    speakText: (text: string, segmentId?: string) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
  };
  onSelectAnimalIndex: (index: number) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<WorldPlace['category'], string> = {
  country: '🗺️ Country / Region',
  park: '🏞️ National Park / Wildland',
  desert: '🏜️ Desert',
  ocean: '🌊 Ocean / Sea',
};

const DIET_EMOJI: Record<Animal['diet'], string> = {
  Herbivore: '🌿 Plant Eater',
  Carnivore: '🥩 Meat Eater',
  Omnivore: '🍓 Plants & Meat',
};

const STATUS_CLASS: Record<Animal['status'], string> = {
  Thriving: 'status-thriving',
  'Near Threatened': 'status-near',
  Vulnerable: 'status-vulnerable',
  Endangered: 'status-endangered',
};

export function buildAnimalSpeechSegments(
  place: WorldPlace,
  animal: Animal,
  includePlaceIntro: boolean
): SpeechSegment[] {
  const segments: SpeechSegment[] = [];

  if (includePlaceIntro) {
    segments.push({
      id: 'place-intro',
      text: `Welcome to ${place.name}, in ${place.subtitle}! ${place.intro}`,
    });
  }

  segments.push({
    id: 'animal-header',
    text: `Meet the ${animal.name}! It is a ${animal.group.toLowerCase()} that lives in ${animal.habitat}. Size check: ${animal.sizeComparison}`,
  });

  segments.push({
    id: 'animal-sound',
    text: `Listen for its sound: ${animal.soundText}`,
  });

  animal.facts.forEach((fact, idx) => {
    segments.push({
      id: `fact-${idx}`,
      text: `Fun fact number ${idx + 1}: ${fact}`,
    });
  });

  return segments;
}

export function AnimalDrawer({
  place,
  animalIndex,
  discoveredAnimalIds,
  autoRead,
  onToggleAutoRead,
  speech,
  onSelectAnimalIndex,
  onClose,
}: AnimalDrawerProps) {
  const animal = place.animals[animalIndex] ?? place.animals[0];
  const { url: photoUrl, loading: photoLoading } = useWikiPhoto(animal.wikiTitle);

  const handlePrev = () => {
    const nextIdx = (animalIndex - 1 + place.animals.length) % place.animals.length;
    onSelectAnimalIndex(nextIdx);
  };

  const handleNext = () => {
    const nextIdx = (animalIndex + 1) % place.animals.length;
    onSelectAnimalIndex(nextIdx);
  };

  // Keyboard navigation (Left / Right arrows + Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowRight') {
        onSelectAnimalIndex((animalIndex + 1) % place.animals.length);
      } else if (e.key === 'ArrowLeft') {
        onSelectAnimalIndex(
          (animalIndex - 1 + place.animals.length) % place.animals.length
        );
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [animalIndex, place.animals.length, onSelectAnimalIndex, onClose]);

  const handleReadCurrentAnimal = () => {
    const segments = buildAnimalSpeechSegments(place, animal, false);
    speech.speakQueue(segments);
  };

  return (
    <aside className="animal-drawer" aria-label={`Animals of ${place.name}`}>
      {/* Place Header */}
      <div className="drawer-header" style={{ '--place-color': place.color } as React.CSSProperties}>
        <div className="drawer-header__top">
          <span className="place-category-pill">{CATEGORY_LABELS[place.category]}</span>
          <button
            type="button"
            className="icon-circle-btn"
            onClick={onClose}
            aria-label="Close animal explorer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="drawer-header__title-row">
          <span className="drawer-header__emoji">{place.emoji}</span>
          <div>
            <h2 className="drawer-header__title">{place.name}</h2>
            <p className="drawer-header__subtitle">
              <MapPin size={14} /> {place.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          className={`place-intro-box ${
            speech.activeSegmentId === 'place-intro' ? 'speaking-highlight' : ''
          }`}
          onClick={() => speech.speakText(`${place.name}. ${place.intro}`, 'place-intro')}
          title="Tap to hear about this place"
        >
          <p>{place.intro}</p>
          {speech.supported && (
            <span className="inline-speak-pill">
              <Volume2 size={14} /> Hear Place
            </span>
          )}
        </button>
      </div>

      {/* Animal Selector Strip */}
      <div className="animal-strip" role="tablist" aria-label="Animals in this area">
        {place.animals.map((a, idx) => {
          const active = idx === animalIndex;
          const seen = discoveredAnimalIds.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`animal-tab ${active ? 'animal-tab--active' : ''}`}
              onClick={() => onSelectAnimalIndex(idx)}
            >
              <span className="animal-tab__emoji">{a.emoji}</span>
              <span className="animal-tab__name">{a.name}</span>
              {seen && <span className="animal-tab__star">⭐</span>}
            </button>
          );
        })}
      </div>

      {/* Scrollable Animal Content */}
      <div className="drawer-body">
        {/* Read Aloud Control Bar */}
        {speech.supported && (
          <div className="speech-bar">
            <div className="speech-bar__buttons">
              {!speech.isSpeaking ? (
                <button
                  type="button"
                  className="btn-read-aloud"
                  onClick={handleReadCurrentAnimal}
                >
                  <Volume2 size={18} /> Read Aloud
                </button>
              ) : speech.isPaused ? (
                <button
                  type="button"
                  className="btn-read-aloud btn-read-aloud--active"
                  onClick={speech.resume}
                >
                  <Play size={18} /> Resume
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-read-aloud btn-read-aloud--active"
                  onClick={speech.pause}
                >
                  <Pause size={18} /> Pause
                </button>
              )}

              {speech.isSpeaking && (
                <button
                  type="button"
                  className="btn-stop-speech"
                  onClick={speech.stop}
                  aria-label="Stop reading"
                >
                  <Square size={15} /> Stop
                </button>
              )}
            </div>

            <div className="speech-bar__options">
              <button
                type="button"
                className={`speed-pill ${speech.rate <= 0.7 ? 'speed-pill--active' : ''}`}
                onClick={() => speech.setRate(0.65)}
                title="Extra slow story pace"
              >
                🐢
              </button>
              <button
                type="button"
                className={`speed-pill ${
                  speech.rate > 0.7 && speech.rate < 0.88 ? 'speed-pill--active' : ''
                }`}
                onClick={() => speech.setRate(0.78)}
                title="Gentle kid-friendly speed"
              >
                🦊
              </button>
              <button
                type="button"
                className={`speed-pill ${speech.rate >= 0.88 ? 'speed-pill--active' : ''}`}
                onClick={() => speech.setRate(0.92)}
                title="Regular speed"
              >
                🐆
              </button>

              <button
                type="button"
                className={`auto-read-mini ${autoRead ? 'auto-read-mini--on' : ''}`}
                onClick={onToggleAutoRead}
                title="Automatically read when clicking animals"
              >
                {autoRead ? 'Auto: ON' : 'Auto: OFF'}
              </button>
            </div>
          </div>
        )}

        {/* Animal Hero Card with Prev/Next */}
        <div
          className={`animal-hero ${
            speech.activeSegmentId === 'animal-header' ? 'speaking-highlight' : ''
          }`}
          style={{ '--animal-accent': animal.accentColor } as React.CSSProperties}
        >
          <div className="animal-hero__media">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={animal.name}
                className="animal-hero__img"
                loading="eager"
              />
            ) : (
              <div className="animal-hero__fallback">
                <span className="animal-hero__big-emoji">{animal.emoji}</span>
                {photoLoading && <span className="photo-loading-tag">Loading photo...</span>}
              </div>
            )}

            <span className="animal-hero__counter">
              {animalIndex + 1} / {place.animals.length}
            </span>

            {place.animals.length > 1 && (
              <>
                <button
                  type="button"
                  className="hero-nav-btn hero-nav-btn--prev"
                  onClick={handlePrev}
                  aria-label="Previous animal"
                >
                  <ChevronLeft size={26} />
                </button>
                <button
                  type="button"
                  className="hero-nav-btn hero-nav-btn--next"
                  onClick={handleNext}
                  aria-label="Next animal"
                >
                  <ChevronRight size={26} />
                </button>
              </>
            )}
          </div>

          <div className="animal-hero__info">
            <div className="animal-hero__name-row">
              <h3>
                <span className="animal-hero__emoji-inline">{animal.emoji}</span> {animal.name}
              </h3>
              <span className={`status-badge ${STATUS_CLASS[animal.status]}`}>
                {animal.status}
              </span>
            </div>

            <div className="quick-badges">
              <span className="quick-badge">
                <Sparkles size={13} /> {animal.group}
              </span>
              <span className="quick-badge">
                <Utensils size={13} /> {DIET_EMOJI[animal.diet]}
              </span>
            </div>
          </div>
        </div>

        {/* Sound Callout */}
        <button
          type="button"
          className={`sound-card ${
            speech.activeSegmentId === 'animal-sound' ? 'speaking-highlight' : ''
          }`}
          onClick={() => speech.speakText(animal.soundText, 'animal-sound')}
        >
          <span className="sound-card__icon">🎵</span>
          <div className="sound-card__text">
            <strong>Animal Sound</strong>
            <span>{animal.soundText}</span>
          </div>
          {speech.supported && <Volume2 size={18} className="sound-card__speaker" />}
        </button>

        {/* Habitat & Size Cards */}
        <div className="detail-grid">
          <div className="detail-card">
            <div className="detail-card__label">
              <Trees size={15} /> Where It Lives
            </div>
            <p>{animal.habitat}</p>
          </div>
          <div className="detail-card">
            <div className="detail-card__label">
              <Ruler size={15} /> How Big Is It?
            </div>
            <p>{animal.sizeComparison}</p>
          </div>
        </div>

        {/* Fun Facts List */}
        <div className="facts-section">
          <h4 className="facts-section__title">✨ Fun Facts! (Tap any fact to hear it)</h4>
          <ul className="facts-list">
            {animal.facts.map((fact, idx) => {
              const segId = `fact-${idx}`;
              const isReadingThis = speech.activeSegmentId === segId;
              return (
                <li key={idx}>
                  <button
                    type="button"
                    className={`fact-card ${isReadingThis ? 'speaking-highlight' : ''}`}
                    onClick={() => speech.speakText(fact, segId)}
                  >
                    <span className="fact-card__num">{idx + 1}</span>
                    <span className="fact-card__text">{fact}</span>
                    {speech.supported && (
                      <Volume2 size={16} className="fact-card__speaker" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Big Bottom Navigation for Little Fingers */}
        {place.animals.length > 1 && (
          <div className="drawer-footer-nav">
            <button type="button" className="big-nav-btn" onClick={handlePrev}>
              <ChevronLeft size={20} /> Previous Animal
            </button>
            <button
              type="button"
              className="big-nav-btn big-nav-btn--primary"
              onClick={handleNext}
            >
              Next Animal <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
