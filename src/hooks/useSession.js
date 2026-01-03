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
        const hasInvalidUnit = (saved.units || []).some(unit => !unit?.item);
        if (hasInvalidUnit) {
          clearActiveSession();
          setSession(null);
          setIsActive(false);
          return;
        }
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
    
    console.log('[useSession] Starting session with units:', {
      focusMode,
      unitOrder: composed.units.map((u, i) => ({
        index: i,
        type: u.type,
        item: u.item?.name || 'none',
        domain: u.item?.domain || 'none',
        timeMinutes: u.timeMinutes
      })),
      currentUnit: composed.units[0]?.type || 'none',
      currentItem: composed.units[0]?.item?.name || 'none'
    });
    
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
      currentUnitIndex: session.currentUnitIndex + 1,
      viewUnitIndex: session.currentUnitIndex + 1 // Move view to next unit after completion
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

  // Navigate to a specific unit (for viewing only, not editing)
  const navigateUnit = useCallback((direction) => {
    if (!session) return;
    
    // Get current view index (defaults to currentUnitIndex if not set)
    const currentViewIndex = session.viewUnitIndex !== undefined 
      ? session.viewUnitIndex 
      : session.currentUnitIndex;
    
    const newIndex = direction === 'next' 
      ? currentViewIndex + 1
      : currentViewIndex - 1;
    
    // Can only view completed units or current unit (can't skip ahead)
    if (newIndex < 0 || newIndex >= session.units.length) return;
    if (newIndex > session.currentUnitIndex) return; // Can't view future units
    
    const updated = {
      ...session,
      viewUnitIndex: newIndex // Separate index for viewing
    };
    
    setSession(updated);
    saveActiveSession(updated);
  }, [session]);

  // Get current unit (for editing)
  const currentUnit = session?.units[session.currentUnitIndex] || null;
  
  // Get viewed unit (for display)
  const viewUnitIndex = session?.viewUnitIndex !== undefined ? session.viewUnitIndex : session?.currentUnitIndex;
  const viewUnit = session?.units[viewUnitIndex] || null;

  return {
    session,
    isActive,
    currentUnit,
    viewUnit,
    viewUnitIndex: viewUnitIndex ?? session?.currentUnitIndex ?? 0,
    canGoNext: session ? viewUnitIndex < session.currentUnitIndex : false,
    canGoPrev: session ? viewUnitIndex > 0 : false,
    startSession,
    completeUnit,
    navigateUnit,
    endSession
  };
};
