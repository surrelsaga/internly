import { exportMarkdown, tiptapToMd } from './export.js';

const text = (t: string, ...marks: { type: string; attrs?: Record<string, unknown> }[]) => ({ type: 'text', text: t, marks });
const p = (...content: object[]) => ({ type: 'paragraph', content });
const doc = (...content: object[]) => ({ type: 'doc', content });

describe('tiptapToMd', () => {
  it('marks, links and headings', () => {
    const md = tiptapToMd(
      doc(
        { type: 'heading', attrs: { level: 2 }, content: [text('Setup')] },
        p(text('plain '), text('bold', { type: 'bold' }), text(' and '), text('it', { type: 'italic' }), text(' '), text('docs', { type: 'link', attrs: { href: 'https://x.dev' } })),
        p(text('Arial big', { type: 'textStyle', attrs: { fontFamily: 'Arial', fontSize: '30px' } })),
      ),
    );
    expect(md).toBe('## Setup\n\nplain **bold** and *it* [docs](https://x.dev)\n\nArial big');
  });

  it('nested bullets, ordered lists, images and code', () => {
    const li = (...content: object[]) => ({ type: 'listItem', content });
    const md = tiptapToMd(
      doc(
        { type: 'bulletList', content: [li(p(text('one')), { type: 'bulletList', content: [li(p(text('one.a')))] }), li(p(text('two')))] },
        { type: 'orderedList', attrs: { start: 1 }, content: [li(p(text('first'))), li(p(text('second')))] },
        { type: 'image', attrs: { src: 'https://res.cloudinary.test/a.png', alt: null } },
        { type: 'codeBlock', attrs: { language: 'ts' }, content: [text('# not a heading')] },
        p(),
      ),
    );
    expect(md).toBe('- one\n  - one.a\n- two\n\n1. first\n2. second\n\n![](https://res.cloudinary.test/a.png)\n\n```ts\n# not a heading\n```');
  });

  it('keeps Tab indents as visible spaces (not code) and drops empty list items', () => {
    const md = tiptapToMd(doc(p(text('\t\tindented\tmid')), { type: 'bulletList', content: [{ type: 'listItem', content: [p()] }] }));
    expect(md).toBe(' '.repeat(8) + 'indented\tmid');
  });

  it('shifts headings below a note title', () => {
    expect(tiptapToMd(doc({ type: 'heading', attrs: { level: 1 }, content: [text('H')] }), 4)).toBe('##### H');
  });
});

describe('exportMarkdown', () => {
  const weeks = [
    { id: 'w2', number: 2, startDate: '2026-10-12', endDate: '2026-10-18' },
    { id: 'w1', number: 1, startDate: '2026-10-05', endDate: '2026-10-11' },
    { id: 'w3', number: 3, startDate: '2026-10-19', endDate: '2026-10-25' },
  ];
  const md = exportMarkdown({
    internship: { company: 'Speedback', startDate: '2026-10-05', endDate: '2026-10-25', reflectionPosition: 0 },
    weeks,
    sections: [
      { id: 'res', name: 'research notes', position: 2 },
      { id: 'dev', name: 'dev notes', position: 1 },
    ],
    tasks: [
      { id: 'a', title: 'Ship login', createdWeek: 1, doneWeek: 2 },
      { id: 'b', title: 'Flaky test', createdWeek: 1, doneWeek: null },
    ],
    reflections: [{ weekId: 'w1', learnt: ' SQL joins ', wentWell: '', needHelp: 'Docker' }],
    notes: [
      { weekId: 'w1', sectionId: 'dev', title: 'second', content: doc(p(text('B'))), position: 1 },
      { weekId: 'w1', sectionId: 'dev', title: 'first', content: doc(p(text('A'))), position: 0 },
      { weekId: 'w1', sectionId: 'res', title: 'untitled', content: doc(p()), position: 0 },
      { weekId: 'w2', sectionId: 'res', title: 'named, empty', content: doc(p()), position: 0 },
    ],
    now: new Date('2026-10-14T04:00:00Z'), // during week 2
  });

  it('builds the file week by week, tabs in their order, empty parts and blank untitled notes left out', () => {
    expect(md).toBe(
      [
        '# Intern log: Speedback',
        '5 Oct 2026 to 25 Oct 2026 · exported 14 Oct 2026',
        '## Week 1 · Mon 5 Oct to Sun 11 Oct 2026',
        '### Tasks',
        '- [ ] Ship login\n- [ ] Flaky test',
        '### Reflection',
        '**What I learnt**\n\nSQL joins',
        '**What I need help with**\n\nDocker',
        '### dev notes',
        '#### first',
        'A',
        '#### second',
        'B',
        '## Week 2 · Mon 12 Oct to Sun 18 Oct 2026',
        '### Tasks',
        '- [x] Ship login (from week 1)\n- [ ] Flaky test (from week 1)',
        '### research notes',
        '#### named, empty',
      ].join('\n\n') + '\n',
    );
  });

  it('leaves out weeks that have not started', () => {
    expect(md).not.toContain('Week 3');
  });
});
