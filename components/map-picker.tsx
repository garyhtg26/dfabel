"use client";
import { useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { LocateFixed } from "lucide-react";
import "leaflet/dist/leaflet.css";
type Props = {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  onAddress?: (address: string) => void;
};
function FollowPin({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map?.panTo({ lat, lng });
  }, [map, lat, lng]);
  return null;
}
function AddressSearch({
  onChange,
  onAddress,
}: {
  onChange: Props["onChange"];
  onAddress?: Props["onAddress"];
}) {
  const places = useMapsLibrary("places");
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef({ onChange, onAddress });
  callback.current = { onChange, onAddress };
  const [error, setError] = useState("");
  useEffect(() => {
    if (!places || !host.current) return;
    const widget = new places.PlaceAutocompleteElement({
      includedRegionCodes: ["id"],
    });
    widget.setAttribute("placeholder", "Cari jalan, gedung, atau tempat");
    const handle = async (event: Event) => {
      try {
        const { placePrediction } =
          event as google.maps.places.PlacePredictionSelectEvent;
        const place = placePrediction.toPlace();
        await place.fetchFields({ fields: ["location", "formattedAddress"] });
        if (place.location)
          callback.current.onChange(place.location.lat(), place.location.lng());
        if (place.formattedAddress)
          callback.current.onAddress?.(place.formattedAddress);
        setError("");
      } catch {
        setError("Alamat belum ditemukan. Pilih titik langsung di peta.");
      }
    };
    const onError = () =>
      setError("Pencarian belum tersedia. Pilih titik di peta.");
    widget.addEventListener("gmp-select", handle);
    widget.addEventListener("gmp-error", onError);
    host.current.appendChild(widget);
    return () => {
      widget.removeEventListener("gmp-select", handle);
      widget.removeEventListener("gmp-error", onError);
      widget.remove();
    };
  }, [places]);
  return (
    <div className="mb-3">
      <div ref={host} className="min-h-11" />
      {error && <p className="!my-2 text-xs text-amber-700">{error}</p>}
    </div>
  );
}
export default function MapPicker({ lat, lng, onChange, onAddress }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const callback = useRef(onChange);
  callback.current = onChange;
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const marker = useRef<import("leaflet").CircleMarker | null>(null);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(() => {
    if (key || !ref.current) return;
    let disposed = false;
    import("leaflet").then((L) => {
      if (disposed || !ref.current) return;
      const map = L.map(ref.current).setView([lat, lng], 14);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      })
        .addTo(map)
        .on("tileerror", () =>
          setError("Peta gagal dimuat. Periksa koneksi internet."),
        );
      marker.current = L.circleMarker([lat, lng], {
        radius: 10,
        color: "#fff",
        weight: 3,
        fillColor: "#2621df",
        fillOpacity: 1,
      }).addTo(map);
      map.on("click", (e) => callback.current(e.latlng.lat, e.latlng.lng));
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [key]);
  useEffect(() => {
    marker.current?.setLatLng([lat, lng]);
    mapRef.current?.panTo([lat, lng]);
  }, [lat, lng]);
  const locate = (
    <button
      type="button"
      className="absolute right-3 top-3 z-[500] flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-md"
      onClick={() => {
        if (!navigator.geolocation) {
          setError("Lokasi perangkat tidak tersedia.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) => {
            onChange(p.coords.latitude, p.coords.longitude);
            setError("");
          },
          () => setError("Izin lokasi ditolak. Pilih titik di peta."),
        );
      }}
    >
      <LocateFixed size={15} /> Lokasi saya
    </button>
  );
  return (
    <section>
      {key ? (
        <APIProvider
          apiKey={key}
          language="id"
          region="ID"
          onError={() =>
            setError(
              "Google Maps gagal dimuat. Periksa API key, billing, dan domain yang diizinkan.",
            )
          }
        >
          <AddressSearch onChange={onChange} onAddress={onAddress} />
          <div className="relative h-60 overflow-hidden rounded-xl bg-slate-100">
            <Map
              defaultCenter={{ lat, lng }}
              defaultZoom={14}
              mapId="DEMO_MAP_ID"
              disableDefaultUI
              zoomControl
              gestureHandling="cooperative"
              onClick={(e) => {
                if (e.detail.latLng)
                  onChange(e.detail.latLng.lat, e.detail.latLng.lng);
              }}
            >
              <AdvancedMarker
                position={{ lat, lng }}
                draggable
                onDragEnd={(e) => {
                  if (e.latLng) onChange(e.latLng.lat(), e.latLng.lng());
                }}
              />
              <FollowPin lat={lat} lng={lng} />
            </Map>
            {locate}
          </div>
        </APIProvider>
      ) : (
        <div className="relative h-60 overflow-hidden rounded-xl bg-slate-100">
          <div ref={ref} className="h-full w-full" />
          {locate}
        </div>
      )}
      <p className="!mb-0 !mt-2 text-xs leading-relaxed text-slate-400">
        {error || "Ketuk peta atau geser pin untuk titik jemput yang tepat."}
      </p>
      <span className="block text-[11px] text-slate-400">
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </span>
    </section>
  );
}
