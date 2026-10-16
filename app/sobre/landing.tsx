"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type Row = Record<string, any>;

function Arrow({ color = "currentColor", size = "0.62em", flip = false }: { color?: string; size?: string; flip?: boolean }) {
  return (
    <svg className="lp-arrow" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={flip ? { transform: "rotate(180deg)" } : undefined}>
      <path d="M3 21 19.5 4.5M7.5 3.5h13v13" stroke={color} strokeWidth="3.4" fill="none" />
    </svg>
  );
}
function Logo({ arrow = "var(--lime)" }: { arrow?: string }) {
  return (
    <span className="lp-logo">
      hacko
      <Arrow color={arrow} />
    </span>
  );
}
// Faixa de setas da identidade, passando na horizontal.
function Pattern() {
  return <div className="lp-pattern" aria-hidden="true" />;
}

const LOGIN = "/#/login";
const COMPANY_LOGIN = "/#/login?tipo=empresa";
const NAV = [
  ["participantes", "Participantes"],
  ["empresas", "Empresas"],
  ["planos", "Planos"],
  ["faq", "Dúvidas"],
  ["contato", "Contato"],
];

const PLANS = [
  {
    name: "Plano básico",
    price: "Grátis",
    note: "para começar",
    items: ["1 hackathon ativo por vez", "Até 100 inscritos", "Formação de equipes no site", "Entregas com links"],
    cta: ["Começar grátis", COMPANY_LOGIN],
  },
  {
    name: "Plano Médio",
    price: "R$ 149",
    note: "por mês",
    items: ["3 hackathons ativos", "Até 500 inscritos por evento", "Entregas com fotos e PDFs", "Painel de equipes e validação", "Logo da empresa no evento"],
    cta: ["Assinar", COMPANY_LOGIN],
  },
  {
    name: "Plano premium",
    price: "R$ 399",
    note: "por mês",
    items: ["Hackathons ilimitados", "Inscritos ilimitados", "Destaque na página inicial", "Exportação de dados", "Suporte prioritário"],
    cta: ["Falar com a equipe", "mailto:suporte@hacko.com.br?subject=Plano%20premium"],
    featured: true,
  },
];

const FAQ = [
  ["Preciso pagar para participar de um hackathon?", "Não. Para participantes o hacko é gratuito: crie sua conta, complete o perfil e se inscreva nos hackathons abertos."],
  ["Como monto a minha equipe?", "Depois de se inscrever no evento, você pode criar uma equipe ou pedir para entrar em uma existente. O líder aceita os pedidos, seguindo o tamanho mínimo e máximo definido pela empresa."],
  ["Como faço a entrega do projeto?", "Qualquer integrante anexa fotos, PDFs e links na página da equipe. O líder confirma o envio e a empresa valida a entrega pelo painel."],
  ["Sou uma empresa. Como publico um hackathon?", "Crie uma conta de empresa, preencha o perfil da organização e cadastre o evento com datas, regras de equipe e prazo de entrega. Você acompanha inscritos, equipes e entregas em um só lugar."],
];

function fmtDay(s?: string) {
  return s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") : "";
}
function coverOf(e: Row) {
  if (e.cover_v) return `/api/hacko?action=image&id=${encodeURIComponent("cover:" + e.id)}&v=${encodeURIComponent(e.cover_v)}`;
  const n = Number(e.image) || 0;
  return n === 3 ? "/brand/cover.svg" : `/assets/photo${n}.jpg`;
}
function stateOf(e: Row) {
  const t = Date.now();
  if (t < Date.parse(e.opens_at)) return "Em breve";
  if (t < Date.parse(e.closes_at)) return "Inscrições abertas";
  if (t < Date.parse(e.starts_at)) return "Inscrições encerradas";
  return "Acontecendo agora";
}

