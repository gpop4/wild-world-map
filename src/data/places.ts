import { WorldPlace } from '../types';
import { PLACES_AMERICAS } from './placesAmericas';
import { PLACES_EURASIA_AFRICA } from './placesEurasiaAfrica';
import { PLACES_OCEANIA_POLAR_OCEANS } from './placesOceaniaPolarOceans';
import { PLACES_EXPANSION_1 } from './placesExpansion1';
import { PLACES_EXPANSION_2 } from './placesExpansion2';

export const WORLD_PLACES: WorldPlace[] = [
  ...PLACES_AMERICAS,
  ...PLACES_EURASIA_AFRICA,
  ...PLACES_OCEANIA_POLAR_OCEANS,
  ...PLACES_EXPANSION_1,
  ...PLACES_EXPANSION_2,
];

export const TOTAL_ANIMALS = WORLD_PLACES.reduce(
  (sum, place) => sum + place.animals.length,
  0
);
