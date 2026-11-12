// One entry per day: which events the form fires, which fields it shows, and what the
// dashboard follows. Adding a day means adding a block here, nothing else.

export type FieldId =
  | "to"
  | "message"
  | "tone"
  | "trouble"
  | "account"
  | "plan"
  | "when"
  | "recipients"
  | "edits"
  | "opens";

export type Field = {
  label: string;
  kind: "text" | "textarea" | "select";
  options?: [value: string, label: string][];
  hint?: string;
  placeholder?: string;
};

/** Every field the form can show. A day picks from this list. */
export const FIELDS: Record<Exclude<FieldId, "trouble">, Field> = {
  to: { label: "Who is it for?", kind: "text", placeholder: "grandma@example.com" },
  message: {
    label: "What's the idea?",
    kind: "textarea",
    placeholder: "A sentence or two is plenty",
  },
  tone: {
    label: "Tone",
    kind: "select",
    options: [
      ["warm", "Warm"],
      ["classic", "Classic"],
    ],
  },
  account: {
    label: "Your account",
    kind: "select",
    options: [
      ["a", "Acme Greetings"],
      ["b", "Brightside Co."],
    ],
  },
  plan: {
    label: "Your plan",
    kind: "select",
    options: [
      ["free", "Free"],
      ["pro", "Pro"],
    ],
  },
  when: {
    label: "Deliver",
    kind: "select",
    options: [
      ["5000", "Christmas, sped up: 5 s"],
      ["10000", "Christmas, sped up: 10 s"],
    ],
  },
  recipients: {
    label: "How many people?",
    kind: "select",
    options: [
      ["10", "10 people"],
      ["20", "20 people"],
      ["50", "50 people"],
    ],
  },
  edits: {
    label: "While you write",
    kind: "select",
    options: [
      ["1", "Save once, when done"],
      ["8", "Keep typing (8 edits)"],
    ],
  },
  opens: {
    label: "How many people open it?",
    kind: "select",
    options: [
      ["20", "20 people"],
      ["60", "60 people"],
      ["120", "120 people"],
    ],
  },
};

export type Profile = {
  event: string; // what "The fix" sends
  fields: FieldId[];
  defaults: Partial<Record<FieldId, string>>;
  /** The "trouble" field: something goes wrong on purpose, so the lesson has something to do. */
  trouble?: { label: string; off: string; on: string };
  /** Functions whose steps the status feed lists. Child functions are named so retries show up. */
  main: string[];
  plan: string[]; // step ids in the order they usually happen, shown as "coming up"
  childStep?: string; // a step in a child function whose retries belong to the invoke step
  primitives?: Record<string, string>; // when the Dev Server cannot tell (sleep vs sleepUntil)
  flow?: { name: string; detail: string }; // a function option that shapes the run
  /** The version without the lesson. Absent when the day has no "before". */
  before?: {
    event: string;
    main: string[];
    plan: string[];
    flow?: { name: string; detail: string };
  };
  /** One click that shows the lesson: a scenario from the day's send.ts (+ "-before" for the problem). */
  shortcut?: { label: string; hint: string; scenario: string };
  /** A button that appears while the run waits on step `when`, and sends an event for the card. */
  action?: { label: string; event: string; data?: Record<string, unknown>; when: string };
  holding?: string; // what to say while events are held back and no run has started yet
  tip?: string; // one calm line under the Send button
  showsCard: boolean; // does a finished run produce a card worth showing?
  cloudOnly?: boolean; // needs Inngest Cloud, so it cannot run here
};

const MESSAGE = "Warm wishes for a cozy, quiet season";
const TO = "grandma@example.com";
const cardFields: FieldId[] = ["to", "message", "tone"];

