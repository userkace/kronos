import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Ordered UTC first, then west → east by standard UTC offset.
const TIMEZONES = [
  { value: 'UTC',                  label: 'UTC (Coordinated Universal Time)',  city: 'UTC',          short: 'UTC',  lat:   0.00, lng:    0.00 },
  { value: 'Pacific/Honolulu',     label: 'HST (Hawaii Standard Time)',        city: 'Honolulu',     short: 'HST',  lat:  21.31, lng: -157.86 },
  { value: 'America/Anchorage',    label: 'AKST (Alaska Standard Time)',       city: 'Anchorage',    short: 'AKST', lat:  61.22, lng: -149.90 },
  { value: 'America/Los_Angeles',  label: 'PST (Pacific Standard Time)',       city: 'Los Angeles',  short: 'PST',  lat:  34.05, lng: -118.24 },
  { value: 'America/Denver',       label: 'MST (Mountain Standard Time)',      city: 'Denver',       short: 'MST',  lat:  39.74, lng: -104.99 },
  { value: 'America/Chicago',      label: 'CST (Central Standard Time)',       city: 'Chicago',      short: 'CST',  lat:  41.88, lng:  -87.63 },
  { value: 'America/New_York',     label: 'EST (Eastern Standard Time)',       city: 'New York',     short: 'EST',  lat:  40.71, lng:  -74.00 },
  { value: 'America/Bogota',       label: 'COT (Colombia Time)',               city: 'Bogotá',       short: 'COT',  lat:   4.71, lng:  -74.07 },
  { value: 'America/Sao_Paulo',    label: 'BRT (Brasília Time)',               city: 'São Paulo',    short: 'BRT',  lat: -23.55, lng:  -46.63 },
  { value: 'America/Argentina/Buenos_Aires', label: 'ART (Argentina Time)',    city: 'Buenos Aires', short: 'ART',  lat: -34.60, lng:  -58.38 },
  { value: 'Europe/London',        label: 'GMT (Greenwich Mean Time)',         city: 'London',       short: 'GMT',  lat:  51.51, lng:   -0.13 },
  { value: 'Africa/Lagos',         label: 'WAT (West Africa Time)',            city: 'Lagos',        short: 'WAT',  lat:   6.52, lng:    3.38 },
  { value: 'Europe/Paris',         label: 'CET (Central European Time)',       city: 'Paris',        short: 'CET',  lat:  48.85, lng:    2.35 },
  { value: 'Europe/Berlin',        label: 'CET (Central European Time)',       city: 'Berlin',       short: 'CET',  lat:  52.52, lng:   13.40 },
  { value: 'Africa/Cairo',         label: 'EET (Eastern European Time)',       city: 'Cairo',        short: 'EET',  lat:  30.04, lng:   31.24 },
  { value: 'Africa/Johannesburg',  label: 'SAST (South Africa Standard Time)', city: 'Johannesburg', short: 'SAST', lat: -26.20, lng:   28.05 },
  { value: 'Europe/Athens',        label: 'EET (Eastern European Time)',       city: 'Athens',       short: 'EET',  lat:  37.98, lng:   23.73 },
  { value: 'Europe/Istanbul',      label: 'TRT (Turkey Time)',                 city: 'Istanbul',     short: 'TRT',  lat:  41.01, lng:   28.98 },
  { value: 'Europe/Moscow',        label: 'MSK (Moscow Standard Time)',        city: 'Moscow',       short: 'MSK',  lat:  55.76, lng:   37.62 },
  { value: 'Asia/Dubai',           label: 'GST (Gulf Standard Time)',          city: 'Dubai',        short: 'GST',  lat:  25.20, lng:   55.27 },
  { value: 'Asia/Karachi',         label: 'PKT (Pakistan Standard Time)',      city: 'Karachi',      short: 'PKT',  lat:  24.86, lng:   67.01 },
  { value: 'Asia/Kolkata',         label: 'IST (India Standard Time)',         city: 'Kolkata',      short: 'IST',  lat:  22.57, lng:   88.36 },
  { value: 'Asia/Dhaka',           label: 'BST (Bangladesh Standard Time)',    city: 'Dhaka',        short: 'BST',  lat:  23.81, lng:   90.41 },
  { value: 'Asia/Bangkok',         label: 'ICT (Indochina Time)',              city: 'Bangkok',      short: 'ICT',  lat:  13.76, lng:  100.50 },
  { value: 'Asia/Jakarta',         label: 'WIB (Western Indonesia Time)',      city: 'Jakarta',      short: 'WIB',  lat:  -6.21, lng:  106.85 },
  { value: 'Asia/Singapore',       label: 'SGT (Singapore Standard Time)',     city: 'Singapore',    short: 'SGT',  lat:   1.35, lng:  103.82 },
  { value: 'Asia/Hong_Kong',       label: 'HKT (Hong Kong Time)',              city: 'Hong Kong',    short: 'HKT',  lat:  22.32, lng:  114.17 },
  { value: 'Asia/Manila',          label: 'PHT (Philippine Time)',             city: 'Manila',       short: 'PHT',  lat:  14.60, lng:  120.98 },
  { value: 'Asia/Shanghai',        label: 'CST (China Standard Time)',         city: 'Shanghai',     short: 'CST+', lat:  31.23, lng:  121.47 },
  { value: 'Asia/Seoul',           label: 'KST (Korea Standard Time)',         city: 'Seoul',        short: 'KST',  lat:  37.57, lng:  126.98 },
  { value: 'Asia/Tokyo',           label: 'JST (Japan Standard Time)',         city: 'Tokyo',        short: 'JST',  lat:  35.69, lng:  139.69 },
  { value: 'Australia/Perth',      label: 'AWST (Australian Western Time)',    city: 'Perth',        short: 'AWST', lat: -31.95, lng:  115.86 },
  { value: 'Australia/Sydney',     label: 'AEST (Australian Eastern Time)',    city: 'Sydney',       short: 'AEST', lat: -33.87, lng:  151.21 },
  { value: 'Pacific/Auckland',     label: 'NZST (New Zealand Standard Time)',  city: 'Auckland',     short: 'NZST', lat: -36.85, lng:  174.76 },
];

