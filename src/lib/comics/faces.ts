export interface ReplacementFace {
  id: string;
  name: string;
  category: "comic" | "cartoon" | "emoji" | "mascot" | "custom";
  src: string;
}

export const DEFAULT_FACE_SET: ReplacementFace[] = [
  {
    id: "hero-mask",
    name: "Superhero Mask",
    category: "comic",
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23e63946'/><ellipse cx='32' cy='42' rx='12' ry='8' fill='%231d3557'/><ellipse cx='68' cy='42' rx='12' ry='8' fill='%231d3557'/><circle cx='32' cy='42' r='4' fill='%23ffffff'/><circle cx='68' cy='42' r='4' fill='%23ffffff'/><path d='M30 70 Q50 85 70 70' stroke='%23ffffff' stroke-width='6' fill='none' stroke-linecap='round'/></svg>",
  },
  {
    id: "retro-noir",
    name: "Detective Hat & Face",
    category: "comic",
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='52' r='45' fill='%23f1faee'/><path d='M10 35 Q50 15 90 35 L80 22 Q50 10 20 22 Z' fill='%231d3557'/><rect x='25' y='26' width='50' height='8' fill='%23e63946'/><circle cx='35' cy='50' r='6' fill='%231d3557'/><circle cx='65' cy='50' r='6' fill='%231d3557'/><path d='M35 72 Q50 80 65 72' stroke='%231d3557' stroke-width='5' fill='none' stroke-linecap='round'/></svg>",
  },
  {
    id: "sci-fi-bot",
    name: "Cyborg Head",
    category: "mascot",
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect x='10' y='10' width='80' height='80' rx='20' fill='%23457b9d'/><rect x='20' y='30' width='60' height='24' rx='8' fill='%231d3557'/><circle cx='36' cy='42' r='8' fill='%23a8dadc'/><circle cx='64' cy='42' r='8' fill='%23e63946'/><line x1='30' y1='70' x2='70' y2='70' stroke='%23f1faee' stroke-width='6' stroke-linecap='round'/></svg>",
  },
  {
    id: "cartoon-cat",
    name: "Comic Cat",
    category: "cartoon",
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M15 15 L35 40 L10 50 Z' fill='%23f4a261'/><path d='M85 15 L65 40 L90 50 Z' fill='%23f4a261'/><circle cx='50' cy='55' r='40' fill='%23e76f51'/><ellipse cx='35' cy='48' rx='8' ry='12' fill='%23264653'/><ellipse cx='65' cy='48' rx='8' ry='12' fill='%23264653'/><polygon points='50,60 44,68 56,68' fill='%23264653'/><path d='M35 74 Q50 84 65 74' stroke='%23264653' stroke-width='4' fill='none'/></svg>",
  },
  {
    id: "cool-shades",
    name: "Cool Shades Emoji",
    category: "emoji",
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%23e9c46a'/><path d='M15 38 L85 38 L80 56 Q50 62 20 56 Z' fill='%23264653'/><path d='M35 72 Q50 86 65 72' stroke='%23264653' stroke-width='6' fill='none' stroke-linecap='round'/></svg>",
  },
  {
    id: "alien-head",
    name: "Cosmic Alien",
    category: "mascot",
    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><ellipse cx='50' cy='50' rx='42' ry='48' fill='%232a9d8f'/><ellipse cx='32' cy='44' rx='14' ry='20' fill='%23264653' transform='rotate(-15 32 44)'/><ellipse cx='68' cy='44' rx='14' ry='20' fill='%23264653' transform='rotate(15 68 44)'/><circle cx='34' cy='40' r='4' fill='%23ffffff'/><circle cx='66' cy='40' r='4' fill='%23ffffff'/><line x1='40' y1='78' x2='60' y2='78' stroke='%23264653' stroke-width='4' stroke-linecap='round'/></svg>",
  },
];
