import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper component to change map center
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

interface HomeMapProps {
  center: { lat: number; lng: number };
  onCenterChanged?: (center: { lat: number; lng: number }) => void;
  selectedPlace?: {
    lat: number;
    lng: number;
    name?: string;
  } | null;
}

export default function HomeMap({ center, selectedPlace }: HomeMapProps) {
  return (
    <div className="w-full h-full relative rounded-3xl overflow-hidden">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
      >
        <MapUpdater center={[center.lat, center.lng]} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {selectedPlace && (
          <Marker position={[selectedPlace.lat, selectedPlace.lng]}>
            {selectedPlace.name && <Popup>{selectedPlace.name}</Popup>}
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
