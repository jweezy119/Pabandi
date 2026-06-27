import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface HomeMapProps {
  center: { lat: number; lng: number };
  onCenterChange?: (center: { lat: number; lng: number }) => void;
}

type MarkerLike = { remove: () => void } | null;

export default function HomeMap({ center, onCenterChange }: HomeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<MarkerLike[]>([]);

  const clearMarkers = () => {
    markersRef.current.forEach((marker) => marker?.remove());
    markersRef.current = [];
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [center.lng, center.lat],
      zoom: 13,
    });

    mapRef.current = map;

    return () => {
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("moveend", () => {
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

    clearMarkers();

    return () => clearMarkers();
  }, [center]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(6,182,212,0.15)]"
    />
  );
}
