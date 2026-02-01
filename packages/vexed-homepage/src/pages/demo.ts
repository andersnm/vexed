import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { TstRuntime, printJsonObject, ScriptError } from 'vexed';
import { registerBrowserTypes } from 'vexed-browser';

const defaultCode = `class Main() {
  adder(a: int, b: int): int {
    let localInt: int = 2;
    return a + b + localInt + this.memberInt;
  }

  factorial(n: int): int {
    if (n <= 1) {
      return 1;
    }
    let next: int = n;
    next = next - 1;
    return n * this.factorial(next);
  }

  public memberInt: int = 7;
  public value1: int = this.adder(1, 1);
  public value2: int = this.adder(1, this.value1);
  public fac5: int = this.factorial(5);
}`;

export function renderDemoPage(container: HTMLElement) {
  container.innerHTML = `
    <div class="bg-gray-50 min-h-screen">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-gray-900 mb-4">Try Vexed Online</h1>
          <p class="text-xl text-gray-700">Write Vexed code and see the JSON output in real-time</p>
        </div>

        <div class="grid lg:grid-cols-2 gap-6">
          <div>
            <div class="mb-3 flex justify-between items-center">
              <h2 class="text-xl font-semibold text-gray-900">Vexed Code</h2>
              <button id="run-button" class="btn-primary text-sm">Run Code</button>
            </div>
            <div id="editor" class="border border-gray-300 rounded-lg overflow-hidden shadow-sm"></div>
            <div id="console-output" class="mt-4 hidden">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">Console Output</h3>
              <div id="console-content" class="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-32 overflow-y-auto"></div>
            </div>
          </div>

          <div>
            <h2 class="text-xl font-semibold text-gray-900 mb-3">JSON Output</h2>
            <div id="output" class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
              <pre class="text-gray-600 text-sm font-mono whitespace-pre-wrap">Click "Run Code" to see output...</pre>
            </div>
            <div id="error-output" class="mt-4 hidden">
              <h3 class="text-lg font-semibold text-red-600 mb-2">Errors</h3>
              <div id="error-content" class="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg text-sm"></div>
            </div>
          </div>
        </div>

        <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-blue-900 mb-2">Tips:</h3>
          <ul class="text-blue-800 space-y-1">
            <li>• Every Vexed program needs a <code class="bg-blue-100 px-1 rounded">Main</code> class</li>
            <li>• Use <code class="bg-blue-100 px-1 rounded">public</code> properties to include them in the JSON output</li>
            <li>• Use <code class="bg-blue-100 px-1 rounded">io.print()</code> to output debug messages to the console</li>
            <li>• Try the examples: factorial, arithmetic operations, string concatenation, conditionals</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  // Setup CodeMirror editor
  const editorDiv = container.querySelector('#editor');
  if (!editorDiv) return;

  const editor = new EditorView({
    doc: defaultCode,
    extensions: [
      basicSetup,
      javascript(),
      oneDark,
      EditorView.lineWrapping,
    ],
    parent: editorDiv as HTMLElement,
  });

  // Setup run button
  const runButton = container.querySelector('#run-button');
  if (runButton) {
    runButton.addEventListener('click', () => runCode(editor));
  }

  // Auto-run on load
  setTimeout(() => runCode(editor), 100);
}

function runCode(editor: EditorView) {
  const code = editor.state.doc.toString();
  const outputDiv = document.querySelector('#output');
  const errorDiv = document.querySelector('#error-output');
  const errorContent = document.querySelector('#error-content');
  const consoleDiv = document.querySelector('#console-output');
  const consoleContent = document.querySelector('#console-content');

  if (!outputDiv || !errorDiv || !errorContent || !consoleDiv || !consoleContent) return;

  // Reset outputs
  errorDiv.classList.add('hidden');
  consoleDiv.classList.add('hidden');
  const consoleMessages: string[] = [];

  try {
    const runtime = new TstRuntime();
    
    // Register browser types with custom output callback
    registerBrowserTypes(runtime, (message: string) => {
      consoleMessages.push(message);
    });

    runtime.loadScript(code, 'demo.vexed');

    const main = runtime.tryGetType('Main');
    if (!main) {
      throw new ScriptError('Type error', [{
        message: 'Main class entrypoint not found',
        location: { fileName: 'demo.vexed', line: 1, column: 1, startOffset: 0, endOffset: 0, image: '' }
      }]);
    }

    const instance = main.createInstance([]);
    
    // Run the reduction
    runtime.reduceInstance(instance).then(() => {
      const jsonOutput = printJsonObject(instance, false);
      outputDiv.innerHTML = `<pre class="text-gray-800 text-sm font-mono whitespace-pre-wrap">${JSON.stringify(jsonOutput, null, 2)}</pre>`;
      
      // Show console output if any
      if (consoleMessages.length > 0) {
        consoleDiv.classList.remove('hidden');
        consoleContent.innerHTML = consoleMessages.map(msg => 
          `<div>${escapeHtml(msg)}</div>`
        ).join('');
      }
    }).catch((err) => {
      handleError(err, errorDiv, errorContent);
    });

  } catch (err) {
    handleError(err, errorDiv, errorContent);
  }
}

function handleError(err: any, errorDiv: Element, errorContent: Element) {
  errorDiv.classList.remove('hidden');
  
  if (err instanceof ScriptError) {
    const errors = err.errors.map(error => 
      `${error.location.fileName}:${error.location.line}:${error.location.column} - ${error.message}`
    ).join('\n');
    errorContent.innerHTML = `<pre class="whitespace-pre-wrap">${escapeHtml(errors)}</pre>`;
  } else {
    errorContent.innerHTML = `<pre class="whitespace-pre-wrap">${escapeHtml(err.message || String(err))}</pre>`;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
