import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Animal, ContinentView, WorldPlace } from '../types';

interface WorldMapProps {
  selectedPlace: WorldPlace | null;
  clickedPoint: { lat: number; lng: number } | null;
  focusedAnimal?: { animal: Animal; place: WorldPlace } | null;
  continentTarget: ContinentView | null;
  resetSignal: number;
  onMapClick: (lat: number, lng: number) => void;
  onSelectPlace: (place: WorldPlace) => void;
}

export function WorldMap({
  selectedPlace,
  clickedPoint,
  focusedAnimal = null,
  continentTarget,
  resetSignal,
  onMapClick,
  onSelectPlace,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const onSelectPlaceRef = useRef(onSelectPlace);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onSelectPlaceRef.current = onSelectPlace;
  }, [onSelectPlace]);

  // Initialize clean, uncluttered Leaflet National Geographic World Map
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

    // Click anywhere on the clean world map to discover the closest wildlife!
    map.on('click', (e: L.LeafletMouseEvent) => {
      const wrapped = e.latlng.wrap();
      onMapClickRef.current(wrapped.lat, wrapped.lng);
    });

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 60);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Only show the active selection (zero clutter when nothing is selected!)
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;

    group.clearLayers();
    if (!selectedPlace) return;

    const radiusMeters = Math.max((selectedPlace.radiusKm ?? 250) * 1000, 220000);
    const circle = L.circle([selectedPlace.lat, selectedPlace.lng], {
      radius: radiusMeters,
      color: '#facc15',
      weight: 4,
      opacity: 0.96,
      fillColor: selectedPlace.color,
      fillOpacity: 0.28,
      className: 'place-zone-circle',
    });
    circle.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      onSelectPlaceRef.current(selectedPlace);
    });
    circle.addTo(group);

    // If user clicked a spot on the map, show a clean ripple dot where they clicked
    if (clickedPoint) {
      const clickedDot = L.circleMarker([clickedPoint.lat, clickedPoint.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 3,
        fillColor: '#ef4444',
        fillOpacity: 1,
      });
      clickedDot.addTo(group);

      const line = L.polyline(
        [
          [clickedPoint.lat, clickedPoint.lng],
          [selectedPlace.lat, selectedPlace.lng],
        ],
        {
          color: '#2563eb',
          weight: 2.5,
          dashArray: '6 6',
          opacity: 0.8,
        }
      );
      line.addTo(group);
    }

    const isFocusedAnimalPlace = focusedAnimal?.place.id === selectedPlace.id;
    const iconHtml =
      isFocusedAnimalPlace && focusedAnimal
        ? `
      <div class="map-pin map-pin--selected map-pin--animal-focus" style="--pin-color: ${selectedPlace.color}">
        <span class="map-pin__emoji">${focusedAnimal.animal.emoji}</span>
        <span class="map-pin__label">${focusedAnimal.animal.name} lives here! (${selectedPlace.name})</span>
      </div>
    `
        : `
      <div class="map-pin map-pin--selected" style="--pin-color: ${selectedPlace.color}">
        <span class="map-pin__emoji">${selectedPlace.emoji}</span>
        <span class="map-pin__label">${selectedPlace.name}</span>
        <span class="map-pin__count">${selectedPlace.animals.length}</span>
      </div>
    `;

    const icon = L.divIcon({
      html: iconHtml,
      className: 'map-pin-wrapper',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const marker = L.marker([selectedPlace.lat, selectedPlace.lng], {
      icon,
      zIndexOffset: 1000,
    });
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      onSelectPlaceRef.current(selectedPlace);
    });
    marker.addTo(group);
  }, [selectedPlace, clickedPoint, focusedAnimal]);

  // Smoothly fly to selected place
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace) return;

    const isWide = window.innerWidth >= 900;
    const targetZoom = Math.max(selectedPlace.zoom, 4);
    const lngOffset = isWide ? 8 / Math.pow(2, Math.max(targetZoom - 3, 0)) : 0;

    map.flyTo([selectedPlace.lat, selectedPlace.lng + lngOffset], targetZoom, {
      duration: 1.0,
      easeLinearity: 0.25,
    });
  }, [selectedPlace]);

  // Fly to continent when continent quick-jump button is tapped
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !continentTarget) return;

    map.flyTo([continentTarget.lat, continentTarget.lng], continentTarget.zoom, {
      duration: 0.9,
    });
  }, [continentTarget]);

  // Reset to full world view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetSignal === 0) return;

    map.flyTo([20, 10], 2, { duration: 0.85 });
  }, [resetSignal]);

  return (
    <div
      ref={containerRef}
      className="world-map-canvas world-map-canvas--clickable"
      aria-label="Interactive World Map — click anywhere to meet nearby animals"
    />
  );
}
