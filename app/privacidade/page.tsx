import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalPage } from "../../components/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade — Hacko",
  description: "Como a Hacko coleta, usa e protege seus dados pessoais.",
};

export default function Privacidade() {
  return (
    <LegalPage
      title="Política de Privacidade"
      intro="Esta política explica quais dados pessoais a Hacko (hacko.com.br) coleta, por que coleta, com quem compartilha e quais são os seus direitos, de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)."
    >
      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>
          <b>Conta:</b> e-mail e senha. A senha é guardada apenas de forma cifrada (hash), nunca em texto
          puro.
        </li>
        <li>
          <b>Login com Google, GitHub ou LinkedIn:</b> nome, e-mail verificado e um identificador da sua conta
          nesse serviço. Não recebemos sua senha desses serviços.
        </li>
        <li>
          <b>Perfil:</b> o que você decidir informar — nome, cidade, bio, competências, interesses,
          disponibilidade, links (LinkedIn, GitHub) e foto de perfil.
        </li>
        <li>
          <b>Uso da plataforma:</b> inscrições em hackathons, equipes, convites e solicitações, eventos
          favoritos, notificações e, para organizações, os eventos e imagens de capa publicados.
        </li>
        <li>
          <b>Dados técnicos:</b> um cookie de sessão necessário para manter você conectado, registros de
          tentativas de login (para proteger contra ataques) e registros técnicos de acesso mantidos pela
          nossa infraestrutura.
        </li>
      </ul>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Criar e manter sua conta e permitir o login (execução de contrato).</li>
        <li>
          Permitir inscrições, formação de equipes e a organização de hackathons, incluindo sugestões de
          equipes com base nas competências e disponibilidade informadas (execução de contrato).
        </li>
        <li>Proteger a plataforma contra fraudes e acessos indevidos (legítimo interesse).</li>
        <li>Cumprir obrigações legais, quando houver.</li>
      </ul>
      <p>Não vendemos seus dados e não usamos seus dados para publicidade.</p>

      <h2>3. Quem vê seus dados</h2>
      <ul>
        <li>
          <b>Outros participantes:</b> só veem seu perfil se você ativar a opção de perfil visível. Seu e-mail
          nunca é exibido para outros participantes.
        </li>
        <li>
          <b>Organizadores:</b> ao se inscrever em um hackathon, seu perfil e e-mail são compartilhados com a
          organização responsável por ele, para administrar a inscrição.
        </li>
        <li>
          <b>Fornecedores:</b> usamos a Cloudflare para hospedagem e banco de dados, e a OpenAI para a
          ferramenta de busca de oportunidades (Radar), que recebe apenas o texto da busca digitada. Esses
          fornecedores podem processar dados fora do Brasil, com garantias contratuais de proteção.
        </li>
      </ul>

      <h2>4. Cookies</h2>
      <p>
        Usamos apenas cookies essenciais: o de sessão (mantém você conectado por até 30 dias) e um cookie
        temporário durante o login com Google, GitHub ou LinkedIn. Não usamos cookies de publicidade ou de
        rastreamento.
      </p>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>
        Mantemos seus dados enquanto sua conta existir. Sessões expiram em 30 dias e registros de tentativas
        de login são descartados periodicamente. Ao excluir a conta, apagamos seus dados, exceto o que
        precisarmos manter por obrigação legal.
      </p>

      <h2>6. Seus direitos</h2>
      <p>
        Você pode pedir a qualquer momento: confirmação e acesso aos seus dados, correção, exclusão da conta e
        dos dados, portabilidade, informações sobre compartilhamento e revogação de consentimento. Boa parte
        dos dados pode ser editada direto no seu perfil. Para os demais pedidos, escreva para{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Você também pode reclamar à Autoridade
        Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>7. Segurança</h2>
      <p>
        Usamos conexão cifrada (HTTPS), senhas com hash, cookies protegidos e controle de acesso por conta e
        por organização. Nenhum sistema é totalmente imune a falhas; se ocorrer um incidente relevante,
        avisaremos os afetados e a ANPD conforme a lei.
      </p>

      <h2>8. Menores de idade</h2>
      <p>
        A Hacko é destinada a maiores de 16 anos. Menores de 18 anos devem ter autorização dos pais ou
        responsáveis para participar de hackathons, conforme as regras de cada evento.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Podemos atualizar esta política. Mudanças importantes serão avisadas na plataforma, e a data no topo
        indica a última versão.
      </p>
    </LegalPage>
  );
}
