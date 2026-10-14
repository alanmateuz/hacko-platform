import type { ReactNode } from "react";

// Contato público de privacidade/suporte (o mesmo informado na tela de consentimento do Google).
export const CONTACT_EMAIL = "ianeusantiago@gmail.com";
export const UPDATED_AT = "14 de outubro de 2026";

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <>
      <header>
        <a href="/" className="logo" aria-label="Hacko — início">
          <span className="wordmark">
            hacko
            <svg
              className="brand-arrow"
              width="0.62em"
              height="0.62em"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 21 19.5 4.5M7.5 3.5h13v13" stroke="var(--lime)" strokeWidth="3.4" fill="none" />
            </svg>
          </span>
        </a>
        <nav aria-label="Documentos">
          <a href="/privacidade">Privacidade</a>
          <a href="/termos">Termos de uso</a>
        </nav>
      </header>
      <main className="container legal">
        <span className="eyebrow">DOCUMENTOS DA HACKO</span>
        <h1>{title}</h1>
        <p className="legal-meta">Última atualização: {UPDATED_AT}</p>
        <p>{intro}</p>
        {children}
        <p className="legal-meta">
          Dúvidas: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ·{" "}
          <a href="/">Voltar para a Hacko</a>
        </p>
      </main>
    </>
  );
}
