import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';
import { useEventStore } from './useEventStore';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({ wsStatus: 'offline', paused: false });
  });

  it('updates ws status', () => {
    useAppStore.getState().setWsStatus('live');
    expect(useAppStore.getState().wsStatus).toBe('live');
    useAppStore.getState().setWsStatus('reconnecting');
    expect(useAppStore.getState().wsStatus).toBe('reconnecting');
  });

  it('toggles paused', () => {
    expect(useAppStore.getState().paused).toBe(false);
    useAppStore.getState().togglePaused();
    expect(useAppStore.getState().paused).toBe(true);
  });
});

describe('useEventStore', () => {
  beforeEach(() => {
    useEventStore.setState({ events: [], markers: {} });
  });

  it('caps the live event buffer', () => {
    const { pushEvent } = useEventStore.getState();
    for (let i = 0; i < 250; i++) {
      pushEvent({ id: String(i), time: '', kind: 'OPENED', process: 'p', target: 't' });
    }
    expect(useEventStore.getState().events.length).toBeLessThanOrEqual(200);
  });

  it('aggregates marker observation counts and keeps max risk', () => {
    const { upsertMarker } = useEventStore.getState();
    const base = { ip: '8.8.8.8', latitude: 1, longitude: 2, process: 'p', lastSeen: 0 };
    upsertMarker({ ...base, count: 1, risk: 10 });
    upsertMarker({ ...base, count: 1, risk: 40 });
    const marker = useEventStore.getState().markers['8.8.8.8'];
    expect(marker.count).toBe(2);
    expect(marker.risk).toBe(40);
  });
});
