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
function Pattern({ rows = 2 }: { rows?: number }) {
  return <div className="lp-pattern" style={{ height: rows * 30 }} aria-hidden="true" />;
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

// Anúncios fictícios até os primeiros parceiros entrarem.
const ADS = [
  { tag: "Patrocinado", title: "Nuvem Sul", text: "Créditos de cloud para equipes participantes de hackathons.", cta: "Saiba mais" },
  { tag: "Parceiro", title: "Escola Byte", text: "Cursos rápidos de React, dados e IA com desconto para a comunidade hacko.", cta: "Ver cursos" },
  { tag: "Patrocinado", title: "Café Commit", text: "Café especial para maratonas de código. Frete grátis para eventos.", cta: "Conhecer" },
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

function BrowserMock({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={"lp-browser" + (dark ? " dark" : "")} aria-hidden="true">
      <div className="lp-browser-bar">
        <Logo />
        <i />
        <i />
        <i />
      </div>
      {children}
    </div>
  );
}

export default function Landing() {
  const [menu, setMenu] = useState(false);
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
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
          <a className="lp-btn white sm" href={LOGIN}>
            Login <Arrow color="var(--blue)" />
          </a>
        </nav>
      </header>

      <section id="inicio" className="lp-hero">
        <div className="lp-wrap">
          <h1>
            O seu próximo <span className="lime">desafio</span> é aqui
          </h1>
          <div className="lp-hero-grid">
            <div className="lp-hero-text">
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
              <a className="lp-btn white" href="#contato">
                Contatos
              </a>
            </div>
            <BrowserMock>
              <div className="lp-mock-hero">
                <span className="lp-chip">HACKATHONS · EQUIPES · ENTREGAS</span>
                <b>Seu próximo grande desafio começa aqui.</b>
                <span className="lp-mock-btn">Encontrar minha equipe ↗</span>
                <div className="lp-mock-arrows">
                  <Arrow color="var(--lime)" />
                  <Arrow color="var(--lime)" />
                </div>
              </div>
              <div className="lp-mock-list">
                <b>Hackathons para você</b>
                <div className="lp-mock-filters">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </BrowserMock>
          </div>
        </div>
      </section>

      <section id="participantes" className="lp-part">
        <div className="lp-part-top">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>
                Para participantes <Arrow color="var(--lime)" />
              </h2>
              <Logo />
            </div>
            <p className="lp-center">
              No hacko, você encontra os hackathons acontecendo na sua cidade, podendo filtrar por presenciais, híbridos, online e pela data do evento.
            </p>
          </div>
        </div>
        <div className="lp-part-bottom">
          <div className="lp-wrap">
            <Carousel />
            <p className="lp-center">
              Após fazer login na plataforma, o participante pode buscar outros participantes no mesmo evento para formar equipes variadas e fazer networking!
            </p>
            <div className="lp-split">
              <BrowserMock>
                <div className="lp-mock-conn">
                  <small>COMUNIDADE</small>
                  <b>Sua próxima conexão.</b>
                  <div className="lp-mock-people">
                    {["Ana Martins", "Ian Santiago"].map((n) => (
                      <div key={n}>
                        <span className="lp-avatar">{n[0]}</span>
                        <b>{n}</b>
                        <small>Front-end · Dados</small>
                      </div>
                    ))}
                  </div>
                </div>
              </BrowserMock>
              <div>
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

      <section className="lp-ads" aria-label="Anúncios">
        <div className="lp-wrap">
          <p className="lp-label dark">Anúncios e parceiros</p>
          <div className="lp-ads-grid">
            {ADS.map((a) => (
              <article key={a.title} className="lp-ad">
                <small>{a.tag}</small>
                <b>{a.title}</b>
                <p>{a.text}</p>
                <span className="lp-ad-cta">
                  {a.cta} <Arrow />
                </span>
              </article>
            ))}
            <a className="lp-ad lp-ad-own" href="mailto:suporte@hacko.com.br?subject=Anunciar%20no%20hacko">
              <small>Sua marca aqui</small>
              <b>Anuncie no hacko</b>
              <p>Fale com quem cria, programa e inova em hackathons pelo Brasil.</p>
              <span className="lp-ad-cta">
                Quero anunciar <Arrow />
              </span>
            </a>
          </div>
        </div>
      </section>

      <section id="empresas" className="lp-comp">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Para empresas <Arrow color="var(--lime)" />
            </h2>
            <Logo />
          </div>
          <div className="lp-split">
            <div>
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
            <div className="lp-dash" aria-hidden="true">
              <aside>
                <Logo />
                <i />
                <i />
                <i />
                <i />
              </aside>
              <div>
                <small>ORGANIZAÇÃO · PAINEL DO EVENTO</small>
                <b>Tudo sob controle.</b>
                <div className="lp-stats">
                  {[
                    ["Inscritos", "248"],
                    ["Equipes", "52"],
                    ["Entregas", "38"],
                  ].map(([k, v]) => (
                    <span key={k}>
                      {k}
                      <b>{v}</b>
                    </span>
                  ))}
                </div>
                <div className="lp-table">
                  <small>Equipes e entregas</small>
                  {[
                    ["Pixel Norte", "Validada", "ok"],
                    ["Code Rio", "Em validação", "wait"],
                    ["Dados Vivos", "Aguardando envio", "none"],
                    ["Nova Ágil", "Revisar envio", "fix"],
                  ].map(([t, s, c]) => (
                    <div key={t}>
                      <span>{t}</span>
                      <em className={c}>{s}</em>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="planos" className="lp-plans">
        <div className="lp-wrap">
          <div className="lp-head">
            <h2>
              Confira os planos <Arrow color="var(--blue)" />
            </h2>
            <Logo arrow="var(--blue)" />
          </div>
          <div className="lp-plan-grid">
            {PLANS.map((p) => (
              <article key={p.name} className={"lp-plan" + (p.featured ? " featured" : "")}>
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
          <h2>
            Perguntas Frequentes <Arrow color="var(--lime)" />
          </h2>
          {FAQ.map(([q, a]) => (
            <details key={q}>
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
