# Vexed Language Reference

## Introduction

Vexed is a **configuration language** designed to be type-safe, declarative, and intuitive. It combines familiar syntax from TypeScript/JavaScript with powerful type checking and a lazy evaluation model that makes it ideal for configuration management.

## Basic Syntax

### Comments

Vexed supports single-line comments using the `#` symbol:

```vexed
# This is a comment
```

### Classes

Classes are the fundamental building blocks in Vexed. Every Vexed program must have a `Main` class as the entry point:

```vexed
class Main() {
  public value: int = 42;
}
```

### Class Parameters

Classes can accept parameters in their constructor:

```vexed
class Server(port: int, host: string) {
  public serverPort: int = port;
  public serverHost: string = host;
}
```

### Inheritance

Classes can extend other classes using the `extends` keyword:

```vexed
class Base(num: int) {
  public baseNumber: int = num;
}

class Main() extends Base(100) {
  public mainValue: int = 200;
}
```

## Type System

Vexed has a strong static type system with the following built-in types:

### Primitive Types

- **int**: Integer numbers (e.g., `42`, `100`, `-5`)
- **string**: Text strings (e.g., `"hello"`, `"world"`)
- **bool**: Boolean values (`true` or `false`)
- **any**: Can hold any value

### Type Declarations

Variables must be declared with explicit types:

```vexed
class Main() {
  public age: int = 25;
  public name: string = "Alice";
  public isActive: bool = true;
}
```

### Arrays

Arrays are typed collections of elements:

```vexed
class Main() {
  public numbers: int[] = [1, 2, 3, 4, 5];
  public names: string[] = ["Alice", "Bob", "Charlie"];
  public matrix: int[][] = [[1, 2], [3, 4]];
}
```

### Type Type

The special `type` type refers to class types themselves:

```vexed
class Helper() {
  public value: int = 42;
}

class Main() {
  public helperType: type = Helper;
  public scriptPath: string = (typeof this).scriptPath;
}
```

## Properties

### Public Properties

Properties marked as `public` are part of the final output:

```vexed
class Main() {
  public visible: int = 1;
}
```

### Private Properties

Properties marked as `private` are not included in the JSON output:

```vexed
class Main() {
  private internal: int = 1;
  public result: int = this.internal * 2;
}
```

## Methods

### Method Declaration

Methods are pure functions that can perform computations:

```vexed
class Main() {
  add(a: int, b: int): int {
    return a + b;
  }

  public result: int = this.add(5, 3);
}
```

### Method Parameters

Methods accept typed parameters:

```vexed
class Main() {
  greet(name: string): string {
    return "Hello, " + name;
  }

  public greeting: string = this.greet("World");
}
```

### Return Types

Methods must specify their return type:

```vexed
class Main() {
  isPositive(num: int): bool {
    return num > 0;
  }

  public check: bool = this.isPositive(42);
}
```

## Expressions

### Arithmetic Operators

Vexed supports standard arithmetic operations:

```vexed
class Main() {
  public sum: int = 10 + 5;          # Addition
  public difference: int = 10 - 5;    # Subtraction
  public product: int = 10 * 5;       # Multiplication
  public quotient: int = 10 / 5;      # Division
}
```

### String Concatenation

Strings can be concatenated using the `+` operator:

```vexed
class Main() {
  public firstName: string = "John";
  public lastName: string = "Doe";
  public fullName: string = firstName + " " + lastName;
}
```

### Comparison Operators

Vexed supports comparison operations:

```vexed
class Main() {
  public greater: bool = 5 > 3;       # Greater than
  public less: bool = 3 < 5;          # Less than
  public greaterEq: bool = 5 >= 5;    # Greater than or equal
  public lessEq: bool = 3 <= 5;       # Less than or equal
  public equal: bool = 5 == 5;        # Equal
  public notEqual: bool = 5 != 3;     # Not equal
}
```

### Logical Operators

Boolean logic operators are available:

```vexed
class Main() {
  public andResult: bool = true && false;   # Logical AND
  public orResult: bool = true || false;    # Logical OR
  public notResult: bool = !true;           # Logical NOT
}
```

## Control Flow

### If Statements

Conditional execution using if-else:

```vexed
class Main() {
  checkValue(num: int): string {
    if (num > 10) {
      return "Large";
    } else {
      return "Small";
    }
  }

  public result: string = this.checkValue(15);
}
```

### Nested Conditions

If statements can be nested:

```vexed
class Main() {
  classify(num: int): string {
    if (num > 0) {
      if (num > 100) {
        return "Very Large";
      } else {
        return "Positive";
      }
    } else {
      return "Non-positive";
    }
  }

  public classification: string = this.classify(150);
}
```

## Variables

### Let Declarations

Local variables can be declared with `let`:

```vexed
class Main() {
  calculate(): int {
    let x: int = 5;
    let y: int = 10;
    return x + y;
  }

  public result: int = this.calculate();
}
```