function Carousel() {
  const [events, setEvents] = useState<Row[] | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  // Atualiza sozinho: busca ao abrir e a cada 5 minutos.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/hacko?action=featured")
        .then((r) => (r.ok ? (r.json() as Promise<{ events?: Row[] }>) : { events: [] }))
        .then((d) => alive && setEvents(d.events || []))
        .catch(() => alive && setEvents((v) => v || []));
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // A faixa preta termina na linha entre a imagem e o texto dos cards.
  useEffect(() => {
    const img = track.current?.querySelector("img");
    const band = track.current?.closest<HTMLElement>(".lp-band");
    if (!img || !band) return;
    const sync = () => band.style.setProperty("--cut", `${img.offsetTop + img.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(img);
    return () => ro.disconnect();
  }, [events]);

  const count = events?.length || 0;
  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el || !count) return;
      const next = (i + count) % count;
      const card = el.children[next] as HTMLElement | undefined;
      if (card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
      setIndex(next);
    },
    [count],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    const t = setInterval(() => go(index + 1), 5000);
    return () => clearInterval(t);
  }, [paused, count, index, go]);

  const onScroll = () => {
    const el = track.current;
    if (!el || !count) return;
    const w = (el.children[0] as HTMLElement)?.offsetWidth || 1;
    setIndex(Math.min(count - 1, Math.round(el.scrollLeft / (w + 20))));
  };

  if (events === null) return <div className="lp-carousel-empty">Carregando hackathons…</div>;
  if (!count)
    return (
      <div className="lp-carousel-empty">
        Novos hackathons em breve. <a href={LOGIN}>Crie sua conta</a> para ser avisado.
      </div>
    );

  return (
    <div className="lp-carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="lp-track" ref={track} onScroll={onScroll} aria-label="Hackathons em destaque">
        {events.map((e) => (
          <a key={e.id} className="lp-event" href={`/#/event/${e.id}`}>
            <img src={coverOf(e)} alt="" loading="lazy" />
            <div className="lp-event-body">
              <small>
                {(e.format || "").toUpperCase()} · {fmtDay(e.starts_at)}
                {e.ends_at && e.ends_at.slice(0, 10) !== e.starts_at?.slice(0, 10) ? ` – ${fmtDay(e.ends_at)}` : ""}
              </small>
              <b>{e.title}</b>
              <span>
                {e.organization}
                {e.city ? ` · ${e.city}` : ""}
              </span>
              <div className="lp-event-foot">
                <em>{stateOf(e)}</em>
                <span>{e.participants} inscritos</span>
              </div>
            </div>
          </a>
        ))}
      </div>
      {count > 1 && (
        <div className="lp-carousel-nav">
          <button type="button" aria-label="Anterior" onClick={() => go(index - 1)}>
            <Arrow flip size="14px" />
          </button>
          <div className="lp-dots">
            {events.map((e, i) => (
              <button key={e.id} type="button" aria-label={`Ir para ${e.title}`} className={i === index ? "on" : ""} onClick={() => go(i)} />
            ))}
          </div>
          <button type="button" aria-label="Próximo" onClick={() => go(index + 1)}>
            <Arrow size="14px" />
          </button>
        </div>
      )}
    </div>
  );
}

// Prints reais da plataforma, recortados na borda da seção para dar profundidade.
function Shot({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={"lp-shot " + className} data-reveal>
      <img src={src} alt={alt} loading="lazy" />
    </div>
  );
}

