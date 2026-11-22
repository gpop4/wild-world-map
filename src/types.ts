export type PlaceCategory = 'country' | 'park' | 'desert' | 'mountain' | 'ocean';

export type ContinentId =
  | 'north-america'
  | 'south-america'
  | 'europe'
  | 'africa'
  | 'asia'
  | 'oceania'
  | 'antarctica'
  | 'oceans';

export interface Animal {
  id: string;
  name: string;
  emoji: string;
  wikiTitle: string;
  group: 'Mammal' | 'Bird' | 'Reptile' | 'Marine' | 'Amphibian' | 'Insect';
  diet: 'Herbivore' | 'Carnivore' | 'Omnivore';
  habitat: string;
  sizeComparison: string;
  soundText: string;
  status: 'Thriving' | 'Vulnerable' | 'Endangered' | 'Near Threatened';
  accentColor: string;
  facts: string[];
}

export interface WorldPlace {
  id: string;
  name: string;
  subtitle: string;
  category: PlaceCategory;
  continent: ContinentId;
  lat: number;
  lng: number;
  zoom: number;
  emoji: string;
  color: string;
  radiusKm?: number;
  intro: string;
  animals: Animal[];
}

export interface ContinentView {
  id: ContinentId;
  name: string;
  emoji: string;
  lat: number;
  lng: number;
  zoom: number;
  color: string;
}