### Const Declarations

Immutable local variables using `const`:

```vexed
class Main() {
  compute(): int {
    const factor: int = 2;
    return 10 * factor;
  }

  public value: int = this.compute();
}
```

### Variable Assignment

Variables declared with `let` can be reassigned:

```vexed
class Main() {
  factorial(n: int): int {
    if (n <= 1) {
      return 1;
    }
    let next: int = n;
    next = next - 1;
    return n * this.factorial(next);
  }

  public fac5: int = this.factorial(5);
}
```

## Instance Creation

### Creating Instances

Create instances of classes using the class name followed by arguments:

```vexed
class Helper(value: int) {
  public helperValue: int = value;
}

class Main() {
  public helper: Helper = Helper(42);
}
```

### Instance Literals

Create inline instances without defining separate classes:

```vexed
class Main() {
  public config: {
    port: int,
    host: string
  } = {
    port: 8080,
    host: "localhost"
  };
}
```

## Array Operations

### Array Indexing

Access array elements using square brackets:

```vexed
class Main() {
  public numbers: int[] = [10, 20, 30];
  public firstNumber: int = numbers[0];
}
```

### Array Methods

Arrays support higher-order functions like `map`:

```vexed
class Main() {
  double(x: int): int {
    return x * 2;
  }

  public numbers: int[] = [1, 2, 3];
  public doubled: int[] = numbers.map(this.double);
}
```

## Special Features

### The `this` Keyword

Reference the current instance using `this`:

```vexed
class Main() {
  public value: int = 42;
  
  getValue(): int {
    return this.value;
  }

  public result: int = this.getValue();
}
```

### The `typeof` Operator

Get the type of an instance:

```vexed
class Main() {
  public scriptPath: string = (typeof this).scriptPath;
}
```

### The `io` Object

Built-in I/O operations (environment-specific):

```vexed
class Main() {
  public message: any = io.print("Hello, World!");
}
```

## Asynchronous Operations

Vexed supports asynchronous operations through promises:

```vexed
class Main() {
  # In Node.js environment
  public content: string = io.readTextFile("./file.txt");
  
  processContent(data: string): string {
    return data;
  }

  public processed: string = this.processContent(this.content);
}
```

## Best Practices

### 1. Use Strong Typing

Always specify types explicitly for clarity and type safety:

```vexed
# Good
public count: int = 42;

# Avoid
public count: any = 42;
```

### 2. Keep Methods Pure

Methods should be pure functions without side effects:

```vexed
# Good
add(a: int, b: int): int {
  return a + b;
}
```

### 3. Use Meaningful Names

Choose descriptive names for classes, methods, and properties:

```vexed
# Good
class ServerConfiguration(port: int) {
  public serverPort: int = port;
}

# Avoid
class SC(p: int) {
  public sp: int = p;
}
```

### 4. Leverage Inheritance

Use inheritance to share common functionality:

```vexed
class BaseConfig(env: string) {
  public environment: string = env;
}

class AppConfig() extends BaseConfig("production") {
  public appName: string = "MyApp";
}
```

## Complete Example

Here's a comprehensive example demonstrating multiple Vexed features:

```vexed
class DatabaseConfig(host: string, port: int) {
  public dbHost: string = host;
  public dbPort: int = port;
  public connectionString: string = host + ":" + this.portAsString();

  portAsString(): string {
    # Convert port to string (simplified)
    return "port";
  }
}

class ServerConfig(env: string) {
  public environment: string = env;
  public isProduction: bool = env == "production";
  
  getPort(): int {
    if (this.isProduction) {
      return 443;
    } else {
      return 8080;
    }
  }
  
  public port: int = this.getPort();
}

class Main() extends ServerConfig("production") {
  public appName: string = "VexedApp";
  public version: string = "1.0.0";
  public database: DatabaseConfig = DatabaseConfig("localhost", 5432);
  
  public servers: string[] = [
    "server1.example.com",
    "server2.example.com",
    "server3.example.com"
  ];

  calculateUptime(hours: int): int {
    const hoursPerDay: int = 24;
    return hours / hoursPerDay;
  }

  public uptimeDays: int = this.calculateUptime(720);
}
```

This will produce a JSON output like:

```json
{
  "environment": "production",
  "isProduction": true,
  "port": 443,
  "appName": "VexedApp",
  "version": "1.0.0",
  "database": {
    "dbHost": "localhost",
    "dbPort": 5432,
    "connectionString": "localhost:port"
  },
  "servers": [
    "server1.example.com",
    "server2.example.com",
    "server3.example.com"
  ],
  "uptimeDays": 30
}
```

## Conclusion

Vexed provides a powerful yet intuitive way to express configurations with strong typing, inheritance, and computed properties. Its lazy evaluation model and type safety make it ideal for managing complex configurations declaratively.
