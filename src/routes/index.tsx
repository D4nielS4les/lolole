import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { buildDay, getDone } from "@/lib/lessons";
import { speak } from "@/lib/audio";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Lololê — Aprender a ler brincando" },
    { name: "description", content: "Jogo fônico com trilha de 30 dias: sons, sílabas e palavras." },
    { property: "og:title", content: "Lololê — Aprender a ler brincando" },
    { property: "og:description", content: "Jogo fônico com trilha de 30 dias: sons, sílabas e palavras." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Index,
});

const stageColor = { Sons: "bg-sun", "Sílabas": "bg-sky", Palavras: "bg-grass" } as const;

function Index() {
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => setDone(getDone()), []);
  const next = Math.min(30, (done.length ? Math.max(...done) : 0) + 1);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="text-center">
        <button onClick={() => speak("Oi! Eu sou o Lololê! Vamos aprender a ler?")} className="animate-pop text-8xl" aria-label="Lololê fala">🦜</button>
        <h1 className="text-6xl font-extrabold text-primary">Lololê</h1>
        <p className="mt-2 text-xl text-muted-foreground">Escute, toque e aprenda a ler brincando!</p>
        <p className="mt-4 inline-block rounded-full bg-card px-5 py-2 text-lg font-bold">⭐ {done.length} / 30 dias</p>
      </header>
      {(["Sons", "Sílabas", "Palavras"] as const).map((stage, si) => (
        <section key={stage} className="mt-10">
          <h2 className="mb-4 text-3xl font-extrabold">{si + 1}. {stage}</h2>
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 10 }, (_, i) => si * 10 + i + 1).map((d) => {
              const locked = d > next;
              const ok = done.includes(d);
              const body = (
                <div className={`btn-chunky flex aspect-square flex-col items-center justify-center rounded-2xl text-2xl font-extrabold ${locked ? "bg-muted text-muted-foreground" : stageColor[stage]} ${d === next ? "animate-wiggle ring-4 ring-primary" : ""}`}>
                  {locked ? "🔒" : ok ? "⭐" : d}
                  <span className="text-xs font-bold">{buildDay(d).title.split(" ").slice(-1)}</span>
                </div>
              );
              return locked ? <div key={d}>{body}</div> : <Link key={d} to="/dia/$id" params={{ id: String(d) }}>{body}</Link>;
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
