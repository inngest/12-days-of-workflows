import type { Chaos } from "@12days/shared";
import { FIELDS, type FieldId, type Profile } from "./profiles.js";

// Turns what the form says into the day's real events. Same event names and fields as the
// day's send.ts; the studio only chooses the values.

export type Form = Record<string, string>;
export type Outgoing = { name: string; data: Record<string, unknown> };
/** Events are sent wave by wave, with a short pause between waves (typing, opens). */
export type Waves = Outgoing[][];

const MAX_TEXT = 300;

/**
 * Keeps only values the form could really have sent. A select must hold one of its declared
 * options, otherwise it falls back to the day's default; text is trimmed and kept short.
 * The studio listens only on this machine, but a stray request must never decide how many events go out.
 */
export function cleanForm(profile: Profile, raw: unknown): Form {
  const given = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const clean: Form = {};
  for (const id of profile.fields as FieldId[]) {
    const options = id === "trouble" ? [["off"], ["on"]] : (FIELDS[id].options ?? null);
    const fallback = profile.defaults[id] ?? options?.[0][0] ?? "";
    const value = given[id];
    if (options) {
      clean[id] =
        typeof value === "string" && options.some(([v]) => v === value) ? value : fallback;
    } else {
      clean[id] = typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : fallback;
    }
  }
  return clean;
}

/** What goes wrong on purpose when the form's "trouble" field is on. */
function chaosFor(nn: string, form: Form): Chaos | undefined {
  if (form.trouble !== "on") return undefined;
  switch (nn) {
    case "01":
      return { image: { failTimes: 2, retryInMs: 1000 } };
    case "02":
      return { llm: { failTimes: 1, status: 429, retryAfterMs: 5000 } };
    case "03":
      return { image: { failTimes: 5, retryInMs: 1000 } };
    case "09": {
      // The mail elf slips once, halfway down the list.
      const halfway = Math.max(0, Math.floor(Number(form.recipients) / 2) - 1);
      return { mail: { afterCalls: halfway, failTimes: 1, retryInMs: 1000 } };
    }
    default:
      return undefined;
  }
}

/** The first n words of the message, growing to the whole message: what typing looks like. */
function typing(message: string, step: number, of: number): string {
  const words = message.trim().split(/\s+/);
  return words.slice(0, Math.max(1, Math.ceil((words.length * step) / of))).join(" ");
}

export function wavesFor(
  nn: string,
  profile: Profile,
  rawForm: Form,
  problem: boolean,
  cardId: string,
): Waves {
  const form = cleanForm(profile, rawForm);
  const name = problem && profile.before ? profile.before.event : profile.event;
  const chaos = chaosFor(nn, form);
  const message = form.message?.trim() || "Happy holidays";
  const to = form.to?.trim() || "grandma@example.com";

  switch (nn) {
    case "05":
      return [
        [
          {
            name,
            data: { cardId, to, deliverAt: new Date(Date.now() + Number(form.when)).toISOString() },
          },
        ],
      ];
    case "08": {
      const edits = Number(form.edits);
      return Array.from({ length: edits }, (_, i) => [
        { name, data: { cardId, prompt: typing(message, i + 1, edits) } },
      ]);
    }
    case "09": {
      const recipients = Array.from(
        { length: Number(form.recipients) },
        (_, i) => `guest${i + 1}@example.com`,
      );
      return [[{ name, data: { cardId, recipients, chaos } }]];
    }
    case "11": {
      const waves = Math.ceil(Number(form.opens) / 20);
      return Array.from({ length: waves }, (_, wave) =>
        Array.from({ length: 20 }, (_, i) => ({
          name,
          data: { cardId: `${cardId}-${wave * 20 + i + 1}`, openedAt: new Date().toISOString() },
        })),
      );
    }
    default: {
      const data: Record<string, unknown> = { cardId, prompt: message, to, chaos };
      // The writer reads these when the day passes the event along (Days 01 to 07 and 10).
      if (profile.fields.includes("tone"))
        Object.assign(data, { tone: form.tone, variant: form.tone });
      if (profile.fields.includes("account")) data.accountId = form.account;
      if (profile.fields.includes("plan")) data.plan = form.plan;
      return [[{ name, data }]];
    }
  }
}
