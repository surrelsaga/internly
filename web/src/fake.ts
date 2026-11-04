// Fake data from the mock. Later steps delete this as real data arrives.

export type Block = { k: 'h' | 'p' | 'li' | 'code' | 'img'; text: string };
export type Note = { title: string; blocks: Block[] };

const h = (text: string): Block => ({ k: 'h', text });
const p = (text: string): Block => ({ k: 'p', text });
const li = (text: string): Block => ({ k: 'li', text });
const code = (text: string): Block => ({ k: 'code', text });
const img = (text: string): Block => ({ k: 'img', text });

export const devNotes: Note[] = [
  {
    title: 'whatsapp flow',
    blocks: [
      p("Meta sends a webhook to the backend whenever a WhatsApp message arrives, so we never have to monitor each organization's WhatsApp ourselves."),
      h('How a reply travels'),
      li('The webhook hits the controller in chatWebhook, which hands it to processIncomingMessage in the service.'),
      li('The service finds the patient, checks their organization and checks whether they have onboarded.'),
      li('tryHandleNhcsAacOnboarding builds the interactive message and sends it through chatService.sendInteractiveMessage.'),
      li('The patient taps a reply and it comes back through the same webhook endpoint, so the loop repeats.'),
      img('screenshot: interactive message in WhatsApp'),
      h('Testing it locally'),
      p('WhatsApp cannot reach localhost, so the backend goes behind a Cloudflare tunnel. The catch is that WhatsApp may still be pointing at the staging URL instead of my tunnel.'),
      li('Option 1: change the callback URL in the Meta developer platform for a while.'),
      li('Option 2: post a fake payload straight to the webhook endpoint. This is what I did.'),
      code('curl -X POST localhost:3000/chat-webhook \\\n  -H "Content-Type: application/json" \\\n  -d @fake-reply.json'),
      h('Open questions'),
      p('Utility and marketing templates are billed differently. I still need to check which one the onboarding message counts as before we send it to real patients.'),
      p('Working doc with the full flow: NHCS Community Rehab x Speedback.'),
    ],
  },
  {
    title: 'worktrees',
    blocks: [
      p('A worktree is another folder of the same repo, sharing the same .git and history, so two branches can be open at once.'),
      code('git branch feature/name main\ngit worktree add ../repo-worktrees/name feature/name'),
      p('A branch can only be checked out in one worktree at a time. Merge, then remove the worktree and delete the branch.'),
    ],
  },
  {
    title: 'nestjs basics',
    blocks: [
      p('One app module holds smaller modules. Each module has controllers for endpoints and providers for business logic.'),
      li('Routes with /:id go after fixed routes like /role, otherwise /:id swallows them.'),
      li('Pipes transform or validate input. DTOs plus class-validator cover most validation.'),
      li('Built-in HTTP exceptions cover most errors. Exception filters format the ones I did not expect.'),
    ],
  },
  {
    title: 'user_activity cleanup',
    blocks: [
      p("Hard delete has to remove the activity rows for the patient without touching anyone else's."),
      li('Find activity ids linked to the patient in user_activity_patient.'),
      li('Find activities where userType is patient and userId is the patient.'),
      li('Delete the link rows first, then those activities, then continue the normal patient cleanup.'),
    ],
  },
];

export const researchNotes: Note[] = [
  {
    title: 'AAC storage',
    blocks: [
      p('Before creating a new table, check three things: do I need to index it heavily, will the same feature grow later, and is there a property that fits nowhere in the existing tables.'),
      h('What the existing tables can hold'),
      li('chat: sender, patient, timestamp, raw reply and JSON metadata. Use it to track attempts and progress.'),
      li('patient: JSON metadata for state. Use it to point at the current attempt.'),
      li('flow_responses: WhatsApp form submissions and JSON answers. Use it for the questionnaire answers.'),
      li('service_interest: needs a catalog entry, so leave it out of this workflow.'),
    ],
  },
  {
    title: 'glucose monitors',
    blocks: [
      p('A continuous monitor records glucose about every 10 minutes and sends it to its own mobile app.'),
      li('Question: how do we get the data out of that app?'),
      li('Need: an API or key the backend can pull from, and availability in Hong Kong.'),
    ],
  },
];