// Zoom level at which city labels appear — the first zoom step in from the
// world view. Below this only dots are shown (the selected timezone keeps its
// label at every zoom) to avoid clutter.
const LABEL_ZOOM = 2;

function makeIcon(tz, isSelected, showLabel) {
  const dot   = isSelected ? 11 : 7;
  const dotBg = isSelected ? '#2563EB' : '#94A3B8';
  const dotBorder = isSelected ? '#1D4ED8' : '#64748B';
  const labelBg   = isSelected ? '#1E40AF' : 'rgba(30,41,59,0.78)';
  const labelColor = '#fff';
  const labelSize  = '10px';
  const fontWeight = isSelected ? '700' : '500';
  const shadow = isSelected
    ? '0 2px 8px rgba(37,99,235,0.45)'
    : '0 1px 3px rgba(0,0,0,0.25)';

  const label = (isSelected || showLabel) ? `
        <div style="
          background: ${labelBg};
          color: ${labelColor};
          font-size: ${labelSize};
          font-weight: ${fontWeight};
          font-family: system-ui, sans-serif;
          padding: 2px 6px;
          border-radius: 6px;
          white-space: nowrap;
          line-height: 1.3;
          box-shadow: ${shadow};
          letter-spacing: 0.01em;
        ">${tz.city} <span style="opacity:0.75">·</span> ${tz.short}</div>` : '';

  return L.divIcon({
    className: '',
    iconSize:   [0, 0],
    iconAnchor: [0, 0],
    html: `
      <div style="
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 5px;
        pointer-events: auto;
        cursor: pointer;
        user-select: none;
      ">
        <div style="
          width: ${dot}px;
          height: ${dot}px;
          border-radius: 50%;
          background: ${dotBg};
          border: 2px solid ${dotBorder};
          box-shadow: 0 0 0 2px rgba(255,255,255,0.6), ${shadow};
          flex-shrink: 0;
        "></div>${label}
      </div>
    `,
  });
}

const TimezoneSelect = ({ timezone, onTimezoneChange }) => {
  const mapRef       = useRef(null);
  const mapRef2      = useRef(null);   // holds the L.Map instance
  const markersRef   = useRef({});
  const onChangeRef  = useRef(onTimezoneChange);
  const timezoneRef  = useRef(timezone); // current selection, for the zoom handler

  useEffect(() => { onChangeRef.current = onTimezoneChange; });
  useEffect(() => { timezoneRef.current = timezone; });

  useEffect(() => {
    if (mapRef2.current) return;

    const map = L.map(mapRef.current, {
      center: [22, 15],
      zoom: 1,
      minZoom: 1,
      maxZoom: 6,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1.0,
    });

    // CartoDB Positron — clean, minimal tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      noWrap: true,
    }).addTo(map);

    const showLabels = map.getZoom() >= LABEL_ZOOM;
    TIMEZONES.forEach((tz) => {
      const isSelected = tz.value === timezone;
      const marker = L.marker([tz.lat, tz.lng], {
        icon: makeIcon(tz, isSelected, showLabels),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      marker.on('click', () => onChangeRef.current(tz.value));
      marker.addTo(map);
      markersRef.current[tz.value] = marker;
    });

    // Reveal labels only when zoomed in; zoomed out shows dots (plus the
    // selected timezone's label) so the world view stays readable.
    map.on('zoomend', () => {
      const show = map.getZoom() >= LABEL_ZOOM;
      TIMEZONES.forEach((tz) => {
        const marker = markersRef.current[tz.value];
        if (!marker) return;
        marker.setIcon(makeIcon(tz, tz.value === timezoneRef.current, show));
      });
    });

    mapRef2.current = map;

    return () => {
      map.remove();
      mapRef2.current = null;
      markersRef.current = {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh icons when selection changes
  useEffect(() => {
    if (!mapRef2.current) return;
    const showLabels = mapRef2.current.getZoom() >= LABEL_ZOOM;
    TIMEZONES.forEach((tz) => {
      const marker = markersRef.current[tz.value];
      if (!marker) return;
      const isSelected = tz.value === timezone;
      marker.setIcon(makeIcon(tz, isSelected, showLabels));
      marker.setZIndexOffset(isSelected ? 1000 : 0);
    });
  }, [timezone]);

  const handleDropdownChange = (e) => {
    const val = e.target.value;
    onTimezoneChange(val);
    const tz = TIMEZONES.find((t) => t.value === val);
    if (tz && mapRef2.current) {
      mapRef2.current.setView([tz.lat, tz.lng], 3, { animate: true });
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={mapRef}
        className="h-48 sm:h-60 w-full rounded-xl overflow-hidden border border-gray-200/80 shadow-xs"
        style={{
          background: '#d4dadc',
          isolation: 'isolate',
        }}
      />
      <div className="flex items-center gap-2">
        <label htmlFor="timezone" className="text-sm font-medium text-gray-600 shrink-0">
          Timezone
        </label>
        <select
          id="timezone"
          value={timezone}
          onChange={handleDropdownChange}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.city} — {tz.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default TimezoneSelect;
