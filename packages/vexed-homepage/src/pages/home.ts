export function renderHomePage(container: HTMLElement) {
  container.innerHTML = `
    <div class="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h1 class="text-5xl font-bold text-gray-900 mb-6">
            The Vexed Configuration Language
          </h1>
          <p class="text-xl text-gray-700 mb-8 max-w-3xl mx-auto">
            An <strong>EXPERIMENTAL</strong> type‑safe, declarative configuration language with functional and object‑oriented features.
          </p>
          <div class="flex justify-center gap-4">
            <a href="#demo" class="btn-primary">Try It Online</a>
            <a href="#reference" class="btn-secondary">Learn More</a>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900 mb-6">Features</h2>
          <ul class="space-y-4">
            <li class="flex items-start">
              <svg class="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <strong class="text-gray-900">Type System</strong>
                <p class="text-gray-600">Built-in support for int, string, bool, arrays, and custom types with full type checking</p>
              </div>
            </li>
            <li class="flex items-start">
              <svg class="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <strong class="text-gray-900">Classes & Inheritance</strong>
                <p class="text-gray-600">Object-oriented design with class hierarchies and constructor parameters</p>
              </div>
            </li>
            <li class="flex items-start">
              <svg class="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <strong class="text-gray-900">Computed Properties</strong>
                <p class="text-gray-600">Define properties using methods and expressions for dynamic configurations</p>
              </div>
            </li>
            <li class="flex items-start">
              <svg class="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <strong class="text-gray-900">Pure Functions</strong>
                <p class="text-gray-600">Supports functions without side effects. Local variables are mutable</p>
              </div>
            </li>
            <li class="flex items-start">
              <svg class="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <strong class="text-gray-900">Array Transformations</strong>
                <p class="text-gray-600">Supports transformations using <code>array[].map()</code></p>
              </div>
            </li>
            <li class="flex items-start">
              <svg class="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <strong class="text-gray-900">Lazy Evaluation</strong>
                <p class="text-gray-600">Runtime with lazy reduction model</p>
              </div>
            </li>
            <li class="flex items-start">
              <svg class="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              <div>
                <strong class="text-gray-900">JSON Output</strong>
                <p class="text-gray-600">Compile to clean, readable JSON for easy integration</p>
              </div>
            </li>
          </ul>
        </div>

        <div>
          <h2 class="text-3xl font-bold text-gray-900 mb-6">Example</h2>
          <div class="bg-gray-900 rounded-lg p-6 overflow-x-auto">
            <pre class="text-gray-100 text-sm font-mono"><code>class Main() {
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
}</code></pre>
          </div>
          
          <div class="mt-6">
            <h3 class="text-xl font-semibold text-gray-900 mb-3">Compiles to:</h3>
            <div class="bg-white border border-gray-200 rounded-lg p-6">
              <pre class="text-gray-800 text-sm font-mono"><code>{
  "memberInt": 7,
  "value1": 11,
  "value2": 21,
  "fac5": 120
}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- div class="bg-gray-50 py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-gray-900 mb-8 text-center">Why Vexed?</h2>
        <div class="grid md:grid-cols-3 gap-8">
          <div class="bg-white p-6 rounded-lg shadow-sm">
            <div class="text-blue-600 mb-4">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Type Safety</h3>
            <p class="text-gray-600">Catch errors at compile-time with strong static typing and comprehensive type checking.</p>
          </div>

          <div class="bg-white p-6 rounded-lg shadow-sm">
            <div class="text-blue-600 mb-4">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Familiar Syntax</h3>
            <p class="text-gray-600">TypeScript/JavaScript-inspired syntax makes it easy to learn and write.</p>
          </div>

          <div class="bg-white p-6 rounded-lg shadow-sm">
            <div class="text-blue-600 mb-4">
              <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-2">Powerful Features</h3>
            <p class="text-gray-600">Inheritance, computed properties, and pure functions for complex configurations.</p>
          </div>
        </div>
      </div>
    </div -->

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="text-center">
        <h2 class="text-3xl font-bold text-gray-900 mb-6">Get Started</h2>
        <p class="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
          Try Vexed in your browser right now or check out the language reference to learn more.
        </p>
        <div class="flex justify-center gap-4">
          <a href="#demo" class="btn-primary">Try It Online</a>
          <a href="https://github.com/andersnm/vexed" target="_blank" rel="noopener noreferrer" class="btn-secondary">View on GitHub</a>
        </div>
      </div>
    </div>
  `;
}
