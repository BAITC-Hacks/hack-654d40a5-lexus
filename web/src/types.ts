import { errorText, responseJSON } from "./http-errors";
export type Lang = "ru" | "kk" | "en";
export type Fields = Record<string, string>;
export type User = {
  id: string;
  name: string;
  role: "business" | "student" | "admin" | "pending";
  email: string;
  organization?: string;
  description?: string;
  teamId: string;
  plan: string;
};
export type LanguageAudit = {
  warning: boolean;
  expected: string;
  detected: string;
  reason?: string;
  method?: string;
};
export type Attachment = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  at: string;
  audit: LanguageAudit;
  auditScope: string;
};
export type Version = {
  attachmentIds?: string[];
  languagePenalty?: number;
  coverId?: string;
  number: number;
  fields: Fields;
  approved: Fields;
  score: number;
  at: string;
  note: string;
};
export type Challenge = {
  attachmentIds?: string[];
  languageAudit?: LanguageAudit;
  languagePenalty?: number;
  languageAcknowledged?: string;
  coverId?: string;
  id: string;
  ownerId: string;
  company: string;
  category: string;
  locale: Lang;
  fields: Fields;
  approved: Fields;
  revision: number;
  versions: Version[];
  score: number;
  published: boolean;
  createdAt: string;
  activity: { kind: string; at: string; detail: string }[];
};
export type Review = {
  proposalId: string;
  challengeId: string;
  company: string;
  stars: number;
  text: string;
  at: string;
};
export type Team = {
  id: string;
  name: string;
  description: string;
  university: string;
  skills: string[];
  members: number;
  color: string;
  emoji: string;
  xp: number;
  reviews: Review[];
};
export type Proposal = {
  attachmentIds?: string[];
  submissionAttachmentIds?: string[];
  languageWarning?: boolean;
  id: string;
  challengeId: string;
  version: number;
  teamId: string;
  idea: string;
  plan: string;
  deadline: string;
  link: string;
  status: string;
  submission: string;
  milestone: boolean;
  at: string;
};
export type Notice = {
  id: string;
  challengeId: string;
  version: number;
  kind: string;
  read: boolean;
  at: string;
};
export type Media = {
  id: string;
  challengeId: string;
  version: number;
  locale: Lang;
  status: string;
  script: string;
  url: string;
  previewUrl: string;
  error: string;
  at: string;
};
export type Data = {
  attachments: Attachment[];
  user: User | null;
  challenges: Challenge[];
  teams: Team[];
  proposals: Proposal[];
  notifications: Notice[];
  media: Media[];
  criteria: { id: string; weight: number; fields: string[] }[];
  capabilities: { ai: boolean; speech: boolean; images: boolean };
};
export const fieldKeys = [
  "title",
  "context",
  "need",
  "users",
  "data",
  "constraints",
  "result",
  "success",
  "contact",
  "interaction",
];
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((error: unknown) => { throw new Error(errorText(error)); });
  return responseJSON<T>(r);
}
