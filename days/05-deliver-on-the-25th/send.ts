import type { Scenario } from "@12days/shared";
import { cardDeleted, cardScheduled, cleanupRequested, type ScheduledCard } from "./src/events.js";

const scheduledCard = (inMs: number): ScheduledCard => ({
  cardId: "c1",
  to: "sam@example.com",
  deliverAt: new Date(Date.now() + inMs).toISOString(),
});

let scheduledSentAt = 0;

export const scenarios: Record<string, Scenario> = {
  scheduled: {
    description: "Deliver 5 seconds from now (on the 25th, in real life)",
    send: async ({ inngest }) => {
      scheduledSentAt = Date.now();
      const { ids } = await inngest.send(cardScheduled.create(scheduledCard(5_000)));
      return ids;
    },
    expect: {
      settleMs: 12_000,
      runs: [{ fn: "schedule-delivery", status: "Completed" }],
      ledger: { "mail.sendCard": 1 },
      custom: (ledger) => {
        const delivery = ledger.find((e) => e.provider === "mail" && e.op === "sendCard");
        if (!delivery) return "no delivery";
        // Sleeps are scheduled to the second, so allow 1 s of slack.
        const after = delivery.at - scheduledSentAt;
        return after >= 4_000 ? null : `delivered ${after} ms after send, expected ≥ 5000`;
      },
    },
  },
  "delete-before-delivery": {
    description: "The card is deleted while the run sleeps: the run is cancelled",
    send: async ({ inngest, sleep }) => {
      const scheduled = await inngest.send(cardScheduled.create(scheduledCard(10_000)));
      await sleep(2_000);
      const deleted = await inngest.send(cardDeleted.create({ cardId: "c1" }));
      return [...scheduled.ids, ...deleted.ids];
    },
    expect: {
      settleMs: 12_000,
      runs: [{ fn: "schedule-delivery", status: "Cancelled" }],
      ledger: { "mail.sendCard": 0 },
    },
  },
  "delete-before-delivery-before": {
    description: "Same deletion without cancelOn: the deleted card is delivered anyway",
    send: async ({ inngest, sleep }) => {
      const scheduled = await inngest.send({
        name: "card/scheduled.before",
        data: scheduledCard(10_000),
      });
      await sleep(2_000);
      const deleted = await inngest.send(cardDeleted.create({ cardId: "c1" }));
      return [...scheduled.ids, ...deleted.ids];
    },
    expect: {
      settleMs: 12_000,
      runs: [{ fn: "schedule-delivery-before", status: "Completed" }],
      ledger: { "mail.sendCard": 1 },
    },
  },
  cleanup: {
    description: "Run the nightly draft cleanup now instead of at 3am",
    send: async ({ inngest }) => {
      const { ids } = await inngest.send(cleanupRequested.create({}));
      return ids;
    },
    expect: {
      settleMs: 5_000,
      runs: [{ fn: "cleanup-drafts", status: "Completed" }],
    },
  },
};
