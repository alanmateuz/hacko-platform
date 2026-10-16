import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, uniqueIndex, check } from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  bio: text("bio").notNull().default(""),
  skills: text("skills").notNull().default(""),
  interests: text("interests").notNull().default(""),
  city: text("city").notNull().default(""),
  availability: text("availability").notNull().default(""),
  linkedin: text("linkedin").notNull().default(""),
  github: text("github").notNull().default(""),
  portfolio: text("portfolio").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  school: text("school").notNull().default(""),
  workplace: text("workplace").notNull().default(""),
  area: text("area").notNull().default(""),
  cardTheme: text("card_theme").notNull().default("blue"),
  visible: integer("visible").notNull().default(0),
});
export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id),
  description: text("description").notNull().default(""),
  // Perfil da empresa (contas do tipo "company").
  website: text("website").notNull().default(""),
  cnpj: text("cnpj").notNull().default(""),
  city: text("city").notNull().default(""),
  linkedin: text("linkedin").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  contactRole: text("contact_role").notNull().default(""),
});
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  rules: text("rules").notNull(),
  eligibility: text("eligibility").notNull(),
  format: text("format").notNull(),
  city: text("city").notNull(),
  venue: text("venue").notNull(),
  theme: text("theme").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  opensAt: text("opens_at").notNull(),
  closesAt: text("closes_at").notNull(),
  // Prazo de entrega dos projetos; vazio = fim do evento.
  submissionDeadline: text("submission_deadline").notNull().default(""),
  capacity: integer("capacity").notNull(),
  teamMin: integer("team_min").notNull(),
  teamMax: integer("team_max").notNull(),
  image: integer("image").notNull().default(0),
  source: text("source").notNull().default(""),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull(),
});
export const registrations = sqliteTable(
  "registrations",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);
export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  leaderId: text("leader_id")
    .notNull()
    .references(() => profiles.id),
  name: text("name").notNull(),
  skills: text("skills").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("forming"),
  cardTheme: text("card_theme").notNull().default("blue"),
  // Áreas que a equipe procura (DEV, DESIGN, MARKETING, NEGÓCIOS), separadas por vírgula.
  areas: text("areas").notNull().default(""),
  // Entrega do projeto: none | submitted | reviewing | evaluated | pending.
  submissionStatus: text("submission_status").notNull().default("none"),
  submissionUrl: text("submission_url").notNull().default(""),
  submissionNote: text("submission_note").notNull().default(""),
  submittedAt: text("submitted_at"),
  reviewNote: text("review_note").notNull().default(""),
  reviewedAt: text("reviewed_at"),
});
export const members = sqliteTable(
  "team_members",
  {
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    uniqueIndex("one_team_per_event").on(t.eventId, t.userId),
  ],
);
export const requests = sqliteTable("team_requests", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => profiles.id),
  message: text("message").notNull(),
  read: integer("read").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
export const audits = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  createdAt: text("created_at").notNull(),
});
export const matchingRuns = sqliteTable("matching_runs", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  payload: text("payload").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull(),
});
export const matchingApprovals = sqliteTable("matching_approvals", {
  runId: text("run_id")
    .primaryKey()
    .references(() => matchingRuns.id),
  actorId: text("actor_id").notNull(),
  createdAt: text("created_at").notNull(),
});
export const favorites = sqliteTable(
  "favorites",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id),
    userId: text("user_id")
      .notNull()
      .references(() => profiles.id),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

export const operationChecks = sqliteTable(
  "operation_checks",
  { name: text("name").primaryKey(), valid: integer("valid").notNull() },
  (t) => [check("atomic_guard", sql`${t.valid} = 1`)],
);
// Uploaded event covers ("cover:<eventId>") and profile photos ("avatar:<userId>"), base64-encoded.
export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  mime: text("mime").notNull(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});
// Hacko accounts (replaces the ChatGPT-hosted identity). profiles.id === users.id.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  // pbkdf2$<iterações>$<salt>$<hash>; nulo para contas só com Google/GitHub/LinkedIn.
  passwordHash: text("password_hash"),
  // 1 quando o e-mail foi confirmado por um provedor OAuth.
  emailVerified: integer("email_verified").notNull().default(0),
  // "participant" (participa de hackathons) ou "company" (só organiza).
  accountType: text("account_type").notNull().default("participant"),
  createdAt: text("created_at").notNull(),
});
// Linked sign-in methods: provider = google | github | linkedin | email.
export const identities = sqliteTable(
  "identities",
  {
    provider: text("provider").notNull(),
    subject: text("subject").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.provider, t.subject] })],
);
// Session and magic-link ids are SHA-256 hashes of the secret tokens.
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});
// Tentativas de login com senha que falharam (limite por e-mail).
export const loginFailures = sqliteTable("login_failures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull(),
});
// Pedidos de redefinição de senha; id = SHA-256 do token enviado por e-mail.
export const passwordResets = sqliteTable("password_resets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
});
// Itens da entrega de uma equipe: arquivos (guardados no R2) ou links.
export const deliveryItems = sqliteTable("delivery_items", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  kind: text("kind").notNull(), // "file" ou "link"
  name: text("name").notNull(),
  mime: text("mime").notNull().default(""),
  size: integer("size").notNull().default(0),
  url: text("url").notNull().default(""),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: text("created_at").notNull(),
});
