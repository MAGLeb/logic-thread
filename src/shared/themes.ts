// Flavor layer: themes (names/items/legend) separate from logic (the engine works on tokens).
// The internal category token is still "flair"; it is DISPLAYED as "Coat". Coats and time are
// universal across themes; a theme only sets suspect names, items, title and legend. English only.

export interface FlairInfo { emoji: string; word: string } // word = lowercase color adjective
export interface ObjInfo { label: string; emoji: string }

export interface Theme {
  id: string;
  title: string;                       // "The Cursed Pizza"
  legend: string;
  suspects: string[];                  // exactly 4 names
  objects: Record<string, ObjInfo>;    // token -> display (exactly 4)
}

// Coats (Okabe-Ito CVD-safe colors are set in the client CSS; here - text forms).
export const FLAIR_TOKENS = ["Red", "Blue", "Green", "Purple"] as const;
export const FLAIR: Record<string, FlairInfo> = {
  Red: { emoji: "🔴", word: "red" },
  Blue: { emoji: "🔵", word: "blue" },
  Green: { emoji: "🟢", word: "green" },
  Purple: { emoji: "🟣", word: "purple" },
};

// Time is ordered (before/after clues run on it).
export const TIME_TOKENS = ["09:00", "12:00", "15:00", "18:00"] as const;
export const TIME_EMOJI: Record<string, string> = {
  "09:00": "🌅", "12:00": "☀️", "15:00": "🌤", "18:00": "🌆",
};

export const THEMES: Theme[] = [
  {
    id: "pizza",
    title: "The Cursed Pizza",
    legend: "Four suspects were seen on Maple Square, one at a time - each in one coat, each carrying one item. Reconstruct who was seen when, in which coat, with what.",
    suspects: ["John", "Mira", "Paul", "Omar"],
    objects: {
      Pizza: { label: "Pizza", emoji: "🍕" },
      Keyboard: { label: "Keyboard", emoji: "⌨️" },
      Spoon: { label: "Spoon", emoji: "🥄" },
      Scroll: { label: "Scroll", emoji: "📜" },
    },
  },
  {
    id: "coffee",
    title: "The Jettisoned Coffee",
    legend: "Someone ejected the station's last coffee pod into the airlock. Each of four crew members was logged once - a time, a coat, an item. Piece it together.",
    suspects: ["Nova", "Vega", "Cosmo", "Iris"],
    objects: {
      Coffee: { label: "Coffee pod", emoji: "☕" },
      Headphones: { label: "Headphones", emoji: "🎧" },
      Flashlight: { label: "Flashlight", emoji: "🔦" },
      Sock: { label: "Sock", emoji: "🧦" },
    },
  },
  {
    id: "emoji",
    title: "The Missing Emoji",
    legend: "A rare emoji vanished from the set. Four curators kept logs - each with one item, one coat, one time. Find who had what.",
    suspects: ["Zoe", "Max", "Ivy", "Rex"],
    objects: {
      Emoji: { label: "Emoji", emoji: "😎" },
      Trophy: { label: "Trophy", emoji: "🏆" },
      Magnet: { label: "Magnet", emoji: "🧲" },
      Candle: { label: "Candle", emoji: "🕯️" },
    },
  },
  {
    id: "garden",
    title: "The Trampled Garden Bed",
    legend: "Someone trampled the seedlings in the community garden. Four gardeners filed reports - each at their own time, coat and tool.",
    suspects: ["Rosa", "Beck", "Wren", "Fenn"],
    objects: {
      Sprout: { label: "Sprout", emoji: "🌱" },
      Pot: { label: "Pot", emoji: "🪴" },
      Can: { label: "Watering can", emoji: "💧" },
      Snail: { label: "Snail", emoji: "🐌" },
    },
  },
  {
    id: "airlock",
    title: "The Faulty Airlock",
    legend: "The airlock failed at the worst moment. Four engineers left notes - each with one tool, one coat, one shift time.",
    suspects: ["Orin", "Lyra", "Petra", "Juno"],
    objects: {
      Wrench: { label: "Wrench", emoji: "🔧" },
      Helmet: { label: "Helmet", emoji: "🪖" },
      Chip: { label: "Chip", emoji: "🔌" },
      Bulb: { label: "Bulb", emoji: "💡" },
    },
  },
  {
    id: "bakery",
    title: "The Eaten Pie",
    legend: "The contest pie disappeared from the bakery. Four bakers checked in - each with a tool, a coat, and a shift time.",
    suspects: ["Pat", "Sam", "Nell", "Odo"],
    objects: {
      Pie: { label: "Pie", emoji: "🥧" },
      Whisk: { label: "Whisk", emoji: "🥄" },
      Timer: { label: "Timer", emoji: "⏲️" },
      Flour: { label: "Flour", emoji: "🌾" },
    },
  },
];

export const THEME_BY_ID: Record<string, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));

// Streak → rank ladder (docs/12). Early rewards in the first 3 days.
export const RANKS: { min: number; label: string }[] = [
  { min: 30, label: "🏛 Legend of the Yard" },
  { min: 14, label: "🧠 Mastermind" },
  { min: 7, label: "🎩 Chief Inspector" },
  { min: 3, label: "🕵️ Inspector" },
  { min: 1, label: "🔎 Detective" },
];

export function rankFor(streak: number): { label: string; nextIn: number; nextLabel: string | null } {
  const cur = RANKS.find((r) => streak >= r.min) ?? RANKS[RANKS.length - 1];
  const higher = [...RANKS].reverse().find((r) => r.min > (cur.min));
  return {
    label: cur.label,
    nextIn: higher ? higher.min - streak : 0,
    nextLabel: higher ? higher.label.replace(/^\S+\s/, "") : null,
  };
}