// Elementos com data-reveal sobem suavemente ao entrar na tela.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!("IntersectionObserver" in window)) return els.forEach((el) => el.classList.add("in"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function Landing() {
  const [menu, setMenu] = useState(false);
  useReveal();
  return (
    <div className="lp">
      <header className="lp-nav">
        <a href="#inicio" className="lp-nav-logo" aria-label="hacko, início">
          <Logo />
        </a>
        <button type="button" className="lp-burger" aria-expanded={menu} aria-label="Menu" onClick={() => setMenu(!menu)}>
          <span />
          <span />
        </button>
        <nav className={menu ? "open" : ""} onClick={() => setMenu(false)}>
          <div className="lp-nav-links">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </div>
          <a className="lp-btn white sm" href={LOGIN}>
            Login <Arrow color="var(--blue)" />
          </a>
        </nav>
      </header>

      <section id="inicio" className="lp-hero">
        <div className="lp-wrap">
          <h1 data-reveal>
            O seu próximo <span className="lime">desafio</span> é aqui
          </h1>
          <div className="lp-hero-grid">
            <div className="lp-hero-text" data-reveal>
              <p className="lp-lead">Encontre hackathons, monte sua equipe e tire suas ideias do papel!</p>
              <a className="lp-btn white" href={LOGIN}>
                Login <Arrow color="var(--blue)" />
              </a>
              <p className="lp-label">Entenda o hacko:</p>
              <a className="lp-btn lime" href="#participantes">
                Para participantes
              </a>
              <a className="lp-btn blue" href="#empresas">
                Para empresas
              </a>
            </div>
            <Shot src="/landing/explorar.png" alt="Página Explorar do hacko com hackathons para você" className="bleed-right bleed-bottom" />
          </div>
        </div>
      </section>

      <section id="participantes" className="lp-part">
        <div className="lp-wrap lp-part-top">
          <div className="lp-head" data-reveal>
            <h2>
              Para participantes <Arrow color="var(--lime)" />
            </h2>
            <Logo />
          </div>
          <p className="lp-center" data-reveal>
            No hacko, você encontra os hackathons acontecendo na sua cidade, podendo filtrar por presenciais, híbridos, online e pela data do evento.
          </p>
        </div>
        <div className="lp-band">
          <div className="lp-wrap">
            <Carousel />
          </div>
        </div>
        <div className="lp-part-bottom">
          <div className="lp-wrap">
            <p className="lp-center" data-reveal>
              Após fazer login na plataforma, o participante pode buscar outros participantes no mesmo evento para formar equipes variadas e fazer networking!
            </p>
            <div className="lp-split">
              <Shot src="/landing/comunidade.png" alt="Página Comunidade do hacko com perfis de participantes" className="bleed-left bleed-bottom" />
              <div className="lp-split-text" data-reveal>
                <p className="lp-big">Interaja e faça parte de uma comunidade que adora inovar e botar a mão na massa!</p>
                <p className="lp-big">Tudo isso fácil, rápido e de graça!</p>
                <a className="lp-btn white" href={LOGIN}>
                  Login <Arrow color="var(--blue)" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="empresas" className="lp-comp">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <h2>
              Para empresas <Arrow color="var(--lime)" />
            </h2>
            <Logo />
          </div>
          <div className="lp-split reverse">
            <div className="lp-split-text" data-reveal>
              <p>
                No hacko, os participantes se inscrevem diretamente no seu hackathon, onde podem se organizar em equipes pelo próprio site de acordo com as regras estabelecidas por você!
              </p>
              <p>Acompanhe os participantes, equipes e entregas tudo no mesmo local, de forma organizada e automatizada!</p>
              <p>O hacko conta com várias ferramentas facilitadoras que vão deixar os seus eventos cada vez mais inovadores!</p>
              <div className="lp-row">
                <a className="lp-btn lime" href="#planos">
                  Conheça os planos
                </a>
                <a className="lp-btn white" href={COMPANY_LOGIN}>
                  Login com plano grátis <Arrow color="var(--blue)" />
                </a>
              </div>
            </div>
            <Shot src="/landing/painel.png" alt="Painel da organização com participantes, equipes e entregas" className="bleed-right bleed-bottom" />
          </div>
        </div>
      </section>

      <section id="planos" className="lp-plans">
        <div className="lp-wrap">
          <div className="lp-head" data-reveal>
            <h2>
              Confira os planos <Arrow color="var(--blue)" />
            </h2>
            <Logo arrow="var(--blue)" />
          </div>
          <div className="lp-plan-grid">
            {PLANS.map((p) => (
              <article key={p.name} className={"lp-plan" + (p.featured ? " featured" : "")} data-reveal>
                <h3>{p.name}</h3>
                <p className="lp-price">
                  {p.price} <small>{p.note}</small>
                </p>
                <ul>
                  {p.items.map((i) => (
                    <li key={i}>
                      <Arrow /> {i}
                    </li>
                  ))}
                </ul>
                <a className={"lp-btn " + (p.featured ? "dark" : "white")} href={p.cta[1]}>
                  {p.cta[0]}
                </a>
              </article>
            ))}
          </div>
          <p className="lp-fine">Valores ilustrativos, sujeitos a alteração.</p>
          <div className="lp-row center">
            <a className="lp-btn blue" href="mailto:suporte@hacko.com.br?subject=Planos%20hacko">
              Entre em contato
            </a>
            <a className="lp-btn outline" href={COMPANY_LOGIN}>
              Login <Arrow color="var(--blue)" />
            </a>
          </div>
        </div>
      </section>

      <section id="faq" className="lp-faq">
        <Pattern />
        <div className="lp-wrap narrow">
          <h2 data-reveal>
            Perguntas Frequentes <Arrow color="var(--lime)" />
          </h2>
          {FAQ.map(([q, a]) => (
            <details key={q} data-reveal>
              <summary>
                <Arrow color="var(--lime)" /> {q}
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer id="contato" className="lp-foot">
        <div className="lp-wrap">
          <Logo arrow="var(--blue)" />
          <p className="lp-foot-tag">
            O seu próximo <span className="blue">desafio</span> é aqui
          </p>
          <a className="lp-btn blue" href={LOGIN}>
            Faça parte da comunidade <Arrow color="var(--lime)" />
          </a>
          <div className="lp-contacts">
            <a href="https://instagram.com/hacko" target="_blank" rel="noreferrer">
              @hacko
            </a>
            <a href="mailto:suporte@hacko.com.br">suporte@hacko.com.br</a>
            <a href="https://wa.me/5500000000000" target="_blank" rel="noreferrer">
              Whatsapp
            </a>
          </div>
          <div className="lp-legal">
            <a href="/privacidade">Privacidade</a>
            <a href="/termos">Termos</a>
            <a href="/">Abrir a plataforma</a>
          </div>
        </div>
        <Pattern />
      </footer>
    </div>
  );
}
