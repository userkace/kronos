// Storage event system for efficient cross-component communication
// Eliminates the need for polling by using custom events

class StorageEventSystem {
  constructor() {
    this.listeners = new Map();
    this.lastKnownData = new Map();
    this.isInitialized = false;
    this.originalMethods = {};
  }

  // Initialize the event system
  init() {
    if (this.isInitialized) return;
    
    // Listen for native storage events (cross-tab)
    window.addEventListener('storage', this.handleNativeStorageChange.bind(this));
    
    // Start monitoring for in-tab changes
    this.startInTabMonitoring();
    
    this.isInitialized = true;
  }

  // Start monitoring localStorage for in-tab changes
  startInTabMonitoring() {
    // Override localStorage methods to detect in-tab changes
    this.originalMethods.setItem = localStorage.setItem.bind(localStorage);
    this.originalMethods.removeItem = localStorage.removeItem.bind(localStorage);
    this.originalMethods.clear = localStorage.clear.bind(localStorage);

    localStorage.setItem = (key, value) => {
      const oldValue = localStorage.getItem(key);
      try {
        this.originalMethods.setItem(key, value);
        // Only notify listeners if the operation succeeded
        this.detectChanges(key, oldValue, value);
      } catch (error) {
        // Re-throw the error after logging
        console.error('localStorage.setItem failed:', error);
        throw error;
      }
    };

    localStorage.removeItem = (key) => {
      const oldValue = localStorage.getItem(key);
      try {
        this.originalMethods.removeItem(key);
        // Only notify listeners if the operation succeeded
        this.detectChanges(key, oldValue, null);
      } catch (error) {
        // Re-throw the error after logging
        console.error('localStorage.removeItem failed:', error);
        throw error;
      }
    };

    localStorage.clear = () => {
      // Store current values before clearing
      const currentValues = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        currentValues[key] = localStorage.getItem(key);
      }
      
      try {
        this.originalMethods.clear();
        // Only notify listeners if the operation succeeded
        Object.keys(currentValues).forEach(key => {
          this.detectChanges(key, currentValues[key], null);
        });
      } catch (error) {
        // Re-throw the error after logging
        console.error('localStorage.clear failed:', error);
        throw error;
      }
    };
  }

  // Handle native storage events (cross-tab changes)
  handleNativeStorageChange(event) {
    const { key, oldValue, newValue } = event;
    this.detectChanges(key, oldValue, newValue);
  }

  // Detect and emit changes for a specific key
  detectChanges(key, oldValue, newValue) {
    // Only emit if the value actually changed
    if (oldValue === newValue) return;

    // Update last known data
    this.lastKnownData.set(key, newValue);

    // Emit custom event for this key
    this.emit(key, { key, oldValue, newValue });
  }

  // Subscribe to storage changes for a specific key
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    
    this.listeners.get(key).add(callback);
    
    // Store initial value if not already stored
    if (!this.lastKnownData.has(key)) {
      this.lastKnownData.set(key, localStorage.getItem(key));
    }

    // Return unsubscribe function
    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        keyListeners.delete(callback);
        if (keyListeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  // Emit event to all listeners for a key
  emit(key, data) {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in storage event listener:', error);
        }
      });
    }
  }

  // Get the last known value for a key
  getLastKnownValue(key) {
    return this.lastKnownData.get(key);
  }

  // Force a check for changes (useful for initialization)
  forceCheck(key) {
    const currentValue = localStorage.getItem(key);
    const lastKnownValue = this.lastKnownData.get(key);
    
    if (currentValue !== lastKnownValue) {
      this.detectChanges(key, lastKnownValue, currentValue);
    }
  }

  // Cleanup method
  destroy() {
    window.removeEventListener('storage', this.handleNativeStorageChange);
    
    // Restore original localStorage methods if they were overridden
    if (this.originalMethods.setItem) {
      localStorage.setItem = this.originalMethods.setItem;
    }
    if (this.originalMethods.removeItem) {
      localStorage.removeItem = this.originalMethods.removeItem;
    }
    if (this.originalMethods.clear) {
      localStorage.clear = this.originalMethods.clear;
    }
    
    this.listeners.clear();
    this.lastKnownData.clear();
    this.originalMethods = {};
    this.isInitialized = false;
  }
}

// Create singleton instance
const storageEventSystem = new StorageEventSystem();

// Auto-initialize
storageEventSystem.init();

export default storageEventSystem;
