class FaviconManager {
  constructor() {
    this.defaultFavicon = '/favicon.ico';
    this.stopFavicon = '/stop.svg';
    this.activeFavicon = '/active-spinning.svg';
    this.currentFavicon = null;
    this.isActive = false;
    this.revertTimeout = null;
  }

  // Update favicon based on active state
  setActive(isActive) {
    const wasActive = this.isActive;
    this.isActive = isActive;
    
    // Clear any existing revert timeout
    if (this.revertTimeout) {
      clearTimeout(this.revertTimeout);
      this.revertTimeout = null;
    }
    
    // If we're stopping (was active, now inactive), show stop favicon first
    if (wasActive && !isActive) {
      this.updateFavicon(this.stopFavicon);
      // Then revert to default after 3 seconds
      this.revertTimeout = setTimeout(() => {
        this.updateFavicon(this.defaultFavicon);
        this.revertTimeout = null;
      }, 3000);
    } else {
      // Normal update for other cases
      this.updateFavicon();
    }
  }

  // Update the actual favicon in the DOM
  updateFavicon(forceFavicon = null) {
    const favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) return;

    const newFavicon = forceFavicon || (this.isActive ? this.activeFavicon : this.defaultFavicon);
    
    if (this.currentFavicon !== newFavicon) {
      favicon.href = newFavicon;
      this.currentFavicon = newFavicon;
    }
  }

  // Initialize the favicon manager
  init() {
    // Set initial favicon
    this.updateFavicon();
  }
}

// Create a singleton instance
const faviconManager = new FaviconManager();

export default faviconManager;
