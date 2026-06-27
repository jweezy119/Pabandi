import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface BusinessMapProps {
  latitude?: number;
  longitude?: number;
  name?: string;
  zoom?: number;
}

export default function BusinessMap({ latitude = 0, longitude = 0, name, zoom = 15 }: BusinessMapProps) {
  const hasCoords = latitude !== 0 && longitude !== 0;

  if (!hasCoords) {
    return (
      <div className="w-full h-full relative rounded-xl overflow-hidden bg-surface-container-low flex items-center justify-center">
        <p className="text-on-surface-variant font-body">Location unavailable</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden">
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        style={{ width: '100%', height: '100%', borderRadius: '0.75rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]}>
          {name && <Popup>{name}</Popup>}
        </Marker>
      </MapContainer>

      <a
        href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-white text-gray-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-full shadow-md hover:bg-gray-50 transition-colors z-[1000]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        Open in Maps
      </a>
    </div>
  );
}
