/**
 * useSession Hook
 * Manages daily session state and composition
 */

import { useState, useEffect, useCallback } from 'react';
import { composeSession, SESSION_DURATIONS, FOCUS_MODES } from '../core/session.js';
import { getActiveSession, saveActiveSession, clearActiveSession } from '../services/storage.js';

export const useSession = () => {
  const [session, setSession] = useState(null);
  const [isActive, setIsActive] = useState(false);

  // Load session on mount
  useEffect(() => {
    getActiveSession().then(saved => {
      if (saved) {
        setSession(saved);
        setIsActive(true);
      }
    });
  }, []);

  // Start new session
  const startSession = useCallback(({ totalMinutes = SESSION_DURATIONS.DEFAULT, focusMode = FOCUS_MODES.BALANCED, units }) => {
    const composed = composeSession({
      totalMinutes,
      focusMode,
      reviewUnit: units?.review,
      coreUnit: units?.core,
      breadthUnit: units?.breadth
    });
    
    const newSession = {
      ...composed,
      startTime: Date.now(),
      currentUnitIndex: 0
    };
    
    setSession(newSession);
    setIsActive(true);
    saveActiveSession(newSession);
  }, []);

  // Complete current unit
  const completeUnit = useCallback((output) => {
    if (!session) return;
    
    const updated = {
      ...session,
      units: session.units.map((unit, idx) => 
        idx === session.currentUnitIndex 
          ? { ...unit, completed: true, output }
          : unit
      ),
      currentUnitIndex: session.currentUnitIndex + 1
    };
    
    setSession(updated);
    saveActiveSession(updated);
    
    // Check if session complete
    if (updated.currentUnitIndex >= updated.units.length) {
      endSession();
    }
  }, [session]);

  // End session
  const endSession = useCallback(() => {
    setSession(null);
    setIsActive(false);
    clearActiveSession();
  }, []);

  // Get current unit
  const currentUnit = session?.units[session.currentUnitIndex] || null;

  return {
    session,
    isActive,
    currentUnit,
    startSession,
    completeUnit,
    endSession
  };
};

