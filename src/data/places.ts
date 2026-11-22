import { WorldPlace } from '../types';
import { PLACES_AMERICAS } from './placesAmericas';
import { PLACES_EURASIA_AFRICA } from './placesEurasiaAfrica';
import { PLACES_OCEANIA_POLAR_OCEANS } from './placesOceaniaPolarOceans';

export const WORLD_PLACES: WorldPlace[] = [
  ...PLACES_AMERICAS,
  ...PLACES_EURASIA_AFRICA,
  ...PLACES_OCEANIA_POLAR_OCEANS,
];

export const TOTAL_ANIMALS = WORLD_PLACES.reduce(
  (sum, place) => sum + place.animals.length,
  0
);
