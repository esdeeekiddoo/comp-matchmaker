import MirageImg from "@/assets/Mirage.webp";
import InfernoImg from "@/assets/Inferno.webp";
import OverpassImg from "@/assets/Overpass.webp";
import NukeImg from "@/assets/Nuke.webp";
import VertigoImg from "@/assets/Vertigo.webp";
import Dust2Img from "@/assets/Dust_2.webp";
import CacheImg from "@/assets/Cache.webp";

const MAP_POOL = ["Mirage", "Inferno", "Overpass", "Nuke", "Vertigo", "Dust 2", "Cache"] as const;

export type MapName = (typeof MAP_POOL)[number];

export { MAP_POOL };

const mapImages: Record<string, string> = {
  Mirage: MirageImg,
  Inferno: InfernoImg,
  Overpass: OverpassImg,
  Nuke: NukeImg,
  Vertigo: VertigoImg,
  "Dust 2": Dust2Img,
  Cache: CacheImg,
  // backward-compatible aliases for old matches
  Dust: Dust2Img,
};

export function getMapImage(name: string | null | undefined): string | null {
  if (!name) return null;
  return mapImages[name] ?? null;
}
