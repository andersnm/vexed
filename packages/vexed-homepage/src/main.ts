import './style.css';
import { renderHomePage } from './pages/home';
import { renderReferencePage } from './pages/reference';
import { renderDemoPage } from './pages/demo';

type Page = 'home' | 'reference' | 'demo';

class App {
  private currentPage: Page = 'home';
  private appElement: HTMLElement;

  constructor() {
    const appEl = document.querySelector<HTMLDivElement>('#app');
    if (!appEl) throw new Error('App element not found');
    this.appElement = appEl;
    
    this.render();
    this.setupNavigation();
  }

  private setupNavigation() {
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });
    this.handleRouteChange();
  }

  private handleRouteChange() {
    const hash = window.location.hash.slice(1) || 'home';
    this.navigateTo(hash as Page);
  }

  private navigateTo(page: Page) {
    this.currentPage = page;
    this.render();
  }

  private render() {
    this.appElement.innerHTML = '';
    
    // Create header
    const header = this.createHeader();
    this.appElement.appendChild(header);

    // Create main content
    const main = document.createElement('main');
    main.className = 'flex-1';

    switch (this.currentPage) {
      case 'home':
        renderHomePage(main);
        break;
      case 'reference':
        renderReferencePage(main);
        break;
      case 'demo':
        renderDemoPage(main);
        break;
    }

    this.appElement.appendChild(main);

    // Create footer
    const footer = this.createFooter();
    this.appElement.appendChild(footer);
  }

  private createHeader(): HTMLElement {
    const header = document.createElement('header');
    header.className = 'bg-white shadow-sm sticky top-0 z-50';
    header.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-4">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-blue-600 cursor-pointer" data-nav="home">Vexed</h1>
          </div>
          <nav class="flex space-x-8">
            <a href="#home" class="nav-link ${this.currentPage === 'home' ? 'nav-link-active' : ''}" data-nav="home">Home</a>
            <a href="#reference" class="nav-link ${this.currentPage === 'reference' ? 'nav-link-active' : ''}" data-nav="reference">Language Reference</a>
            <a href="#demo" class="nav-link ${this.currentPage === 'demo' ? 'nav-link-active' : ''}" data-nav="demo">Try It Online</a>
            <a href="https://github.com/andersnm/vexed" target="_blank" rel="noopener noreferrer" class="nav-link">
              <span class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
                </svg>
                GitHub
              </span>
            </a>
          </nav>
        </div>
      </div>
    `;
    return header;
  }

  private createFooter(): HTMLElement {
    const footer = document.createElement('footer');
    footer.className = 'bg-gray-800 text-white py-8 mt-12';
    footer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <p class="text-gray-400">
            Vexed - A type-safe configuration language
          </p>
          <p class="text-gray-500 mt-2">
            © 2026 Vexed Project. Open source under the MIT License.
          </p>
        </div>
      </div>
    `;
    return footer;
  }
}

// Initialize the app
new App();
