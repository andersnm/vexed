import { createToken, CstParser, Lexer } from "chevrotain";

const Comment = createToken({ name: "Comment", pattern: /#.*/,  group: Lexer.SKIPPED });
const WhiteSpace = createToken({ name: "WhiteSpace", pattern: /\s+/, group: Lexer.SKIPPED });

const ClassKeyword = createToken({ name: "Class", pattern: /class/ });
const ExtendsKeyword = createToken({ name: "Extends", pattern: /extends/ });
const PublicKeyword = createToken({ name: "Public", pattern: /public/ });
const PrivateKeyword = createToken({ name: "Private", pattern: /private/ });

const LCurly = createToken({ name: "LCurly", pattern: /{/ });
const RCurly = createToken({ name: "RCurly", pattern: /}/ });
const LParen = createToken({ name: "LParen", pattern: /\(/ });
const RParen = createToken({ name: "RParen", pattern: /\)/ });
const LBracket = createToken({ name: "LBracket", pattern: /\[/ });
const RBracket = createToken({ name: "RBracket", pattern: /\]/ });
const Comma = createToken({ name: "Comma", pattern: /,/ });
const Semi = createToken({ name: "Semi", pattern: /;/ });
const Dot = createToken({ name: "Dot", pattern: /\./ });
const Equal = createToken({ name: "Equal", pattern: /=/ });

const Plus = createToken({ name: "Plus", pattern: /\+/ });
const Minus = createToken({ name: "Minus", pattern: /-/ });
const Star = createToken({ name: "Star", pattern: /\*/ });
const Slash = createToken({ name: "Slash", pattern: /\// });

const Identifier = createToken({ name: "Identifier", pattern: /[a-zA-Z_][a-zA-Z0-9_:]*/ });
const StringLiteral = createToken({ name: "StringLiteral", pattern: /"[^"]*"/ });
const BooleanLiteral = createToken({ name: "BooleanLiteral", pattern: /true|false/ });
const IntegerLiteral = createToken({ name: "IntegerLiteral", pattern: /[0-9]+/ });
const DecimalLiteral = createToken({ name: "DecimalLiteral", pattern: /(?:[0-9]+\.[0-9]+|\.[0-9]+)/ });

export const allTokens = [
  Comment, WhiteSpace,
  ClassKeyword, ExtendsKeyword, PublicKeyword, PrivateKeyword,
  LBracket, RBracket, LCurly, RCurly, LParen, RParen, Dot, Comma, Semi, Equal,
  Plus, Minus, Star, Slash,
  Identifier, StringLiteral, BooleanLiteral, IntegerLiteral, DecimalLiteral,
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
    this.SUBRULE(this.type);
    this.CONSUME(Identifier);
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
        GATE: () => this.LA(3).tokenType === LParen,
        ALT: () => this.SUBRULE(this.methodDeclaration)
      },
      { ALT: () => this.SUBRULE(this.propertyStatement) },
      { ALT: () => this.SUBRULE(this.propertyDefinition) }
    ]);
  });

  methodDeclaration = this.RULE("methodDeclaration", () => {
    this.SUBRULE(this.type);
    this.CONSUME(Identifier);

    this.CONSUME(LParen);
    this.OPTION(() => this.SUBRULE(this.parameterList));
    this.CONSUME(RParen);

    this.SUBRULE(this.block);
  });

  block = this.RULE("block", () => {
    this.CONSUME(LCurly);
    // this.MANY(() => this.SUBRULE(this.statement));
    this.CONSUME(RCurly);
  });

  propertyDefinition = this.RULE("propertyDefinition", () => {
    this.OR([
      { ALT: () => this.CONSUME(PublicKeyword) },
      { ALT: () => this.CONSUME(PrivateKeyword) },
    ])

    this.SUBRULE(this.type);
    this.CONSUME(Identifier);

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
    this.SUBRULE(this.additiveExpression);
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
    this.SUBRULE(this.memberExpression);
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(Star);
            this.SUBRULE2(this.memberExpression);
          }
        },
        {
          ALT: () => {
            this.CONSUME(Slash);
            this.SUBRULE3(this.memberExpression);
          }
        },
      ]);
    });
  });

  memberExpression = this.RULE("memberExpression", () => {
    this.SUBRULE(this.primaryExpression);
    this.MANY(() => this.SUBRULE(this.suffix));
  });

  primaryExpression = this.RULE("primaryExpression", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.arrayLiteral) },
      { ALT: () => this.CONSUME(Identifier) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(IntegerLiteral) },
      { ALT: () => this.CONSUME(DecimalLiteral) },
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
