import {
  shouldSendFuelNudge,
  isInCooldown,
  FUEL_NUDGE_AFTER_DAYS,
} from '../reminderRules';

describe('shouldSendFuelNudge', () => {
  it('does not nudge when no fuel entries exist', () => {
    expect(shouldSendFuelNudge(null)).toBe(false);
  });
  it('does not nudge before the threshold', () => {
    expect(shouldSendFuelNudge(FUEL_NUDGE_AFTER_DAYS - 1)).toBe(false);
  });
  it('nudges at and after the threshold', () => {
    expect(shouldSendFuelNudge(FUEL_NUDGE_AFTER_DAYS)).toBe(true);
    expect(shouldSendFuelNudge(60)).toBe(true);
  });
});

describe('isInCooldown', () => {
  const DAY = 24 * 60 * 60 * 1000;
  it('is not in cooldown if never sent', () => {
    expect(isInCooldown(undefined, 1_000_000, 1)).toBe(false);
  });
  it('is in cooldown within the window', () => {
    expect(isInCooldown(0, DAY - 1, 1)).toBe(true);
  });
  it('is out of cooldown after the window', () => {
    expect(isInCooldown(0, DAY, 1)).toBe(false);
  });
});
