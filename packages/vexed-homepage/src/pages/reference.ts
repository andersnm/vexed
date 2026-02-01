import { marked } from 'marked';
import languageReference from '../language-reference.md?raw';

export function renderReferencePage(container: HTMLElement) {
  container.innerHTML = `
    <div class="bg-white min-h-screen">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="prose prose-lg prose-blue max-w-none
                    prose-headings:font-bold prose-headings:text-gray-900
                    prose-h1:text-4xl prose-h1:mb-8 prose-h1:text-blue-600
                    prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-gray-900 prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2
                    prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-gray-800
                    prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                    prose-strong:text-gray-900 prose-strong:font-semibold
                    prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
                    prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:shadow-lg
                    prose-pre:code:bg-transparent prose-pre:code:text-gray-100 prose-pre:code:p-0
                    prose-a:text-blue-600 prose-a:no-underline hover:prose-a:text-blue-700 hover:prose-a:underline
                    prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6
                    prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6
                    prose-li:text-gray-700 prose-li:my-2
                    prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600">
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
