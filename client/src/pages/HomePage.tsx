import { useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useQuery } from "react-query";
import { businessService } from "../services/api";
import {
  MapPinIcon,
  BuildingStorefrontIcon,
} from "@heroicons/react/24/outline";
import HomeMap from "../components/HomeMap";

// Haversine distance calculation (in km)
const getDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const INITIAL_CENTER = { lat: 24.8607, lng: 67.0011 };

export default function HomePage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState("ALL");
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locLoading, setLocLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState(INITIAL_CENTER);
  const [selectedMapPlace, setSelectedMapPlace] = useState<{
    name: string;
    address?: string;
    lat: number;
    lng: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const revealRef1 = useScrollReveal<HTMLDivElement>();
  const revealRef2 = useScrollReveal<HTMLDivElement>();
  const revealRef3 = useScrollReveal<HTMLDivElement>();
  const revealRef4 = useScrollReveal<HTMLDivElement>();

  const { data, isLoading } = useQuery(
    ["businesses", category, userLoc],
    async () => {
      const params: any = {
        category: category !== "ALL" ? category : undefined,
      };
      if (userLoc) {
        params.latitude = userLoc.lat;
        params.longitude = userLoc.lng;
      }
      if (search.trim().length) {
        params.search = search.trim();
      }
      const res = await businessService.getPublicBusinesses(params);
      return res.data?.data?.businesses || [];
    },
    { keepPreviousData: true },
  );

  let businesses = data || [];

  if (userLoc) {
    businesses = [...businesses].sort((a, b) => {
      const distA = getDistance(
        userLoc.lat,
        userLoc.lng,
        a.latitude || INITIAL_CENTER.lat,
        a.longitude || INITIAL_CENTER.lng,
      );
      const distB = getDistance(
        userLoc.lat,
        userLoc.lng,
        b.latitude || INITIAL_CENTER.lat,
        b.longitude || INITIAL_CENTER.lng,
      );
      return distA - distB;
    });
  }

  const handleGetLocation = () => {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      (err) => {
        console.error("Location access denied or failed", err);
        setLocLoading(false);
      },
    );
  };

  const geocodeAddress = useCallback(async (query: string) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
      );
      const json = await res.json();
      if (json[0]) {
        const lat = parseFloat(json[0].lat);
        const lng = parseFloat(json[0].lon);
        const name = json[0].display_name.split(",")[0];
        return { lat, lng, name, address: json[0].display_name };
      }
    } catch (e) {
      console.error("Geocode failed", e);
    }
    return null;
  }, []);

  const handleSearch = useCallback(async () => {
    const q = search.trim();
    if (!q) return;
    setSearchLoading(true);
    setSelectedMapPlace(null);
    const hit = await geocodeAddress(q);
    if (hit) {
      setMapCenter({ lat: hit.lat, lng: hit.lng });
      setSelectedMapPlace({
        name: hit.name || q,
        address: hit.address,
        lat: hit.lat,
        lng: hit.lng,
      });
    } else {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    }
    setSearchLoading(false);
  }, [search, geocodeAddress, navigate]);

  const handlePlaceSelect = useCallback(
    (place: { name: string; address?: string; lat: number; lng: number }) => {
      setMapCenter({ lat: place.lat, lng: place.lng });
      setSelectedMapPlace(place);
    },
    [],
  );

  const handleBookPlace = useCallback(
    (place: { name: string; address?: string; lat: number; lng: number }) => {
      navigate("/reservations/new", {
        state: {
          placeName: place.name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
        },
      });
    },
    [navigate],
  );

  const categories = [
    "ALL",
    "ECOMMERCE",
    "MARKETPLACE",
    "LIVE_SELLER",
    "RESTAURANT",
    "SPA",
    "CLINIC",
    "HOSPITAL",
    "FITNESS_CENTER",
    "SALON",
    "FREELANCE",
  ];
  const getCategoryLabel = (c: string) => {
    if (c === "ALL") return "All Categories";
    if (c === "ECOMMERCE") return "E-Commerce";
    if (c === "MARKETPLACE") return "Marketplace";
    if (c === "LIVE_SELLER") return "Live Seller";
    if (c === "RESTAURANT") return "Fine Dining";
    if (c === "FITNESS_CENTER") return "Fitness";
    return c.charAt(0) + c.slice(1).toLowerCase();
  };

  return (
    <div className="w-full pb-28 md:pb-10 font-body">
      {/* IMMERSIVE HERO WITH MAP */}
      <section className="relative w-full bg-[#0f172a] text-white py-16 md:py-24 border-b border-slate-800">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#14F195] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#06b6d4] rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-blob animation-delay-2000" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col xl:flex-row gap-12">
          {/* Left Col - Copy */}
          <div className="flex-1 space-y-8 max-w-2xl mx-auto xl:mx-0 pt-8">
            <h1 className="font-headline text-5xl md:text-7xl font-black tracking-tight leading-[1.1] stagger-item">
              Your Reliability <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#14F195] to-[#06b6d4]">
                Finally Pays.
              </span>
            </h1>
            <p className="font-body text-xl text-slate-300 leading-relaxed max-w-xl stagger-item">
              Launching first in Pakistan’s informal economy — salons, clinics,
              and live sellers — with a reliability layer built to scale
              globally. Earn{" "}
              <span className="font-bold text-pink-400">$PAB</span> rewards for
              every appointment you honor.
            </p>

            {/* Search */}
            <div className="pt-4 relative z-50 stagger-item">
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">
                Find & Book Anywhere
              </p>
              <div className="bg-surface-container-low rounded-lg flex items-center px-4 py-3 shadow-sm w-full border border-outline-variant/20">
                <BuildingStorefrontIcon className="h-5 w-5 text-outline mr-3" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                  type="text"
                  placeholder="Search a city, venue or address..."
                  className="bg-transparent border-none focus:ring-0 w-full font-body text-sm text-on-surface placeholder-outline font-medium focus:outline-none"
                />
                <button
                  onClick={handleSearch}
                  disabled={searchLoading}
                  className="ml-2 px-3 py-1.5 rounded-md bg-primary text-on-primary text-xs font-bold"
                >
                  {searchLoading ? "..." : "Search"}
                </button>
              </div>

              <div className="mt-3 flex gap-2 flex-wrap">
                <button
                  onClick={handleGetLocation}
                  disabled={locLoading}
                  className="flex items-center gap-1.5 text-xs font-bold bg-surface-container border border-outline-variant/10 rounded-full px-3 py-1.5 hover:bg-surface-container-high"
                >
                  <MapPinIcon className="h-3.5 w-3.5" />{" "}
                  {locLoading ? "Locating..." : "Near Me"}
                </button>
                {["Karachi", "Lahore", "Islamabad"].map((city) => (
                  <button
                    key={city}
                    onClick={() =>
                      handlePlaceSelect({
                        name: city,
                        lat: 24.8607,
                        lng: 67.0011,
                      })
                    }
                    className="text-xs font-bold bg-surface-container border border-outline-variant/10 rounded-full px-3 py-1.5 hover:bg-surface-container-high"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-6 text-sm font-bold text-slate-400 uppercase tracking-widest stagger-item">
              <span className="flex items-center gap-1">
                <span className="text-[#14F195]">✓</span> Global
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[#14F195]">✓</span> AI Protected
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[#14F195]">✓</span> Earn $PAB
              </span>
              <Link to="/pricing" className="ml-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors">
                View Plans →
              </Link>
            </div>
          </div>

          {/* Right Col - The Interactive Map */}
          <div
            className="flex-1 relative w-full h-[500px] xl:h-[600px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(6,182,212,0.15)] stagger-item"
            style={{ animationDelay: "240ms" }}
          >
            <HomeMap
              center={mapCenter}
            />

            {selectedMapPlace && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-10 bg-surface/95 backdrop-blur-2xl p-5 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] border border-outline-variant/40">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 pr-4">
                    <h3 className="text-xl font-bold font-headline text-on-surface leading-tight truncate">
                      {selectedMapPlace.name}
                    </h3>
                    <p className="text-sm text-on-surface-variant font-medium mt-1 truncate">
                      {selectedMapPlace.address}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedMapPlace(null)}
                    className="p-1.5 hover:bg-surface-container rounded-full text-on-surface-variant transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-lg">
                      close
                    </span>
                  </button>
                </div>

                <button
                  onClick={() => handleBookPlace(selectedMapPlace)}
                  className="w-full py-3.5 bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-bold rounded-xl shadow-[0_8px_16px_rgba(20,241,149,0.2)] transition-all flex items-center justify-center gap-2"
                >
                  Make Reservation
                  <span className="material-symbols-outlined text-[18px]">
                    arrow_forward
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories & Curated List */}
      <div className="max-w-7xl mx-auto px-6 md:px-8 space-y-12 mt-12">
        {/* Category Filters */}
        <section ref={revealRef1} className="reveal">
          <div className="flex justify-center overflow-x-auto gap-3 no-scrollbar pb-2 pt-4">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`${
                  category === c
                    ? "bg-primary text-on-primary shadow-[0_8px_16px_rgba(1,29,53,0.08)]"
                    : "bg-surface-container-low text-on-surface hover:bg-surface-container-highest"
                } px-5 py-2.5 rounded-lg font-label text-sm font-medium whitespace-nowrap transition-colors`}
              >
                {getCategoryLabel(c)}
              </button>
            ))}
          </div>
        </section>

        {/* Featured Businesses */}
        <section ref={revealRef2} className="space-y-6 reveal">
          <div className="flex justify-between items-center">
            <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
              {userLoc ? "Near You" : "Curated for You"}
            </h3>
            <button
              onClick={handleGetLocation}
              disabled={locLoading}
              className="flex items-center gap-1.5 text-sm font-medium text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
            >
              <MapPinIcon className="h-4 w-4" />
              {locLoading ? "Locating..." : "Near Me"}
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : businesses.length === 0 ? (
            <div className="text-center py-12 bg-surface-container-low rounded-xl">
              <p className="font-body text-on-surface-variant">
                No businesses found matching your criteria.
              </p>
              <button
                onClick={() => {
                  setCategory("ALL");
                }}
                className="mt-4 text-primary font-bold hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Main Feature - First Business */}
              {businesses[0] && (
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  to={`/business/${businesses[0].id}`}
                  className="md:col-span-8 bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(1,29,53,0.06)] group relative h-80 block tile-hover border border-outline-variant/10 glowing-border"
                >
                  <img
                    alt={businesses[0].name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    src={
                      businesses[0].coverImageUrl ||
                      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200"
                    }
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 w-full z-10">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {getCategoryLabel(businesses[0].category)}
                      </span>
                      <span className="flex items-center text-on-primary text-sm font-body">
                        <span
                          className="material-symbols-outlined text-[16px] mr-1 text-yellow-400"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                        {businesses[0].rating?.toFixed(1) || "4.9"}
                      </span>
                      {businesses[0].isClaimed ? (
                        <span className="bg-[#14F195]/20 text-[#14F195] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-label border border-[#14F195]/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
                          Solana Protected
                        </span>
                      ) : (
                        <span className="bg-amber-500/20 text-[#fbbf24] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 font-label border border-[#f59e0b]/30">
                          Unclaimed Listing
                        </span>
                      )}
                    </div>
                    <h4 className="font-headline text-2xl font-bold text-on-primary mb-1">
                      {businesses[0].name}
                    </h4>
                    <p className="font-body text-slate-300 text-sm max-w-md line-clamp-2">
                      {businesses[0].description ||
                        `${businesses[0].city} • Discover our premium services.`}
                    </p>
                  </div>
                </Link>
              )}

              {/* Secondary Stack - Next Two Businesses */}
              <div className="md:col-span-4 flex flex-col gap-6">
                {businesses[1] && (
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    to={`/business/${businesses[1].id}`}
                    className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_20px_40px_rgba(1,29,53,0.06)] flex-1 relative group block min-h-[150px] tile-hover border border-outline-variant/10 glowing-border"
                  >
                    <img
                      alt={businesses[1].name}
                      className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                      src={
                        businesses[1].coverImageUrl ||
                        "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600"
                      }
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/90 to-transparent" />
                    <div className="absolute top-4 right-4 z-10">
                      {businesses[1].isClaimed ? (
                        <span className="bg-[#14F195]/30 backdrop-blur-md text-[#14F195] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-[#14F195]/40">
                          Solana
                        </span>
                      ) : (
                        <span className="bg-amber-500/30 backdrop-blur-md text-[#fbbf24] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-[#f59e0b]/40">
                          Unclaimed
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 p-5 z-10">
                      <span className="bg-secondary-container text-on-secondary-fixed-variant px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">
                        {getCategoryLabel(businesses[1].category)}
                      </span>
                      <h4 className="font-headline text-lg font-bold text-on-primary">
                        {businesses[1].name}
                      </h4>
                    </div>
                  </Link>
                )}

                {businesses.length > 2 && businesses[2] && (
                  <Link
                    target="_blank"
                    rel="noopener noreferrer"
                    to={`/business/${businesses[2].id}`}
                    className="bg-surface-container-low rounded-xl overflow-hidden flex-1 p-5 flex flex-col justify-center min-h-[150px] cursor-pointer group hover:bg-surface-container transition-colors shadow-sm tile-hover border border-outline-variant/10 glowing-border"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-headline text-lg font-bold text-on-surface">
                        {businesses[2].name}
                      </h4>
                      {businesses[2].isClaimed ? (
                        <span className="bg-[#14F195]/20 text-[#10b981] px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-[#14F195]/30">
                          Solana
                        </span>
                      ) : (
                        <span className="bg-amber-500/20 text-[#d97706] px-2 py-0.5 rounded text-[9px] font-bold uppercase border border-[#f59e0b]/30">
                          Unclaimed
                        </span>
                      )}
                    </div>
                    <p className="font-body text-on-surface-variant text-sm mb-4 line-clamp-2">
                      {businesses[2].description ||
                        `${businesses[2].city} • Premium service with Pabandi.`}
                    </p>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-xs text-on-surface-variant font-medium">
                        {getCategoryLabel(businesses[2].category)} •{" "}
                        {businesses[2].city}
                      </span>
                      <span className="text-primary text-sm font-bold group-hover:translate-x-1 transition-transform">
                        Book →
                      </span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>

        {/* App Features / proof grid */}
        <section ref={revealRef3} className="reveal space-y-6">
          <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
            Why book with Pabandi
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Reliability-First Booking",
                body: "No-shows hurt trust. Pabandi protects reliability with AI-based no-show prediction.",
                accent: "from-[#14F195] to-[#06b6d4]",
              },
              {
                title: "Earn $PAB on Honored Appointments",
                body: "Customers can earn rewards when they show up and honor their reservation.",
                accent: "from-[#f472b6] to-[#a855f7]",
              },
              {
                title: "Global + Local Map Search",
                body: "Discover venues with openstreet-powered search, then book instantly.",
                accent: "from-[#fbbf24] to-[#f97316]",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-6 glowing-border"
              >
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.accent} mb-4`}
                />
                <h4 className="font-headline font-bold text-on-surface mb-2">
                  {item.title}
                </h4>
                <p className="font-body text-sm text-on-surface-variant">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Social proof */}
        <section ref={revealRef4} className="reveal">
          <div className="rounded-3xl bg-surface-container-low border border-outline-variant/10 p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <h3 className="font-headline text-2xl font-black text-primary mb-2">
                Join the Pabandi network
              </h3>
              <p className="font-body text-on-surface-variant text-sm max-w-xl">
                Salons, clinics, fitness studios, and restaurants are moving to
                Pabandi to protect their time, reduce no-shows, and reward loyal
                customers.
              </p>
            </div>
            <Link
              to="/auth"
              className="bg-gradient-to-r from-primary to-[#06b6d4] text-on-primary font-headline font-bold px-6 py-3 rounded-xl shadow-sm hover:opacity-90"
            >
              Get Started
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
