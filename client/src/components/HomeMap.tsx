import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface HomeMapProps {
  center: { lat: number; lng: number };
  selectedPlace?: google.maps.places.PlaceResult | null;
  onCenterChange?: (center: { lat: number; lng: number }) => void;
}

export default function HomeMap({
  center,
  selectedPlace,
  onCenterChange,
}: HomeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [center.lng, center.lat],
      zoom: 13,
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on('moveend', () => {
      const c = map.getCenter();
      onCenterChange?.({ lat: c.lat, lng: c.lng });
    });
  }, [onCenterChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setCenter([center.lng, center.lat]);
  }, [center]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    const existing = (map as any)._pabandiMarkers as maplibregl.Marker[] | undefined;
    existing?.forEach((m) => m.remove());
    (map as any)._pabandiMarkers = [];

    if (selectedPlace?.geometry?.location) {
      const marker = new maplibregl.Marker({ color: '#14F195' })
        .setLngLat([selectedPlace.geometry.location.lng(), selectedPlace.geometry.location.lat()])
        .setPopup(
          new maplibregl.Popup().setHTML(
            `<strong>${selectedPlace.name || ''}</strong><br/>${
              selectedPlace.formatted_address || ''
            }`
          )
        )
        .addTo(map);
      (map as any)._pabandiMarkers = [marker];
    }
  }, [selectedPlace]);

  return (
    <div ref={containerRef} className="w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(6,182,212,0.15)]" />
  );
}
