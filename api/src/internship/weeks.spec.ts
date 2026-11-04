import { currentWeek, generateWeeks, lockedWeek } from './weeks.js';

const span = (w: { startDate: string; endDate: string }) => `${w.startDate} ${w.endDate}`;

describe('generateWeeks', () => {
  it('Monday start', () => {
    const w = generateWeeks('2026-10-05', '2026-10-18');
    expect(w.map(span)).toEqual(['2026-10-05 2026-10-11', '2026-10-12 2026-10-18']);
    expect(w.map((x) => x.number)).toEqual([1, 2]);
  });

  it('midweek start begins on the Monday before', () => {
    expect(generateWeeks('2026-10-07', '2026-10-09').map(span)).toEqual(['2026-10-05 2026-10-11']);
  });

  it('crosses a month boundary', () => {
    expect(generateWeeks('2026-10-26', '2026-11-02').map(span)).toEqual(['2026-10-26 2026-11-01', '2026-11-02 2026-11-08']);
  });

  it('crosses a year boundary', () => {
    expect(generateWeeks('2026-12-23', '2027-01-06').map(span)).toEqual([
      '2026-12-21 2026-12-27',
      '2026-12-28 2027-01-03',
      '2027-01-04 2027-01-10',
    ]);
  });

  it('end date midweek keeps a full last week', () => {
    const w = generateWeeks('2026-10-05', '2026-10-14');
    expect(w).toHaveLength(2);
    expect(w[1].endDate).toBe('2026-10-18');
  });

  it('end on a Sunday does not add a week', () => {
    expect(generateWeeks('2026-10-05', '2026-10-11')).toHaveLength(1);
  });
});

describe('currentWeek', () => {
  const weeks = generateWeeks('2026-10-05', '2026-10-18');

  it('Sun 23:00 Singapore is still that week', () => {
    expect(currentWeek(weeks, new Date('2026-10-11T15:00:00Z')).number).toBe(1);
  });

  it('Mon 00:30 Singapore is the next week', () => {
    expect(currentWeek(weeks, new Date('2026-10-11T16:30:00Z')).number).toBe(2);
  });

  it('before the start returns week 1', () => {
    expect(currentWeek(weeks, new Date('2026-09-01T00:00:00Z')).number).toBe(1);
  });

  it('after the end returns the last week', () => {
    expect(currentWeek(weeks, new Date('2027-01-01T00:00:00Z')).number).toBe(2);
  });
});

describe('lockedWeek', () => {
  // weeks w1..w4 start Mon 2026-10-05, 12, 19, 26
  const weeks = generateWeeks('2026-10-05', '2026-11-01').map((w) => ({ ...w, id: `w${w.number}` }));
  const inWeek3 = new Date('2026-10-21T04:00:00Z'); // last week = w2
  const lock = (refl: { weekId: string; learnt: string }[], tracking = '2026-10-05', now = inWeek3) => lockedWeek(weeks, refl, tracking, now)?.id ?? null;

  it('backfill weeks never lock', () => {
    expect(lock([], '2026-10-19')).toBeNull();
  });

  it('the first tracked week never locks', () => {
    expect(lock([], '2026-10-05', new Date('2026-10-07T04:00:00Z'))).toBeNull();
  });

  it('an empty last week locks', () => {
    expect(lock([])).toBe('w2');
    expect(lock([{ weekId: 'w2', learnt: '' }])).toBe('w2');
  });

  it('whitespace counts as empty', () => {
    expect(lock([{ weekId: 'w2', learnt: ' \n\t ' }])).toBe('w2');
  });

  it('a written reflection unlocks', () => {
    expect(lock([{ weekId: 'w2', learnt: 'SQL joins' }])).toBeNull();
  });

  it('only last week counts, not older ones', () => {
    expect(lock([{ weekId: 'w2', learnt: 'x' }, { weekId: 'w1', learnt: '' }])).toBeNull();
  });
});
