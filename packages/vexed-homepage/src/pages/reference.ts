import { marked } from 'marked';
import languageReference from '../language-reference.md?raw';

export function renderReferencePage(container: HTMLElement) {
  container.innerHTML = `
    <div class="bg-white min-h-screen">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="prose prose-lg prose-blue max-w-none prose-h1:text-5xl prose-h1:font-bold">
          <div id="markdown-content"></div>
        </div>
      </div>
    </div>
  `;

  const contentDiv = container.querySelector('#markdown-content');
  if (contentDiv) {
    const html = marked(languageReference) as string;
    contentDiv.innerHTML = html;
  }
}
