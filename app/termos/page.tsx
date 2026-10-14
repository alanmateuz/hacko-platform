import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "../../components/legal-page";

export const metadata: Metadata = {
  title: "Termos de Uso — Hacko",
  description: "Regras para usar a plataforma Hacko.",
};

export default function Termos() {
  return (
    <LegalPage
      title="Termos de Uso"
      intro="Estes termos valem para quem usa a Hacko (hacko.com.br), seja para participar ou para organizar hackathons. Ao criar uma conta, você concorda com eles e com a Política de Privacidade."
    >
      <h2>1. O que é a Hacko</h2>
      <p>
        A Hacko é uma plataforma para encontrar hackathons, se inscrever, formar equipes e organizar desafios.
        A Hacko não é organizadora dos eventos publicados por terceiros: cada organização é responsável pelo
        seu evento, regulamento, premiação e comunicação com os participantes.
      </p>

      <h2>2. Sua conta</h2>
      <ul>
        <li>Você precisa ter pelo menos 16 anos e informar dados verdadeiros.</li>
        <li>
          Você é responsável por manter sua senha em segredo e pelas ações feitas com a sua conta. Avise-nos
          se suspeitar de uso indevido.
        </li>
        <li>Uma pessoa pode ter uma conta e administrar suas próprias organizações.</li>
      </ul>

      <h2>3. Regras de uso</h2>
      <p>Não é permitido:</p>
      <ul>
        <li>
          publicar conteúdo ilegal, ofensivo, discriminatório, enganoso ou que viole direitos de terceiros;
        </li>
        <li>
          criar eventos falsos ou usar a plataforma para golpes, spam ou coleta de dados de outras pessoas;
        </li>
        <li>tentar acessar contas, dados ou áreas sem autorização, ou prejudicar o funcionamento do site;</li>
        <li>enviar imagens (capas e fotos) que você não tenha direito de usar.</li>
      </ul>

      <h2>4. Organizadores</h2>
      <ul>
        <li>
          Quem publica um hackathon garante que as informações (datas, local, vagas, regulamento e
          elegibilidade) são verdadeiras e que cumprirá o que anunciou.
        </li>
        <li>
          Os dados dos inscritos devem ser usados apenas para administrar o evento, de acordo com a LGPD.
        </li>
      </ul>

      <h2>5. Seu conteúdo</h2>
      <p>
        O que você publica continua sendo seu. Você nos autoriza a exibir esse conteúdo na plataforma apenas
        para que ela funcione (por exemplo, mostrar a capa de um evento ou seu perfil, se for público).
      </p>

      <h2>6. Ferramentas automáticas</h2>
      <p>
        Recursos como sugestões de equipes e a busca de oportunidades (Radar) são automáticos e podem conter
        erros. Confira sempre as informações nas fontes oficiais de cada evento.
      </p>

      <h2>7. Suspensão e encerramento</h2>
      <p>
        Podemos remover conteúdos ou suspender contas que violem estes termos. Você pode pedir a exclusão da
        sua conta a qualquer momento pelo e-mail <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>8. Disponibilidade e responsabilidade</h2>
      <p>
        Trabalhamos para manter a Hacko no ar e segura, mas o serviço é oferecido como está e pode ter
        interrupções. A Hacko não se responsabiliza por eventos organizados por terceiros, nem por acordos
        entre participantes e organizadores.
      </p>

      <h2>9. Alterações e lei aplicável</h2>
      <p>
        Podemos atualizar estes termos e avisaremos mudanças importantes na plataforma. Estes termos seguem as
        leis do Brasil.
      </p>
    </LegalPage>
  );
}
