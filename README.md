# Vexed

**EXPERIMENTAL** I'm vexed! This is a WIP programming language exploring some ideas for a configuration language. Everything can and will change!

## What works

- Parser pipeline: CST -> AST -> TST
- Type system: Built-in string, int and typed arrays
- Classes and inheritance
- Constructors
- String, int array literals
- Expressions
- Lazy runtime reduction model

## What's TODO

- Empty array literal (contextual typing)
- Functions + SSA
- `PromiseExpression`
- Library version suitable for plain JSON
- Native cloud provider bindings
- Iterative, multi-stage infra migrations

# Example

```ts
class AbstractClass2(string alltheway) {
  public string name;
  public string[] description = [ "Default value", "Myagki snak" ];
  public string can_we_do_it = this.name;
  public string alltheway = alltheway;
  public int lenn = this.description.length;
  public string arrayElemement = this.description[1];
  public string[] lele = string[](); # Empty array literal not working yet
}

class Concrete(string passor, Main cyclic) extends AbstractClass2(passor) {
  name = passor;
  public Main cycle = cyclic;
}

class Temp(string l, int i, Main self) {
  public int len = l.length;
  public string copy = l;
  public string ff = self.description[i];
}

class Main() extends Concrete(this.test.name, this) {
  private Concrete test = Concrete("Woop", this);
  public string t56 = "It's a string";
  public Temp tmp = Temp("This string has length", 0, this);
  public Temp tmp2 = Temp("New version", 1, this);
}

```

Output:

```json
{
  name: string = ""Woop""
  description: string[] = (#string[])[""Default value"", ""Myagki snak""]{
    length: int = 2
  }
  can_we_do_it: string = ""Woop""
  alltheway: string = ""Woop""
  lenn: int = 2
  arrayElemement: string = ""Myagki snak""
  lele: string[] = (#string[])[]{
    length: int = 0
  }
  cycle: Main = (#Main) { ... }
  test: Concrete = (#Concrete){
    name: string = ""Woop""
    description: string[] = (#string[]) { ... }
    can_we_do_it: string = ""Woop""
    alltheway: string = ""Woop""
    lenn: int = 2
    arrayElemement: string = ""Myagki snak""
    lele: string[] = (#string[])[]{
      length: int = 0
    }
    cycle: Main = (#Main) { ... }
  }
  t56: string = ""It's a string""
  tmp: Temp = (#Temp){
    len: int = 24
    copy: string = ""This string has length""
    ff: string = ""Default value""
  }
  tmp2: Temp = (#Temp){
    len: int = 13
    copy: string = ""New version""
    ff: string = ""Myagki snak""
  }
}
```