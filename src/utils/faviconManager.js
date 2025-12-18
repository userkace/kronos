class FaviconManager {
  constructor() {
    this.defaultFavicon = '/vite.svg';
    this.activeFavicon = '/active-spinning.svg';
    this.currentFavicon = null;
    this.isActive = false;
  }

  // Update favicon based on active state
  setActive(isActive) {
    this.isActive = isActive;
    this.updateFavicon();
  }

  // Update the actual favicon in the DOM
  updateFavicon() {
    const favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) return;

    const newFavicon = this.isActive ? this.activeFavicon : this.defaultFavicon;
    
    if (this.currentFavicon !== newFavicon) {
      favicon.href = newFavicon;
      this.currentFavicon = newFavicon;
      console.log(`Favicon updated to: ${newFavicon}`);
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
