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
  const startSession = useCallback(({ totalMinutes = SESSION_DURATIONS.DEFAULT, focusMode = FOCUS_MODES.BALANCED, units, isUntimed, questionCount }) => {
    let composed;
    
    // Handle mood mode (untimed)
    if (focusMode === FOCUS_MODES.MOOD && isUntimed) {
      composed = {
        totalMinutes: null,
        focusMode: FOCUS_MODES.MOOD,
        isUntimed: true,
        questionCount: questionCount || units?.length || 5,
        units: units || []
      };
    } else {
      // Regular timed session
      composed = composeSession({
        totalMinutes,
        focusMode,
        reviewUnit: units?.review,
        coreUnit: units?.core,
        breadthUnit: units?.breadth
      });
    }
    
    const newSession = {
      ...composed,
      startTime: Date.now(),
      currentUnitIndex: 0,
      viewUnitIndex: 0
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
    
    // Allow viewing all units (both timed and untimed)
    // Editing is still restricted to currentUnitIndex
    if (newIndex < 0 || newIndex >= session.units.length) return;
    
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

  // Allow viewing all units (both timed and untimed)
  // Editing is still restricted to currentUnitIndex
  const canGoNext = session ? viewUnitIndex < session.units.length - 1 : false;
  const canGoPrev = session ? viewUnitIndex > 0 : false;

  return {
    session,
    isActive,
    currentUnit,
    viewUnit,
    viewUnitIndex: viewUnitIndex ?? session?.currentUnitIndex ?? 0,
    canGoNext,
    canGoPrev,
    startSession,
    completeUnit,
    navigateUnit,
    endSession
  };
};
