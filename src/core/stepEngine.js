/**
 * Step Engine
 * Manages timeline, steps, and stroke script execution
 */

export class StepEngine {
  constructor() {
    this.steps = [];
    this.currentStepIndex = -1;
    this.branches = new Map(); // branchId -> steps
    this.currentBranchId = 'main';
  }

  /**
   * Add a step
   */
  addStep(step) {
    const stepWithId = {
      id: step.id || `step_${Date.now()}_${Math.random()}`,
      timestamp: step.timestamp || Date.now(),
      semanticDelta: step.semanticDelta || {},
      strokeScript: step.strokeScript || [],
      description: step.description || '',
      branchId: step.branchId || this.currentBranchId,
      ...step
    };

    // Add to current branch
    if (!this.branches.has(this.currentBranchId)) {
      this.branches.set(this.currentBranchId, []);
    }
    this.branches.get(this.currentBranchId).push(stepWithId);

    // If this is the main branch, add to main steps array
    if (this.currentBranchId === 'main') {
      this.steps.push(stepWithId);
      this.currentStepIndex = this.steps.length - 1;
    }

    return stepWithId;
  }

  /**
   * Go to next step
   */
  async nextStep(onStepExecute) {
    const nextIndex = this.currentStepIndex + 1;
    if (nextIndex >= this.steps.length) {
      return null; // No more steps
    }

    const step = this.steps[nextIndex];
    this.currentStepIndex = nextIndex;

    if (onStepExecute) {
      await onStepExecute(step, 'forward');
    }

    return step;
  }

  /**
   * Go to previous step (backstep)
   */
  async backstep(onStepExecute, realismMode = 'erase') {
    if (this.currentStepIndex < 0) {
      return null; // Already at beginning
    }

    const step = this.steps[this.currentStepIndex];
    this.currentStepIndex = Math.max(-1, this.currentStepIndex - 1);

    if (onStepExecute) {
      await onStepExecute(step, 'backward', realismMode);
    }

    return step;
  }

  /**
   * Create a branch at current step
   */
  createBranch(branchName) {
    const branchId = `branch_${Date.now()}_${Math.random()}`;
    const parentStepId = this.currentStepIndex >= 0 
      ? this.steps[this.currentStepIndex].id 
      : null;

    this.branches.set(branchId, []);
    
    return {
      id: branchId,
      name: branchName,
      parentStepId,
      steps: []
    };
  }

  /**
   * Switch to a branch
   */
  switchBranch(branchId) {
    if (!this.branches.has(branchId)) {
      return false;
    }

    this.currentBranchId = branchId;
    const branchSteps = this.branches.get(branchId);
    
    // Update main steps to branch steps
    this.steps = branchSteps;
    this.currentStepIndex = branchSteps.length - 1;

    return true;
  }

  /**
   * Get current step
   */
  getCurrentStep() {
    if (this.currentStepIndex < 0 || this.currentStepIndex >= this.steps.length) {
      return null;
    }
    return this.steps[this.currentStepIndex];
  }

  /**
   * Get step by index
   */
  getStep(index) {
    if (index < 0 || index >= this.steps.length) {
      return null;
    }
    return this.steps[index];
  }

  /**
   * Get all steps
   */
  getAllSteps() {
    return [...this.steps];
  }

  /**
   * Get current step index
   */
  getCurrentStepIndex() {
    return this.currentStepIndex;
  }

  /**
   * Get total step count
   */
  getTotalSteps() {
    return this.steps.length;
  }

  /**
   * Clear all steps
   */
  clear() {
    this.steps = [];
    this.currentStepIndex = -1;
    this.branches.clear();
    this.currentBranchId = 'main';
  }
}

