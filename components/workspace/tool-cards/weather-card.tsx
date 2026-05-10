"use client";

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplet,
  MapPin,
  Sun,
  Wind,
} from "lucide-react";

import { hasError, type ToolCardProps } from "./types";

type WeatherOutput = {
  place: { name: string; country: string | null; region: string | null };
  current: {
    temperatureC: number;
    feelsLikeC: number;
    humidity: number;
    windSpeedKmh: number;
    weatherCode: number;
    condition: string;
    icon: string;
    isDay: boolean;
  };
  daily: Array<{
    date: string;
    weatherCode: number;
    condition: string;
    tempMaxC: number;
    tempMinC: number;
    precipitationMm: number;
  }>;
};

const ICONS: Record<string, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "cloud-lightning": CloudLightning,
};

const WeatherGlyph = ({
  icon,
  className = "h-5 w-5",
}: {
  icon: string;
  className?: string;
}) => {
  const Icon = ICONS[icon] ?? Cloud;
  return <Icon className={className} />;
};

const iconForCode = (code: number): string => {
  if (code === 0) return "sun";
  if (code <= 2) return "cloud-sun";
  if (code === 3) return "cloud";
  if (code >= 45 && code <= 48) return "cloud-fog";
  if (code >= 51 && code <= 55) return "cloud-drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return "cloud-rain";
  if (code >= 71 && code <= 77) return "cloud-snow";
  if (code >= 95) return "cloud-lightning";
  return "cloud";
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
};

export function WeatherCard({ call }: ToolCardProps) {
  if (hasError(call.output)) return null;
  const data = call.output as WeatherOutput | undefined;
  if (!data) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 bg-linear-to-br from-sky-500/20 via-card to-card px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">
              {[data.place.name, data.place.region, data.place.country]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <WeatherGlyph
              icon={data.current.icon}
              className="h-6 w-6 text-sky-300"
            />
            <span className="text-2xl font-semibold leading-none">
              {Math.round(data.current.temperatureC)}°C
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {data.current.condition} · feels like{" "}
            {Math.round(data.current.feelsLikeC)}°C
          </p>
        </div>
        <div className="flex flex-col gap-1 text-right text-[11px] text-muted-foreground">
          <span className="inline-flex items-center justify-end gap-1">
            <Droplet className="h-3 w-3" /> {data.current.humidity}%
          </span>
          <span className="inline-flex items-center justify-end gap-1">
            <Wind className="h-3 w-3" /> {Math.round(data.current.windSpeedKmh)}{" "}
            km/h
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 px-2 pb-2 pt-1.5">
        {data.daily.slice(0, 7).map((day) => (
          <div
            key={day.date}
            className="flex flex-col items-center gap-0.5 rounded-md bg-muted/20 py-1.5 text-[10px] text-muted-foreground"
          >
            <span>{formatDate(day.date)}</span>
            <WeatherGlyph
              icon={iconForCode(day.weatherCode)}
              className="h-3.5 w-3.5 text-foreground"
            />
            <span className="text-[10px] font-medium text-foreground">
              {Math.round(day.tempMaxC)}°
            </span>
            <span className="text-[9px]">{Math.round(day.tempMinC)}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}
