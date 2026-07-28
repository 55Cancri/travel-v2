// Address and place lookups from Photon (komoot's keyless OSM geocoder,
// built for as-you-type search; Nominatim's usage policy forbids
// autocomplete). Callers pass a bias point, typically the city already on
// screen, so three typed letters rank the right continent first.

export type AddressHit = {
  label: string;
  address?: string;
  lng: number;
  lat: number;
};

const GEOCODER = "https://photon.komoot.io/api/";
const hitCache = new Map<string, AddressHit[]>();

type WireFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    country?: string;
  };
};

export const fetchAddressHits = async (
  query: string,
  bias: { lng: number; lat: number } | null,
  signal: AbortSignal,
) => {
  const key = `${query}§${bias ? `${bias.lng.toFixed(2)},${bias.lat.toFixed(2)}` : "-"}`;
  const cached = hitCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({ q: query, limit: "6", lang: "en" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  const res = await fetch(`${GEOCODER}?${params}`, { signal });
  if (!res.ok) throw new Error(`geocoder responded ${res.status}`);
  const body = (await res.json()) as { features?: WireFeature[] };
  const hits: AddressHit[] = [];
  for (const feature of body.features ?? []) {
    const coords = feature.geometry?.coordinates;
    const props = feature.properties ?? {};
    const streetLine = [props.street, props.housenumber].filter(Boolean).join(" ");
    const label = props.name ?? streetLine;
    if (!coords || !label) continue;
    // Named places keep their street in the address line; bare addresses
    // already carry it as the label.
    const address = [props.name ? streetLine : "", props.city, props.country]
      .filter(Boolean)
      .join(", ");
    if (hits.some((hit) => hit.label === label && hit.address === address)) continue;
    hits.push({ label, address: address || undefined, lng: coords[0], lat: coords[1] });
  }
  hitCache.set(key, hits);
  return hits;
};
