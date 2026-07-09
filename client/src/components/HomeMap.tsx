import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function ErrorFallback() {
  const [failed, setFailed] = useState(false);
  const map = useMap();
  useEffect(() => {
    const onErr = () => setFailed(true);
    const tiles = map.getPane('tilePane')?.querySelectorAll('img') || [];
    tiles.forEach((img) => img.addEventListener('error', onErr));
    return () => tiles.forEach((img) => img.removeEventListener('error', onErr));
  }, [map]);
  if (!failed) return null;
  return null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export interface Place {
  lat: number;
  lng: number;
  name?: string;
  subtitle?: string;
}

interface HomeMapProps {
  center: { lat: number; lng: number };
  selectedPlace?: Place | null;
  userLocation?: { lat: number; lng: number } | null;
  places?: Place[];
  onPlaceSelect?: (place: Place) => void;
}

export default function HomeMap({ center, selectedPlace, userLocation, places = [], onPlaceSelect }: HomeMapProps) {
  const hasSelection = !!(selectedPlace?.lat && selectedPlace?.lng);

  return (
    <div className="w-full h-full relative rounded-3xl overflow-hidden bg-slate-900">
      <MapContainer center={[center.lat, center.lng]} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={false}>
        <MapUpdater center={[center.lat, center.lng]} />
        <ErrorFallback />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasSelection && selectedPlace && (
          <Marker position={[selectedPlace.lat, selectedPlace.lng]}>
            {selectedPlace.name && <Popup>{selectedPlace.name}</Popup>}
          </Marker>
        )}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={L.icon({
              iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
              iconSize: [24, 36],
              iconAnchor: [12, 36],
              popupAnchor: [0, -32],
            })}
          >
            <Popup>
              <div className="text-xs">
                <div className="font-bold">You are here</div>
                <div className="text-slate-500">Nearby recommendations appear around this point.</div>
              </div>
            </Popup>
          </Marker>
        )}
        {places.map((place, idx) => (
          <Marker
            key={`place-${idx}`}
            position={[place.lat, place.lng]}
            eventHandlers={{
              click() {
                onPlaceSelect?.(place);
              },
            }}
          >
            {place.name && (
              <Popup>
                <div className="text-xs">
                  <div className="font-bold">{place.name}</div>
                  {place.subtitle && <div className="text-slate-500">{place.subtitle}</div>}
                  <button
                    type="button"
                    onClick={() => {
                      onPlaceSelect?.(place);
                    }}
                    className="mt-2 w-full bg-emerald-600 text-white text-xs font-bold py-1.5 rounded-lg"
                  >
                    View
                  </button>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
      {hasSelection && selectedPlace && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 z-[1000] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Selected</p>
              <h3 className="text-base font-bold text-slate-900 leading-snug truncate">{selectedPlace.name}</h3>
              {selectedPlace.subtitle && <p className="text-sm text-slate-600 truncate">{selectedPlace.subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                onPlaceSelect?.(selectedPlace);
              }}
              aria-label="Center map"
              className="shrink-0 w-9 h-9 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">near_me</span>
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selectedPlace.lat},${selectedPlace.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-xs font-bold bg-slate-900 text-white py-2.5 rounded-xl hover:bg-slate-800"
            >
              Open in Google Maps
            </a>
            <a
              href={`https://www.openstreetmap.org/?mlat=${selectedPlace.lat}&mlon=${selectedPlace.lng}#map=16/${selectedPlace.lat}/${selectedPlace.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              OSM
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
