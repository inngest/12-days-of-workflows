// What each step says to the person sending the card. Keys are the step ids used by Days 01 to 12b.
// {n} becomes the number of the try that is under way.
// Every line reads like a real greeting-card product: plain and calm, no talk of how it works inside.
//   doing:    under way, or still to come
//   done:     finished
//   retrying: something went wrong and we are trying again by ourselves
//   failed:   we gave up; say what happened and what the sender can expect
//   waiting:  (optional) the step is parked until something outside happens
//   skipped:  (optional) the step was never reached because the card stopped earlier

export type Say = {
  doing: string;
  done: string;
  retrying: string;
  failed: string;
  waiting?: string;
  skipped?: string;
};

const WORDS: Record<string, Say> = {
  moderate: {
    doing: "Checking your idea against our guidelines",
    done: "Your idea is approved",
    retrying: "Checking your idea again ({n})",
    failed: "Your idea was not approved",
  },
  "notify-sender": {
    doing: "Letting you know what happened",
    done: "We let you know what happened",
    retrying: "Having trouble sending you a note, trying again ({n})",
    failed: "We could not send you a note",
  },
  "write-text": {
    doing: "Writing your message",
    done: "Your message is written",
    retrying: "The writing service is busy, trying again ({n})",
    failed: "We could not write your message. Nothing was sent.",
    skipped: "Message not written",
  },
  "write-preview": {
    doing: "Updating your preview",
    done: "Your preview is up to date",
    retrying: "Having trouble updating your preview, trying again ({n})",
    failed: "We could not update your preview. Your last edit is saved.",
  },
  "write-classic": {
    doing: "Writing your message in a classic style",
    done: "Your message is written in a classic style",
    retrying: "The writing service is busy, trying again ({n})",
    failed: "We could not write your message. Nothing was sent.",
  },
  "write-warm": {
    doing: "Writing your message in a warm style",
    done: "Your message is written in a warm style",
    retrying: "The writing service is busy, trying again ({n})",
    failed: "We could not write your message. Nothing was sent.",
  },
  "card-tone": {
    doing: "Choosing a style for your card",
    done: "Style chosen",
    retrying: "Choosing a style again ({n})",
    failed: "We could not choose a style for your card",
  },
  "score-length": {
    doing: "Checking your message fits on the card",
    done: "Your message fits on the card",
    retrying: "Checking the message length again ({n})",
    failed: "We could not check the message length",
  },
  "design-prompt": {
    doing: "Designing your card",
    done: "Design chosen",
    retrying: "Having trouble designing your card, trying again ({n})",
    failed: "We could not design your card. Nothing was sent.",
  },
  "design-classic": {
    doing: "Designing your card in a classic style",
    done: "Classic design ready",
    retrying: "Having trouble with the design, trying again ({n})",
    failed: "We could not design your card. Nothing was sent.",
  },
  "design-bold": {
    doing: "Designing your card in a bold style",
    done: "Bold design ready",
    retrying: "Having trouble with the design, trying again ({n})",
    failed: "We could not design your card. Nothing was sent.",
  },
  "create-renderer": {
    doing: "Getting your card ready to preview",
    done: "Ready to preview your card",
    retrying: "Having trouble getting ready, trying again ({n})",
    failed: "We could not get your card ready",
  },
  "render-card": {
    doing: "Previewing your design",
    done: "Your design looks good",
    retrying: "Having trouble previewing your design, trying again ({n})",
    failed: "We could not preview your design",
    skipped: "Design not previewed",
  },
  "revise-design": {
    doing: "Fixing a problem with the design",
    done: "Design fixed",
    retrying: "Fixing the design again ({n})",
    failed: "We could not fix the design",
  },
  "render-revision": {
    doing: "Previewing the fixed design",
    done: "The fixed design looks good",
    retrying: "Previewing again ({n})",
    failed: "We could not preview the fixed design",
  },
  "destroy-renderer": {
    doing: "Tidying up",
    done: "All tidied up",
    retrying: "Tidying up again ({n})",
    failed: "We could not finish tidying up",
  },
  "render-image": {
    doing: "Creating your artwork",
    done: "Your artwork is ready",
    retrying: "Having trouble reaching the image service, trying again ({n})",
    failed: "We could not create your artwork. Nothing was sent.",
    waiting: "Waiting for a turn with the image service",
    skipped: "Artwork not created",
  },
  render: {
    doing: "Creating your artwork",
    done: "Your artwork is ready",
    retrying: "Having trouble reaching the image service, trying again ({n})",
    failed: "We could not create your artwork. Nothing was sent.",
  },
  "save-draft": {
    doing: "Saving your draft",
    done: "Saved to your drafts",
    retrying: "Having trouble saving your draft, trying again ({n})",
    failed: "We could not save your draft",
    skipped: "Draft not saved",
  },
  "wait-for-approval": {
    doing: "Waiting for your approval",
    done: "You approved your card",
    retrying: "Still waiting for your approval",
    failed: "Your card was not approved in time",
    waiting: "Waiting for your approval. Nothing is sent until you approve.",
    skipped: "No approval needed",
  },
  "expire-draft": {
    doing: "Discarding your draft",
    done: "Draft discarded. Nothing was sent.",
    retrying: "Discarding your draft again ({n})",
    failed: "We could not discard your draft",
  },
  "wait-for-delivery-date": {
    doing: "Waiting for the delivery date",
    done: "The delivery date has arrived",
    retrying: "Still waiting for the delivery date",
    failed: "We could not keep your delivery date",
    waiting: "Scheduled for delivery",
    skipped: "Delivery date not kept",
  },
  deliver: {
    doing: "Delivering to the inbox",
    done: "Delivered to the inbox",
    retrying: "Having trouble reaching the inbox, trying again ({n})",
    failed: "We could not deliver your card. Please try sending it again.",
    skipped: "Card not delivered",
  },
  "fan-out": {
    doing: "Preparing a card for each person",
    done: "Cards are on their way to everyone",
    retrying: "Preparing the cards again ({n})",
    failed: "We could not prepare the cards. Nothing was sent.",
  },
  "deliver-all": {
    doing: "Delivering to everyone, one by one",
    done: "Everyone has their card",
    retrying: "Having trouble delivering, starting the list again ({n})",
    failed: "Delivery stopped part of the way through",
  },
  "insert-opens": {
    doing: "Recording card opens",
    done: "Card opens recorded",
    retrying: "Having trouble recording opens, trying again ({n})",
    failed: "We could not record the opens",
    waiting: "Collecting card opens",
  },
  "insert-open": {
    doing: "Recording a card open",
    done: "Card open recorded",
    retrying: "Having trouble recording the open, trying again ({n})",
    failed: "We could not record the open",
  },
  "delete-stale": {
    doing: "Clearing out old drafts",
    done: "Old drafts cleared out",
    retrying: "Clearing old drafts again ({n})",
    failed: "We could not clear old drafts",
  },
  "wait-for-reaction": {
    doing: "Waiting to hear how the recipient reacts",
    done: "The recipient's reaction is in",
    retrying: "Still waiting for the recipient's reaction",
    failed: "No reaction came in time",
    waiting: "Waiting to hear how the recipient reacts",
    skipped: "Reaction not collected",
  },
};

/** "wait-for-it" becomes "Wait for it", for any step the table does not know. */
function sentence(id: string): string {
  const words = id.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function say(id: string, state: keyof Say, n = 1): string {
  const entry = WORDS[id];
  if (entry) {
    // A step without its own waiting or skipped wording falls back to the plain "doing" line.
    const text =
      entry[state] ?? (state === "skipped" ? `Not started: ${entry.doing}` : entry.doing);
    return text.replace("{n}", String(n));
  }
  const plain = sentence(id);
  if (state === "retrying") return `${plain}, trying again (${n})`;
  if (state === "failed") return `${plain} did not work`;
  if (state === "skipped") return `${plain}, not started`;
  return state === "done" ? `${plain}, done` : plain;
}
