import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildDay, markDone, speak, type Activity } from "@/lib/lessons";

export const Route = createFileRoute("/dia/$id")({
  head: ({ params }) => ({ meta: [
    { title: `Dia ${params.id} — Lololê` },
    { name: "description", content: `Desafio fônico do dia ${params.id} da trilha Lololê.` },
    { property: "og:title", content: `Dia ${params.id} — Lololê` },
    { property: "og:description", content: `Desafio fônico do dia ${params.id}.` },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: DayPage,
});

function DayPage() {
  const { id } = Route.useParams();
  const d = Math.max(1, Math.min(30, Number(id) || 1));
  const [seed, setSeed] = useState(0);
  const day = useMemo(() => buildDay(d), [d, seed]);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); setStep(0); setSeed((s) => s + 1); }, [d]);
  const finished = step >= day.activities.length;
  useEffect(() => { if (finished && mounted) { markDone(d); speak("Parabéns! Você conseguiu!"); } }, [finished, mounted, d]);
  if (!mounted) return null;
  const act = day.activities[step];
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="btn-chunky rounded-full bg-card px-4 py-2 text-xl font-bold">←</Link>
        <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-grass transition-all" style={{ width: `${(step / day.activities.length) * 100}%` }} />
        </div>
        <span className="font-bold">Dia {d}</span>
      </div>
      <p className="mt-4 text-center text-lg text-muted-foreground">{day.stage} · {day.title}</p>
      <div className="flex flex-1 flex-col items-center justify-center">
        {finished ? <Done d={d} /> : act && <ActivityView key={`${seed}-${step}`} act={act} onNext={() => setStep((s) => s + 1)} />}
      </div>
    </main>
  );
}

function Done({ d }: { d: number }) {
  const nav = useNavigate();
  return (
    <div className="animate-pop text-center">
      <div className="text-9xl">🦜🎉</div>
      <h2 className="mt-4 text-5xl font-extrabold text-primary">Parabéns!</h2>
      <p className="text-xl">Você ganhou uma estrela ⭐</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/" className="btn-chunky rounded-2xl bg-card px-6 py-3 text-xl font-bold">Trilha</Link>
        {d < 30 && <button onClick={() => nav({ to: "/dia/$id", params: { id: String(d + 1) } })} className="btn-chunky rounded-2xl bg-primary px-6 py-3 text-xl font-bold text-primary-foreground">Próximo dia →</button>}
      </div>
    </div>
  );
}

function Mascot({ text, say }: { text: string; say: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <button onClick={() => speak(say)} className="text-6xl" aria-label="Ouvir">🦜</button>
      <div className="rounded-2xl bg-card px-4 py-3 text-xl font-bold">{text}</div>
    </div>
  );
}

function ActivityView({ act, onNext }: { act: Activity; onNext: () => void }) {
  if (act.kind === "listen") return <Listen act={act} onNext={onNext} />;
  if (act.kind === "trace") return <Trace target={act.target} onNext={onNext} />;
  return <Build act={act} onNext={onNext} />;
}

function useFeedback(onNext: () => void) {
  const [state, setState] = useState<"idle" | "ok" | "bad">("idle");
  const ok = () => { setState("ok"); speak("Muito bem!"); setTimeout(onNext, 1100); };
  const bad = () => { setState("bad"); speak("Tente de novo"); setTimeout(() => setState("idle"), 700); };
  return { state, ok, bad };
}

