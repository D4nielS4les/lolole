export type Activity =
  | { kind: "listen"; prompt: string; answer: string; options: string[] }
  | { kind: "trace"; target: string }
  | { kind: "build"; answer: string; pieces: string[]; emoji?: string };

export type Day = { day: number; stage: "Sons" | "Sílabas" | "Palavras"; title: string; activities: Activity[] };

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const pick = (pool: string[], answer: string, n = 3) =>
  shuffle([answer, ...shuffle(pool.filter((p) => p !== answer)).slice(0, n - 1)]);

const LETTERS: [string, string][] = [["A","E"],["I","O"],["U","A"],["B","P"],["M","N"],["T","D"],["L","R"],["F","V"],["S","Z"],["C","G"]];
const ALL = LETTERS.flat();
const SOUNDS: Record<string,string> = { A:"á",E:"é",I:"í",O:"ó",U:"ú",B:"bê",P:"pê",M:"mmm",N:"nnn",T:"tê",D:"dê",L:"lll",R:"rrr",F:"fff",V:"vvv",S:"sss",Z:"zzz",C:"quê",G:"guê" };
export const soundOf = (l: string) => SOUNDS[l] ?? l;

const CONS = ["B","P","M","T","L","F","V","S","N","D"];
const V = ["A","E","I","O","U"];
const WORDS: [string[], string][] = [
  [["BO","LA"],"⚽"],[["PA","TO"],"🦆"],[["CA","SA"],"🏠"],[["GA","TO"],"🐱"],[["SA","PO"],"🐸"],
  [["BO","CA"],"👄"],[["MA","LA"],"🧳"],[["DA","DO"],"🎲"],[["FA","CA"],"🔪"],[["VA","CA"],"🐄"],
  [["LU","A"],"🌙"],[["PE","TE","CA"],"🏓"],[["MA","CA","CO"],"🐒"],[["BA","LE","IA"],"🐋"],[["SA","PA","TO"],"👞"],
];

export function buildDay(d: number): Day {
  if (d <= 10) {
    const [a, b] = LETTERS[d - 1] as [string, string];
    return { day: d, stage: "Sons", title: `Letras ${a} e ${b}`, activities: [
      { kind: "listen", prompt: soundOf(a), answer: a, options: pick(ALL, a) },
      { kind: "trace", target: a },
      { kind: "listen", prompt: soundOf(b), answer: b, options: pick(ALL, b) },
      { kind: "trace", target: b },
      { kind: "listen", prompt: soundOf(a), answer: a, options: pick([b, ...ALL], a, 4) },
    ]};
  }
  if (d <= 20) {
    const c = CONS[d - 11]!;
    const syl = V.map((v) => c + v);
    const s = shuffle(syl);
    return { day: d, stage: "Sílabas", title: `Família ${syl.join(" ")}`, activities: [
      { kind: "listen", prompt: s[0]!, answer: s[0]!, options: pick(syl, s[0]!) },
      { kind: "build", answer: s[1]!, pieces: shuffle([c, s[1]![1]!, V.find((v) => v !== s[1]![1])!]) },
      { kind: "trace", target: s[2]! },
      { kind: "listen", prompt: s[3]!, answer: s[3]!, options: pick(syl, s[3]!, 4) },
      { kind: "build", answer: s[4]!, pieces: shuffle([c, s[4]![1]!, "R"]) },
    ]};
  }
  const i = (d - 21) % WORDS.length;
  const w1 = WORDS[i]!, w2 = WORDS[(i + 5) % WORDS.length]!;
  const words = WORDS.map(([p]) => p.join(""));
  const j1 = w1[0].join(""), j2 = w2[0].join("");
  return { day: d, stage: "Palavras", title: `${j1} e ${j2}`, activities: [
    { kind: "build", answer: j1, pieces: shuffle([...w1[0], "MI"]), emoji: w1[1] },
    { kind: "listen", prompt: j1, answer: j1, options: pick(words, j1) },
    { kind: "trace", target: j1.slice(0, 2) },
    { kind: "build", answer: j2, pieces: shuffle([...w2[0], "TU"]), emoji: w2[1] },
    { kind: "listen", prompt: j2, answer: j2, options: pick(words, j2) },
  ]};
}

const KEY = "lololê-progress";
export const getDone = (): number[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
export const markDone = (d: number) => localStorage.setItem(KEY, JSON.stringify([...new Set([...getDone(), d])]));
