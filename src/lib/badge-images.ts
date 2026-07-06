import AplS1Img from "@/assets/badges/APL_S1.png";
import MythicalImg from "@/assets/badges/Mythical.png";
import NexonImg from "@/assets/badges/Nexon.png";

const badgeImages: Record<string, string> = {
  "APL_S1.png": AplS1Img,
  "Mythical.png": MythicalImg,
  "Nexon.png": NexonImg,
};

export function getBadgeImage(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  return badgeImages[imageUrl] ?? null;
}
