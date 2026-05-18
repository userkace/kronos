import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TIMEZONES = [
  { value: 'UTC',                  label: 'UTC (Coordinated Universal Time)', city: 'UTC',         short: 'UTC',  lat:   0.00, lng:   0.00 },
  { value: 'America/New_York',     label: 'EST (Eastern Standard Time)',      city: 'New York',    short: 'EST',  lat:  40.71, lng: -74.00 },
  { value: 'America/Chicago',      label: 'CST (Central Standard Time)',      city: 'Chicago',     short: 'CST',  lat:  41.88, lng: -87.63 },
  { value: 'America/Denver',       label: 'MST (Mountain Standard Time)',     city: 'Denver',      short: 'MST',  lat:  39.74, lng: -104.99 },
  { value: 'America/Los_Angeles',  label: 'PST (Pacific Standard Time)',      city: 'Los Angeles', short: 'PST',  lat:  34.05, lng: -118.24 },
  { value: 'Europe/London',        label: 'GMT (Greenwich Mean Time)',        city: 'London',      short: 'GMT',  lat:  51.51, lng:  -0.13 },
  { value: 'Europe/Paris',         label: 'CET (Central European Time)',      city: 'Paris',       short: 'CET',  lat:  48.85, lng:   2.35 },
  { value: 'Asia/Tokyo',           label: 'JST (Japan Standard Time)',        city: 'Tokyo',       short: 'JST',  lat:  35.69, lng: 139.69 },
  { value: 'Asia/Shanghai',        label: 'CST (China Standard Time)',        city: 'Shanghai',    short: 'CST+', lat:  31.23, lng: 121.47 },
  { value: 'Australia/Sydney',     label: 'AEST (Australian Eastern Time)',   city: 'Sydney',      short: 'AEST', lat: -33.87, lng: 151.21 },
];

function makeIcon(tz, isSelected) {
  const dot   = isSelected ? 11 : 7;
  const dotBg = isSelected ? '#2563EB' : '#94A3B8';
  const dotBorder = isSelected ? '#1D4ED8' : '#64748B';
  const labelBg   = isSelected ? '#1E40AF' : 'rgba(30,41,59,0.78)';
  const labelColor = '#fff';
  const labelSize  = isSelected ? '10px' : '9px';
  const fontWeight = isSelected ? '700' : '500';
  const shadow = isSelected
    ? '0 2px 8px rgba(37,99,235,0.45)'
    : '0 1px 3px rgba(0,0,0,0.25)';

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
        "></div>
        <div style="
          background: ${labelBg};
          color: ${labelColor};
          font-size: ${labelSize};
          font-weight: ${fontWeight};
          font-family: system-ui, sans-serif;
          padding: 2px 5px;
          border-radius: 4px;
          white-space: nowrap;
          line-height: 1.3;
          box-shadow: ${shadow};
          letter-spacing: 0.01em;
        ">${tz.city} <span style="opacity:0.75">·</span> ${tz.short}</div>
      </div>
    `,
  });
}

const TimezoneSelect = ({ timezone, onTimezoneChange }) => {
  const mapRef       = useRef(null);
  const mapRef2      = useRef(null);   // holds the L.Map instance
  const markersRef   = useRef({});
  const onChangeRef  = useRef(onTimezoneChange);

  useEffect(() => { onChangeRef.current = onTimezoneChange; });

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

    TIMEZONES.forEach((tz) => {
      const isSelected = tz.value === timezone;
      const marker = L.marker([tz.lat, tz.lng], {
        icon: makeIcon(tz, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      marker.on('click', () => onChangeRef.current(tz.value));
      marker.addTo(map);
      markersRef.current[tz.value] = marker;
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
    TIMEZONES.forEach((tz) => {
      const marker = markersRef.current[tz.value];
      if (!marker) return;
      const isSelected = tz.value === timezone;
      marker.setIcon(makeIcon(tz, isSelected));
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
        className="rounded-xl overflow-hidden"
        style={{
          height: '240px',
          width: '100%',
          border: '1px solid #E2E8F0',
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
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm text-gray-800"
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
