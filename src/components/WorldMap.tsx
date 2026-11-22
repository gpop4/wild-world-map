import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ContinentView, WorldPlace } from '../types';

interface WorldMapProps {
  places: WorldPlace[];
  selectedPlace: WorldPlace | null;
  discoveredPlaceIds: Set<string>;
  continentTarget: ContinentView | null;
  resetSignal: number;
  onSelectPlace: (place: WorldPlace) => void;
}

export function WorldMap({
  places,
  selectedPlace,
  discoveredPlaceIds,
  continentTarget,
  resetSignal,
  onSelectPlace,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onSelectPlaceRef = useRef(onSelectPlace);

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 10,
      worldCopyJump: true,
      zoomControl: false,
      maxBounds: [
        [-85, -200],
        [85, 200],
      ],
      maxBoundsViscosity: 0.7,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // National Geographic World Map basemap (no API key required, rich geography & colors)
    const natGeoLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; National Geographic',
        maxZoom: 10,
        maxNativeZoom: 10,
      }
    );

    let switchedToFallback = false;
    natGeoLayer.on('tileerror', () => {
      if (switchedToFallback) return;
      switchedToFallback = true;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 10,
      }).addTo(map);
    });

    natGeoLayer.addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Render place markers & clickable highlight zones
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;

    group.clearLayers();

    places.forEach((place) => {
      const isSelected = selectedPlace?.id === place.id;
      const isDiscovered = discoveredPlaceIds.has(place.id);

      // Soft clickable region highlight circle
      const radiusMeters = (place.radiusKm ?? 250) * 1000;
      const circle = L.circle([place.lat, place.lng], {
        radius: radiusMeters,
        color: isSelected ? '#facc15' : place.color,
        weight: isSelected ? 3.5 : 1.5,
        opacity: isSelected ? 0.95 : 0.45,
        fillColor: place.color,
        fillOpacity: isSelected ? 0.28 : 0.12,
        className: 'place-zone-circle',
      });

      circle.on('click', () => {
        onSelectPlaceRef.current(place);
      });
      circle.addTo(group);

      // Playful custom pin marker
      const iconHtml = `
        <div class="map-pin ${isSelected ? 'map-pin--selected' : ''} ${
          isDiscovered ? 'map-pin--discovered' : ''
        }" style="--pin-color: ${place.color}">
          <span class="map-pin__emoji">${place.emoji}</span>
          <span class="map-pin__label">${place.name}</span>
          <span class="map-pin__count">${place.animals.length}</span>
          ${isDiscovered ? '<span class="map-pin__star" title="Visited!">⭐</span>' : ''}
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'map-pin-wrapper',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([place.lat, place.lng], {
        icon,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      marker.on('click', () => {
        onSelectPlaceRef.current(place);
      });

      marker.addTo(group);
    });
  }, [places, selectedPlace, discoveredPlaceIds]);

  // Smoothly fly to selected place
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace) return;

    // Slight longitude offset on wide screens so the pin stays nicely visible beside the side drawer
    const isWide = window.innerWidth >= 900;
    const lngOffset = isWide ? 8 / Math.pow(2, Math.max(selectedPlace.zoom - 3, 0)) : 0;

    map.flyTo([selectedPlace.lat, selectedPlace.lng + lngOffset], selectedPlace.zoom, {
      duration: 1.1,
      easeLinearity: 0.25,
    });
  }, [selectedPlace]);

  // Fly to continent when continent quick-jump button is tapped
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !continentTarget) return;

    map.flyTo([continentTarget.lat, continentTarget.lng], continentTarget.zoom, {
      duration: 1.0,
    });
  }, [continentTarget]);

  // Reset to full world view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetSignal === 0) return;

    map.flyTo([20, 10], 2, { duration: 0.9 });
  }, [resetSignal]);

  return <div ref={containerRef} className="world-map-canvas" aria-label="Interactive World Map" />;
}
