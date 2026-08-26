/**
 * Where the resort actually is.
 *
 * Google's `output=embed` map needs no API key and no script tag, which keeps
 * this a plain server component. Coordinates win when we have them; otherwise
 * the resort's name and destination are a good enough query for a place that
 * is, by definition, a well-known beach resort.
 *
 * Resorts publish illustrated property maps too, but those are drawn artwork
 * and not ours to reproduce — the "Property map" link goes to theirs instead.
 */
export default function ResortMap({
  name, destination, lat, lng, propertyMapUrl,
}: {
  name: string;
  destination: string;
  lat: number | null;
  lng: number | null;
  propertyMapUrl?: string | null;
}) {
  const query = lat != null && lng != null
    ? `${lat},${lng}`
    : `${name}, ${destination}`;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;

  return (
    <>
      <div className="overflow-hidden rounded-lg" style={{ background: 'var(--surface-2)' }}>
        <iframe
          src={src}
          title={`Map of ${name}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-[320px] w-full border-0"
        />
      </div>
      <div className="muted mt-2 flex flex-wrap gap-x-3 text-xs">
        <a className="hover:underline" target="_blank" rel="noreferrer"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}>
          Open in Google Maps ↗
        </a>
        {propertyMapUrl && (
          <a className="hover:underline" href={propertyMapUrl} target="_blank" rel="noreferrer">
            Property map ↗
          </a>
        )}
      </div>
    </>
  );
}