export const PROFILES: Record<string, Profile> = {
  "01": {
    event: "card/requested",
    before: { event: "card/requested.before", main: ["create-card-before"], plan: [] },
    fields: [...cardFields, "trouble"],
    defaults: { to: TO, message: MESSAGE, tone: "warm", trouble: "on" },
    trouble: { label: "Image service", off: "Reliable", on: "Unreliable: fails twice" },
    main: ["create-card"],
    plan: ["write-text", "render-image", "deliver"],
    showsCard: true,
  },
  "02": {
    event: "card/requested",
    before: {
      event: "card/requested.before",
      main: ["create-card-before"],
      plan: ["moderate", "write-text", "render-image", "deliver"],
    },
    fields: [...cardFields, "trouble"],
    defaults: { to: TO, message: "A card from the Grinch", tone: "classic", trouble: "off" },
    trouble: { label: "Writing service", off: "Normal", on: "Busy: asks us to wait 5 s" },
    main: ["create-card", "create-card-failure"],
    plan: ["moderate", "write-text", "render-image", "deliver"],
    tip: "Try an idea with the Grinch in it, then one without.",
    showsCard: true,
  },
  "03": {
    event: "card/requested",
    before: {
      event: "card/requested.before",
      main: ["create-card-before"],
      plan: ["write-text", "render-image", "deliver"],
    },
    fields: [...cardFields, "trouble"],
    defaults: { to: TO, message: MESSAGE, tone: "warm", trouble: "on" },
    trouble: { label: "Image service", off: "Reliable", on: "Unreliable: fails 5 times" },
    main: ["create-card"],
    plan: ["write-text", "render-image", "deliver"],
    childStep: "render",
    flow: { name: "retries: 10", detail: "image creation is its own function" },
    showsCard: true,
  },
  "04": {
    event: "card/requested",
    fields: cardFields,
    defaults: { to: TO, message: MESSAGE, tone: "warm" },
    main: ["create-card"],
    plan: ["write-text", "render-image", "save-draft", "wait-for-approval", "deliver"],
    action: { label: "Approve the card", event: "card/approved", when: "wait-for-approval" },
    tip: "The card waits for you. Approve it to send it on its way.",
    showsCard: true,
  },
  "05": {
    event: "card/approved",
    before: {
      event: "card/approved.before",
      main: ["schedule-delivery-before"],
      plan: ["wait-for-delivery-date", "deliver"],
      flow: { name: "no cancelOn", detail: "a deleted card still goes out" },
    },
    primitives: { "wait-for-delivery-date": "step.sleepUntil" },
    fields: ["to", "when"],
    defaults: { to: TO, when: "10000" },
    main: ["schedule-delivery"],
    plan: ["wait-for-delivery-date", "deliver"],
    flow: { name: "cancelOn", detail: "card/deleted stops the run" },
    action: {
      label: "Changed my mind: delete it",
      event: "card/deleted",
      when: "wait-for-delivery-date",
    },
    shortcut: {
      label: "Send it, then change my mind",
      hint: "Deletes the card 2 seconds after it is scheduled",
      scenario: "delete-before-delivery",
    },
    showsCard: false,
  },
  "06": {
    event: "card/requested",
    before: {
      event: "card/requested.before",
      main: ["create-card-before"],
      plan: ["write-text", "render-image", "deliver"],
      flow: { name: "one shared lane", detail: "everyone waits in the same line" },
    },
    fields: ["to", "message", "account"],
    defaults: { to: TO, message: MESSAGE, account: "a" },
    main: ["create-card"],
    plan: ["write-text", "render-image", "deliver"],
    flow: { name: "concurrency key", detail: "2 at a time per account" },
    shortcut: {
      label: "Send a rush of cards",
      hint: "20 from Acme, then 1 from Brightside",
      scenario: "noisy-neighbor",
    },
    tip: "One card is easy. A rush shows who waits.",
    showsCard: true,
  },
  "07": {
    event: "card/requested",
    before: {
      event: "card/requested.before",
      main: ["create-card-before"],
      plan: ["write-text", "render-image", "deliver"],
      flow: { name: "no throttle", detail: "every card hits the image service at once" },
    },
    fields: ["to", "message"],
    defaults: { to: TO, message: MESSAGE },
    main: ["create-card"],
    plan: ["write-text", "render-image", "deliver"],
    childStep: "render",
    flow: { name: "throttle", detail: "4 image calls per 10 seconds" },
    shortcut: { label: "Send a rush of cards", hint: "15 cards at once", scenario: "burst" },
    tip: "One card is easy. A rush shows the image service's limit.",
    showsCard: true,
  },
  "08": {
    event: "card/edited",
    before: {
      event: "card/edited.before",
      main: ["regenerate-preview-before"],
      plan: ["write-preview"],
      flow: { name: "no debounce", detail: "every keystroke starts a run" },
    },
    fields: ["message", "edits"],
    defaults: { message: "Warm wishes for a cozy, quiet season", edits: "8" },
    main: ["regenerate-preview"],
    plan: ["write-preview"],
    holding: "Waiting for you to finish editing. Your preview updates after 3 quiet seconds.",
    flow: { name: "debounce", detail: "3 quiet seconds per card" },
    showsCard: true,
  },
  "09": {
    event: "card/bulk-send",
    before: {
      event: "card/bulk-send.before",
      main: ["bulk-send-before"],
      plan: ["send-all"],
      flow: { name: "one big step", detail: "a retry starts over at person 1" },
    },
    fields: ["message", "recipients", "trouble"],
    defaults: { message: MESSAGE, recipients: "20", trouble: "on" },
    trouble: { label: "Mail service", off: "Reliable", on: "Fails once, halfway through" },
    main: ["bulk-send", "deliver-card"],
    plan: ["fan-out", "deliver"],
    flow: { name: "fan-out", detail: "one event per recipient" },
    shortcut: {
      label: "Send to 50 people",
      hint: "Delivery fails once, at number 25",
      scenario: "bulk-50",
    },
    showsCard: true,
  },
  "10": {
    event: "card/requested",
    before: {
      event: "card/requested.before",
      main: ["create-card-before"],
      plan: ["write-text", "render-image", "deliver"],
      flow: { name: "no priority", detail: "first come, first served" },
    },
    fields: ["to", "message", "plan"],
    defaults: { to: TO, message: MESSAGE, plan: "pro" },
    main: ["create-card"],
    plan: ["write-text", "render-image", "deliver"],
    flow: { name: "priority", detail: "pro runs jump the queue" },
    shortcut: {
      label: "Send a rush of cards",
      hint: "20 free cards, then 2 pro cards",
      scenario: "pro-arrives-late",
    },
    tip: "One card is easy. A rush shows who goes first.",
    showsCard: true,
  },
  "11": {
    event: "card/opened",
    before: {
      event: "card/opened.before",
      main: ["record-open-before"],
      plan: ["insert-open"],
      flow: { name: "no batching", detail: "one run and one write per open" },
    },
    fields: ["opens"],
    defaults: { opens: "120" },
    main: ["record-opens"],
    plan: ["insert-opens"],
    holding: "Collecting card opens. They are recorded together, every 50 or 5 seconds.",
    flow: { name: "batchEvents", detail: "50 opens or 5 seconds" },
    shortcut: { label: "120 opens in 2 seconds", hint: "Six waves of 20", scenario: "opens-120" },
    showsCard: false,
  },
  "12": {
    event: "card/requested",
    fields: ["to", "message"],
    defaults: { to: TO, message: MESSAGE },
    main: ["create-card", "score-recipient-reaction"],
    plan: ["card-tone", "score-length", "deliver", "wait-for-reaction"],
    primitives: {
      "card-tone": "group.experiment",
      "score-length": "step.score",
      "score-reaction": "defer",
    },
    flow: { name: "experiment", detail: "classic or warm, 50 / 50" },
    action: {
      label: "The recipient loved it",
      event: "card/reacted",
      data: { loved: true },
      when: "wait-for-reaction",
    },
    shortcut: {
      label: "Test 40 cards",
      hint: "Each recipient reacts; warm pulls ahead",
      scenario: "experiment-40",
    },
    showsCard: true,
  },
  "12b": {
    event: "card/requested",
    fields: ["to", "message"],
    defaults: { to: TO, message: MESSAGE },
    main: ["design-card", "score-recipient-reaction"],
    plan: ["design-prompt", "render-card", "deliver"],
    showsCard: false,
    cloudOnly: true,
  },
};
