import { useCallback, useEffect, useRef, useState } from 'react';

const SHAKE_ACCELERATION_THRESHOLD = 28;
const SHAKE_DELTA_THRESHOLD = 14;
const SHAKE_COOLDOWN_MS = 1200;

interface MotionEnabledDeviceMotionEventConstructor {
  new (type: string, eventInitDict?: EventInit): DeviceMotionEvent;
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export type StudyMotionPermissionState = 'unsupported' | 'prompt' | 'granted' | 'denied';

const supportsTouchMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.DeviceMotionEvent !== 'undefined' &&
  (typeof navigator === 'undefined' ? false : navigator.maxTouchPoints > 0);

const requestDeviceMotionAccess = async () => {
  if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') {
    return false;
  }

  const motionEvent = window.DeviceMotionEvent as MotionEnabledDeviceMotionEventConstructor;
  if (typeof motionEvent.requestPermission === 'function') {
    try {
      return (await motionEvent.requestPermission()) === 'granted';
    } catch (error) {
      console.warn('Device motion permission request failed:', error);
      return false;
    }
  }

  return true;
};

interface UseStudyMotionUndoOptions {
  disabled: boolean;
  focusMode: boolean;
  onShake: () => Promise<void> | void;
  ignorePromise: (task?: Promise<unknown>) => void;
}

function getInitialMotionPermissionState(): StudyMotionPermissionState {
  return supportsTouchMotion() ? 'prompt' : 'unsupported';
}

export function useStudyMotionUndo({
  disabled,
  focusMode,
  onShake,
  ignorePromise,
}: UseStudyMotionUndoOptions) {
  const [motionPermissionState, setMotionPermissionState] = useState<StudyMotionPermissionState>(
    getInitialMotionPermissionState
  );
  const motionEnabledRef = useRef(false);
  const lastShakeAtRef = useRef(0);
  const lastMotionMagnitudeRef = useRef<number | null>(null);

  const requestMotionPermission = useCallback(async () => {
    if (!supportsTouchMotion()) {
      motionEnabledRef.current = false;
      setMotionPermissionState('unsupported');
      return false;
    }

    const granted = await requestDeviceMotionAccess();
    motionEnabledRef.current = granted;
    setMotionPermissionState(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  const resetMotionState = useCallback(() => {
    motionEnabledRef.current = false;
    lastShakeAtRef.current = 0;
    lastMotionMagnitudeRef.current = null;
    setMotionPermissionState(getInitialMotionPermissionState());
  }, []);

  useEffect(() => {
    if (!focusMode) {
      resetMotionState();
    }
  }, [focusMode, resetMotionState]);

  useEffect(() => {
    if (!focusMode) return undefined;

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      if (!motionEnabledRef.current || disabled) {
        return;
      }

      const acceleration = event.accelerationIncludingGravity ?? event.acceleration;
      if (!acceleration) return;

      const x = Math.abs(acceleration.x ?? 0);
      const y = Math.abs(acceleration.y ?? 0);
      const z = Math.abs(acceleration.z ?? 0);
      const magnitude = x + y + z;
      const previousMagnitude = lastMotionMagnitudeRef.current;
      lastMotionMagnitudeRef.current = magnitude;

      if (previousMagnitude === null) return;

      const delta = Math.abs(magnitude - previousMagnitude);
      const now = Date.now();

      if (
        magnitude >= SHAKE_ACCELERATION_THRESHOLD &&
        delta >= SHAKE_DELTA_THRESHOLD &&
        now - lastShakeAtRef.current >= SHAKE_COOLDOWN_MS
      ) {
        lastShakeAtRef.current = now;
        ignorePromise(Promise.resolve(onShake()));
      }
    };

    window.addEventListener('devicemotion', handleDeviceMotion);
    return () => window.removeEventListener('devicemotion', handleDeviceMotion);
  }, [disabled, focusMode, ignorePromise, onShake]);

  return {
    motionPermissionState,
    requestMotionPermission,
    resetMotionState,
  };
}
