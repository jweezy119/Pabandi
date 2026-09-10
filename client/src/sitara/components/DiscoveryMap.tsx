// Sitara OS — discovery map (Leaflet + free OpenStreetMap tiles)
// Same results as the list, as pins. CircleMarkers = no icon-asset hassle,
// amber for top-rated (stars = exposure, even on the map).
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPin {
  id: string;
  source: string;
  name: string;
  rating: number;
  stars: number;
  price: string;
  lat?: number;
  lng?: number;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 13));
  }, [lat, lng, map]);
  return null;
}

export default function DiscoveryMap({
  pins,
  center,
}: {
  pins: MapPin[];
  center: { lat: number; lng: number };
}) {
  const located = pins.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
  const topCutoff = [...located].sort((a, b) => b.rating - a.rating)[0]?.rating ?? 5;

  return (
    <div className="tile overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '420px', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={center.lat} lng={center.lng} />
        {located.map((p) => {
          const isTop = p.rating >= topCutoff && p.rating >= 4.5;
          return (
            <CircleMarker
              key={`${p.source}:${p.id}`}
              center={[p.lat!, p.lng!]}
              radius={isTop ? 12 : 8}
              pathOptions={{
                color: isTop ? '#f59e0b' : '#0f172a',
                weight: 2,
                fillColor: isTop ? '#f59e0b' : '#f59e0b',
                fillOpacity: isTop ? 0.9 : 0.55,
              }}
            >
              <Popup>
                <div className="min-w-[160px]">
                  <p className="font-bold text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-600">
                    <span className="text-amber-500">★</span> {p.rating.toFixed(1)} · {p.stars} reviews · {p.price}
                  </p>
                  <Link
                    to={`/sitara/place/${p.source}/${encodeURIComponent(p.id)}`}
                    className="inline-block mt-1.5 text-sm font-semibold text-amber-600"
                  >
                    View place →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <p className="px-3 py-2 text-xs text-slate-500 bg-white">
        {located.length} of {pins.length} places pinned · <span className="text-amber-600 font-medium">● gold = top rated</span> · map © OpenStreetMap
      </p>
    </div>
  );
}
