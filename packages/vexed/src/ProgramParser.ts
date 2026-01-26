import { createToken, CstParser, Lexer } from "chevrotain";

const Comment = createToken({ name: "Comment", pattern: /#.*/,  group: Lexer.SKIPPED });
const WhiteSpace = createToken({ name: "WhiteSpace", pattern: /\s+/, group: Lexer.SKIPPED });

const ClassKeyword = createToken({ name: "Class", pattern: /class\b/ });
const ExtendsKeyword = createToken({ name: "Extends", pattern: /extends\b/ });
const PublicKeyword = createToken({ name: "Public", pattern: /public\b/ });
const PrivateKeyword = createToken({ name: "Private", pattern: /private\b/ });
const LetKeyword = createToken({ name: "Let", pattern: /let\b/ });
const IfKeyword = createToken({ name: "If", pattern: /if\b/ });
const ElseKeyword = createToken({ name: "Else", pattern: /else\b/ });
const ReturnKeyword = createToken({ name: "Return", pattern: /return\b/ });
const TypeofKeyword = createToken({ name: "Typeof", pattern: /typeof\b/ });

const LCurly = createToken({ name: "LCurly", pattern: /{/ });
const RCurly = createToken({ name: "RCurly", pattern: /}/ });
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const LBracket = createToken({ name: "LBracket", pattern: /\[/ });
const RBracket = createToken({ name: "RBracket", pattern: /\]/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });
const Semi = createToken({ name: "Semi", pattern: /;/ });
const Dot = createToken({ name: "Dot", pattern: /\./ });
const Colon = createToken({ name: "Colon", pattern: /:/ });
const Equal = createToken({ name: "Equal", pattern: /=/ });

const Plus = createToken({ name: "Plus", pattern: /\+/ });
const Minus = createToken({ name: "Minus", pattern: /-/ });
const Star = createToken({ name: "Star", pattern: /\*/ });
const Slash = createToken({ name: "Slash", pattern: /\// });

const Or = createToken({ name: "Or", pattern: /\|\|/ });
const And = createToken({ name: "And", pattern: /&&/ });
const Not = createToken({ name: "Not", pattern: /!/ });
const EqualsEquals = createToken({ name: "EqualsEquals", pattern: /==/ });
const NotEquals = createToken({ name: "NotEquals", pattern: /!=/ });
const LessThan = createToken({ name: "LessThan", pattern: /</ });
const LessThanOrEqual = createToken({ name: "LessThanOrEqual", pattern: /<=/ });
const GreaterThan = createToken({ name: "GreaterThan", pattern: />/ });
const GreaterThanOrEqual = createToken({ name: "GreaterThanOrEqual", pattern: />=/ });

const Identifier = createToken({ name: "Identifier", pattern: /[a-zA-Z_][a-zA-Z0-9_]*/ });
const StringLiteral = createToken({ name: "StringLiteral", pattern: /"(?:[^"\\\0-\x1F\x7F]|\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4}))*"/ });
const BooleanLiteral = createToken({ name: "BooleanLiteral", pattern: /true|false/ });
const IntegerLiteral = createToken({ name: "IntegerLiteral", pattern: /[0-9]+/ });
const DecimalLiteral = createToken({ name: "DecimalLiteral", pattern: /(?:[0-9]+\.[0-9]+|\.[0-9]+)/ });

export const allTokens = [
  Comment, WhiteSpace,
  ClassKeyword, ExtendsKeyword, PublicKeyword, PrivateKeyword, LetKeyword, IfKeyword, ElseKeyword, ReturnKeyword, TypeofKeyword,
  LBracket, RBracket, LCurly, RCurly, LParen, RParen, Dot, Comma, Colon, Semi, 
  Or, And, EqualsEquals, NotEquals, LessThanOrEqual, LessThan, GreaterThanOrEqual, GreaterThan,
  Not, Equal, Plus, Minus, Star, Slash, 
  StringLiteral, BooleanLiteral, IntegerLiteral, DecimalLiteral,
  Identifier,
];

export class ProgramParser extends CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  program = this.RULE("program", () => {
    this.MANY(() => this.SUBRULE(this.programUnit));
  });

  programUnit = this.RULE("programUnit", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.class) },
    ]);
  });

  type = this.RULE("type", () => {
    this.CONSUME(Identifier);
    this.MANY(() => this.SUBRULE(this.arrayTypeSuffix));
  });

  arrayTypeSuffix = this.RULE("arrayTypeSuffix", () => {
    this.CONSUME(LBracket);
    this.CONSUME(RBracket);
  });

  parameter = this.RULE("parameter", () => {
    this.CONSUME(Identifier);
    this.CONSUME(Colon);
    this.SUBRULE(this.type);
  });

  parameterList = this.RULE("parameterList", () => {
    this.OPTION(() => {
      this.SUBRULE(this.parameter);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.SUBRULE2(this.parameter);
      });
    });
  });

  class = this.RULE("class", () => {
    this.CONSUME(ClassKeyword);
    this.CONSUME(Identifier); // class name and parameter list
    this.CONSUME(LParen);
    this.SUBRULE(this.parameterList);
    this.CONSUME(RParen);

    this.OPTION(() => {
      this.CONSUME(ExtendsKeyword);

      this.CONSUME1(Identifier); // class name and argument list
      this.CONSUME1(LParen);
      this.SUBRULE(this.expressionList);
      this.CONSUME1(RParen);
    });

    this.CONSUME(LCurly);
    this.MANY(() => this.SUBRULE(this.classUnit));
    this.CONSUME(RCurly);
  });

  classUnit = this.RULE("classUnit", () => {
    this.OR([
      {
        // Property statement: <identifier> = <expression> (no public/private keyword)
        // Example: abstractInt = 777;
        GATE: () => {
          const la1 = this.LA(1).tokenType;
          const la2 = this.LA(2).tokenType;
          return la1 === Identifier && la2 === Equal;
        },
        ALT: () => this.SUBRULE(this.propertyStatement)
      },
      {
        // Property definition: public/private <identifier> : <type>
        // Example: public x: int = 5;
        GATE: () => {
          const la1 = this.LA(1).tokenType;
          return la1 === PublicKeyword || la1 === PrivateKeyword;
        },
        ALT: () => this.SUBRULE(this.propertyDefinition)
      },
      // Method declaration: <identifier> (...): <type>
      // Example: foo(a: string): int { ... }
      // Everything else that doesn't match above alternatives
      { ALT: () => this.SUBRULE(this.methodDeclaration) }
    ]);
  });

  methodDeclaration = this.RULE("methodDeclaration", () => {
    this.CONSUME(Identifier);

    this.CONSUME(LParen);
    this.OPTION(() => this.SUBRULE(this.parameterList));
    this.CONSUME(RParen);

    this.CONSUME(Colon);
    this.SUBRULE(this.type);

    this.SUBRULE(this.statementList);
  });

  statementList = this.RULE("statementList", () => {
    this.CONSUME(LCurly);
    this.MANY(() => this.SUBRULE(this.statement));
    this.CONSUME(RCurly);
  });

  statement = this.RULE("statement", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.ifStatement) },
      { ALT: () => this.SUBRULE(this.returnStatement) },
      { ALT: () => this.SUBRULE(this.localVarDeclaration) },
      { ALT: () => this.SUBRULE(this.localVarAssignment) },
      // { ALT: () => this.SUBRULE(this.expressionStatement) }
    ]);
  });

  localVarDeclaration = this.RULE("localVarDeclaration", () => {
    this.CONSUME(LetKeyword);
    this.CONSUME(Identifier);
    this.CONSUME(Colon);
    this.SUBRULE(this.type);
    this.CONSUME(Equal);
    this.SUBRULE(this.expression);
    this.CONSUME(Semi);
  });

  localVarAssignment = this.RULE("localVarAssignment", () => {
    this.CONSUME(Identifier);
    this.CONSUME(Equal);
    this.SUBRULE(this.expression);
    this.CONSUME(Semi);
  });

  ifStatement = this.RULE("ifStatement", () => {
    this.CONSUME(IfKeyword);
    this.CONSUME(LParen);
    this.SUBRULE(this.expression);
    this.CONSUME(RParen);
    this.SUBRULE(this.statementList);
    this.OPTION(() => {
      this.CONSUME(ElseKeyword);
      this.OR([
        { ALT: () => this.SUBRULE(this.ifStatement) },
        { ALT: () => this.SUBRULE2(this.statementList) },
      ]);
    });
  });

  returnStatement = this.RULE("returnStatement", () => {
    this.CONSUME(ReturnKeyword);
    this.OPTION(() => this.SUBRULE(this.expression));
    this.CONSUME(Semi);
  });

  propertyDefinition = this.RULE("propertyDefinition", () => {
    this.OR([
      { ALT: () => this.CONSUME(PublicKeyword) },
      { ALT: () => this.CONSUME(PrivateKeyword) },
    ])

    this.CONSUME(Identifier);
    this.CONSUME(Colon);
    this.SUBRULE(this.type);

    this.OPTION(() => {
      this.CONSUME(Equal);
      this.SUBRULE(this.expression);
    });
    this.CONSUME(Semi);
  });

  propertyStatement = this.RULE("propertyStatement", () => {
    this.CONSUME(Identifier);
    this.CONSUME(Equal);
    this.SUBRULE(this.expression);
    this.CONSUME(Semi);
  });

  expressionList = this.RULE("expressionList", () => {
    this.OPTION(() => {
      this.SUBRULE(this.expression);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.SUBRULE2(this.expression);
      });
    });
  });

  expression = this.RULE("expression", () => {
    this.SUBRULE(this.logicalOr);
  });

  logicalOr = this.RULE("logicalOr", () => {
    this.SUBRULE(this.logicalAnd);
    this.MANY(() => {
      this.CONSUME(Or);
      this.SUBRULE2(this.logicalAnd);
    });
  });

  logicalAnd = this.RULE("logicalAnd", () => {
    this.SUBRULE(this.equality);
    this.MANY(() => {
      this.CONSUME(And);
      this.SUBRULE2(this.equality);
    });
  });

  equality = this.RULE("equality", () => {
    this.SUBRULE(this.comparison);
    this.MANY(() => {
      this.OR([
        { ALT: () => { this.CONSUME(EqualsEquals); this.SUBRULE2(this.comparison); } },
        { ALT: () => { this.CONSUME(NotEquals); this.SUBRULE3(this.comparison); } }
      ]);
    });
  });

  comparison = this.RULE("comparison", () => {
    this.SUBRULE(this.additiveExpression);
    this.MANY(() => {
      this.OR([
        { ALT: () => { this.CONSUME(LessThan); this.SUBRULE2(this.additiveExpression); } },
        { ALT: () => { this.CONSUME(LessThanOrEqual); this.SUBRULE3(this.additiveExpression); } },
        { ALT: () => { this.CONSUME(GreaterThan); this.SUBRULE4(this.additiveExpression); } },
        { ALT: () => { this.CONSUME(GreaterThanOrEqual); this.SUBRULE5(this.additiveExpression); } },
      ]);
    });
  });

  additiveExpression = this.RULE("additiveExpression", () => {
    this.SUBRULE(this.multiplicativeExpression);
    this.MANY(() => {
      this.OR([
        { 
          ALT: () => {
            this.CONSUME(Plus);
            this.SUBRULE2(this.multiplicativeExpression);
          }
        },
        {
          ALT: () => {
            this.CONSUME(Minus);
            this.SUBRULE3(this.multiplicativeExpression);
          }
        },
      ]);
    });
  });

  multiplicativeExpression = this.RULE("multiplicativeExpression", () => {
    this.SUBRULE(this.unaryExpression);
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(Star);
            this.SUBRULE2(this.unaryExpression);
          }
        },
        {
          ALT: () => {
            this.CONSUME(Slash);
            this.SUBRULE3(this.unaryExpression);
          }
        },
      ]);
    });
  });

  unaryExpression = this.RULE("unaryExpression", () => {
    // NOTE: Only right‑recursive rule in the operator chain
    this.OR([
      {
        ALT: () => {
          this.CONSUME(TypeofKeyword);
          this.SUBRULE(this.unaryExpression);
        }
      },
      {
        ALT: () => {
          this.CONSUME(Not);
          this.SUBRULE2(this.unaryExpression);
        }
      },
      {
        ALT: () => this.SUBRULE(this.memberExpression)
      }
    ]);
  });

  memberExpression = this.RULE("memberExpression", () => {
    this.SUBRULE(this.primaryExpression);
    this.MANY(() => this.SUBRULE(this.suffix));
  });

  parenthesizedExpression = this.RULE("parenthesizedExpression", () => {
    this.CONSUME(LParen);
    this.SUBRULE(this.expression);
    this.CONSUME(RParen);
  });
  
  primaryExpression = this.RULE("primaryExpression", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.arrayLiteral) },
      { ALT: () => this.CONSUME(BooleanLiteral) },
      { ALT: () => this.CONSUME(Identifier) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(IntegerLiteral) },
      { ALT: () => this.CONSUME(DecimalLiteral) },
      { ALT: () => this.SUBRULE(this.parenthesizedExpression) }
    ]);
  });

  suffix = this.RULE("suffix", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Dot);
          this.CONSUME(Identifier);
        }
      },
      { ALT: () => this.SUBRULE(this.arguments) },
      { ALT: () => this.SUBRULE(this.indexSuffix) },
      { ALT: () => this.SUBRULE(this.arrayTypeSuffix) }
    ]);
  });

  arguments = this.RULE("arguments", () => {
    this.CONSUME(LParen);
    this.OPTION(() => this.SUBRULE(this.expressionList));
    this.CONSUME(RParen);
  });

  indexSuffix = this.RULE("indexSuffix", () => {
    this.CONSUME(LBracket);
    this.SUBRULE(this.expression);
    this.CONSUME(RBracket);
  });

  arrayLiteral = this.RULE("arrayLiteral", () => {
    this.CONSUME(LBracket);

    this.OPTION(() => {
      this.SUBRULE(this.expression);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.SUBRULE2(this.expression);
      });
    });

    this.CONSUME(RBracket);
  });
}