function Listen({ act, onNext }: { act: Extract<Activity, { kind: "listen" }>; onNext: () => void }) {
  const { state, ok, bad } = useFeedback(onNext);
  useEffect(() => { const t = setTimeout(() => speak(act.prompt), 300); return () => clearTimeout(t); }, [act.prompt]);
  return (
    <div className="w-full text-center">
      <Mascot text="Escute e toque no certo!" say={act.prompt} />
      <button onClick={() => speak(act.prompt)} className="btn-chunky mb-8 rounded-full bg-secondary px-8 py-4 text-3xl font-extrabold">🔊 Ouvir</button>
      <div className={`grid grid-cols-2 gap-4 ${state === "bad" ? "animate-wiggle" : ""}`}>
        {act.options.map((o) => (
          <button key={o} onClick={() => (o === act.answer ? ok() : bad())}
            className={`btn-chunky rounded-3xl py-8 text-5xl font-extrabold ${state === "ok" && o === act.answer ? "bg-grass animate-pop" : "bg-card"}`}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function Trace({ target, onNext }: { target: string; onNext: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [ink, setInk] = useState(0);
  useEffect(() => { speak(`Escreva ${target}`); }, [target]);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [(e.clientX - r.left) * (ref.current!.width / r.width), (e.clientY - r.top) * (ref.current!.height / r.height)] as const; };
  const down = (e: React.PointerEvent) => { drawing.current = true; const c = ref.current!.getContext("2d")!; const [x, y] = pos(e); c.beginPath(); c.moveTo(x, y); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = ref.current!.getContext("2d")!;
    c.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--primary"); c.lineWidth = 18; c.lineCap = "round"; c.lineJoin = "round";
    const [x, y] = pos(e); c.lineTo(x, y); c.stroke(); setInk((i) => i + 1);
  };
  const clear = () => { ref.current!.getContext("2d")!.clearRect(0, 0, 400, 400); setInk(0); };
  return (
    <div className="w-full text-center">
      <Mascot text={`Escreva com o dedo: ${target}`} say={`Escreva ${target}`} />
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-card">
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11rem] font-extrabold leading-none text-muted">{target}</span>
        <canvas ref={ref} width={400} height={400} className="relative h-full w-full touch-none"
          onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} onPointerLeave={() => (drawing.current = false)} />
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={clear} className="btn-chunky rounded-2xl bg-card px-6 py-3 text-xl font-bold">Apagar</button>
        <button disabled={ink < 25} onClick={() => { speak("Que lindo!"); setTimeout(onNext, 800); }} className="btn-chunky rounded-2xl bg-primary px-6 py-3 text-xl font-bold text-primary-foreground disabled:opacity-40">Pronto ✓</button>
      </div>
    </div>
  );
}

function Build({ act, onNext }: { act: Extract<Activity, { kind: "build" }>; onNext: () => void }) {
  const { state, ok, bad } = useFeedback(onNext);
  const [picked, setPicked] = useState<number[]>([]);
  useEffect(() => { const t = setTimeout(() => speak(`Monte ${act.answer}`), 300); return () => clearTimeout(t); }, [act.answer]);
  const current = picked.map((i) => act.pieces[i]).join("");
  const tap = (i: number) => {
    const np = [...picked, i]; setPicked(np); speak(act.pieces[i]!);
    const s = np.map((k) => act.pieces[k]).join("");
    if (s === act.answer) ok();
    else if (!act.answer.startsWith(s)) { bad(); setTimeout(() => setPicked([]), 700); }
  };
  return (
    <div className="w-full text-center">
      <Mascot text={`Monte: ${act.answer.toLowerCase()}`} say={act.answer} />
      {act.emoji && <div className="mb-4 text-8xl">{act.emoji}</div>}
      <div className={`mx-auto mb-8 flex min-h-24 items-center justify-center rounded-3xl border-4 border-dashed px-4 text-6xl font-extrabold ${state === "ok" ? "bg-grass animate-pop" : "bg-card"} ${state === "bad" ? "animate-wiggle" : ""}`}>{current || "?"}</div>
      <div className="flex flex-wrap justify-center gap-4">
        {act.pieces.map((p, i) => (
          <button key={i} disabled={picked.includes(i)} onClick={() => tap(i)} className="btn-chunky rounded-2xl bg-sun px-6 py-4 text-4xl font-extrabold disabled:opacity-30">{p}</button>
        ))}
      </div>
    </div>
  );
}
