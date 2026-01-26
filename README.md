# Vexed

**EXPERIMENTAL** I'm vexed! This is a WIP programming language exploring some ideas for a configuration language. Everything can and will change!

## What works

- Parser pipeline: CST -> AST -> TST -> JSON
- Type system: Built-in string, int, bool and typed arrays
- Classes and inheritance
- Constructors
- Pure functions
- Expressions
- Async `PromiseExpression`
- Lazy runtime reduction model
- Library version suitable for plain JSON

## What's TODO

- Empty array literal (contextual typing)
- Negative numbers, decimal numbers
- Native cloud provider bindings
- Iterative, multi-stage infra migrations

# Example

```ts
class Main() {
  int adder(a: int, b: int) {
    let localInt: int = 2;
    return a + b + localInt + this.memberInt;
  }

  int factorial(n: int) {
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
}
```

Compile to JSON:

```bash
$ vexed-cli json .\packages\vexed-test\files\basic-function.vexed
```

Output:

```json
{
  "memberInt": 7,
  "value1": 11,
  "value2": 21,
  "fac5": 120
}
```