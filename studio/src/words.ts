// What each step says to the person sending the card. Keys are the step ids used by Days 01 to 12b.
// {n} becomes the number of the try that is under way.

export type Say = { doing: string; done: string; retrying: string; failed: string };

const WORDS: Record<string, Say> = {
  "write-text": {
    doing: "Writing your message",
    done: "Message written",
    retrying: "The writer lost their train of thought, trying again ({n})",
    failed: "Could not write your message",
  },
  "write-preview": {
    doing: "Writing a fresh preview",
    done: "Preview ready",
    retrying: "The writer is rereading the last edit, trying again ({n})",
    failed: "Could not write the preview",
  },
  "write-classic": {
    doing: "Writing it the classic way",
    done: "Classic message written",
    retrying: "The writer is still thinking, trying again ({n})",
    failed: "Could not write the classic message",
  },
  "write-warm": {
    doing: "Writing it warm",
    done: "Warm message written",
    retrying: "The writer is still thinking, trying again ({n})",
    failed: "Could not write the warm message",
  },
  "card-tone": {
    doing: "Choosing a tone for the card",
    done: "Tone chosen",
    retrying: "Choosing a tone again ({n})",
    failed: "Could not choose a tone",
  },
  score: {
    doing: "Writing down how it went",
    done: "Result written down",
    retrying: "Writing it down again ({n})",
    failed: "Could not write it down",
  },
  "write-card-code": {
    doing: "Asking the designer to draw it in code",
    done: "Design drawn",
    retrying: "The designer is sketching again ({n})",
    failed: "The designer gave up",
  },
  "render-card": {
    doing: "Checking the drawing in a safe room",
    done: "Drawing checked",
    retrying: "Checking the drawing again ({n})",
    failed: "The drawing did not work",
  },
  "score-renders": {
    doing: "Noting whether the drawing worked",
    done: "Drawing result noted",
    retrying: "Noting the result again ({n})",
    failed: "Could not note the result",
  },
  "render-image": {
    doing: "Painting the artwork",
    done: "Artwork painted",
    retrying: "The painter dropped a brush, trying again ({n})",
    failed: "The painter gave up",
  },
  render: {
    doing: "Painting the artwork",
    done: "Artwork painted",
    retrying: "The painter dropped a brush, trying again ({n})",
    failed: "The painter gave up",
  },
  moderate: {
    doing: "Checking the idea is friendly",
    done: "Idea approved",
    retrying: "Checking the idea is friendly, again ({n})",
    failed: "That idea was turned down",
  },
  "notify-sender": {
    doing: "Telling you what went wrong",
    done: "You have been told why",
    retrying: "Writing you a note, trying again ({n})",
    failed: "Could not reach you",
  },
  "save-draft": {
    doing: "Putting it in your drafts",
    done: "Saved to your drafts",
    retrying: "Saving the draft again ({n})",
    failed: "Could not save the draft",
  },
  "wait-for-approval": {
    doing: "Waiting for your approval",
    done: "You approved it",
    retrying: "Still waiting for your approval",
    failed: "Nobody approved it in time",
  },
  "expire-draft": {
    doing: "Tidying away the draft",
    done: "Draft put away, nothing sent",
    retrying: "Tidying again ({n})",
    failed: "Could not tidy the draft",
  },
  "wait-for-delivery-date": {
    doing: "Sleeping until Christmas morning",
    done: "Christmas morning has come",
    retrying: "Still sleeping",
    failed: "Woke up too early",
  },
  deliver: {
    doing: "Delivering to the inbox",
    done: "Delivered to the inbox",
    retrying: "The mail elf slipped on the ice, trying again ({n})",
    failed: "Could not reach the inbox",
  },
  "send-deliveries": {
    doing: "Writing one envelope per person",
    done: "Every envelope is on its way",
    retrying: "Counting the envelopes again ({n})",
    failed: "Could not hand out the envelopes",
  },
  "send-all": {
    doing: "Mailing everyone, one after another",
    done: "Everyone has a card",
    retrying: "The mail elf slipped, starting the list again ({n})",
    failed: "The mailing stopped",
  },
  "insert-opens": {
    doing: "Saving the opens in one go",
    done: "Opens saved together",
    retrying: "Saving the opens again ({n})",
    failed: "Could not save the opens",
  },
  "insert-open": {
    doing: "Saving one open at a time",
    done: "Open saved",
    retrying: "Saving the open again ({n})",
    failed: "Could not save the open",
  },
  "delete-stale": {
    doing: "Sweeping out old drafts",
    done: "Old drafts swept out",
    retrying: "Sweeping again ({n})",
    failed: "Could not sweep",
  },
  "score-length": {
    doing: "Checking it fits on the card",
    done: "It fits on the card",
    retrying: "Measuring again ({n})",
    failed: "Could not measure it",
  },
  "wait-for-reaction": {
    doing: "Waiting to see how they react",
    done: "Their reaction is in",
    retrying: "Still waiting for a reaction",
    failed: "No reaction in time",
  },
};

/** "wait-for-it" becomes "Wait for it", for any step the table does not know. */
function sentence(id: string): string {
  const words = id.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function say(id: string, state: keyof Say, n = 1): string {
  const entry = WORDS[id];
  if (entry) return entry[state].replace("{n}", String(n));
  const plain = sentence(id);
  if (state === "retrying") return `${plain}, trying again (${n})`;
  if (state === "failed") return `${plain} did not work`;
  return state === "done" ? `${plain}, done` : plain;
}
