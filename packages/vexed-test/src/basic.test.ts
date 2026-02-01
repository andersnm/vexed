import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from "fs";
import { InstanceMeta, isInstanceExpression, isParameter, isScopedExpression, printJsonObject, ScriptError, TstInstanceObject, TstRuntime, TypeDefinition, TypeMeta } from 'vexed';

async function compileToJson(fileName: string) {
    const runtime = new TstRuntime();
    try {
        const script = await fs.readFile(fileName, "utf-8");
        runtime.loadScript(script, fileName);

        const main = runtime.getType("Main");
        if (!main) {
            throw new Error("No Main class found");
        }

        const instance = main.createInstance([]);
        await runtime.reduceInstance(instance);
        return printJsonObject(instance);

    } catch (err) {
        if (err instanceof ScriptError) {
            for (const error of err.errors) {
                console.error(`${error.location.fileName}:${error.location.line}:${error.location.column} - error: ${error.message}`);
            }

            throw new Error("Script errors occurred: " + err.message);
        }
        throw err;
    }
}

test('Parse basic-class', async () => {
    const json = await compileToJson("./files/basic-class.vexed");

    assert.deepEqual(json, {
        mainStr: "It's a string",
        mainNum: 123,
        mainBool: true
    });
});

test('Parse basic-subclass', async () => {
    const json = await compileToJson("./files/basic-subclass.vexed");

    assert.deepEqual(json, {
        baseStr: "String, it is",
        baseNum: 321,
        baseBool: true,
        mainStr: "It's a string",
        mainNum: 123,
        mainBool: true,
        abstractInt: 777
    });
});

test('Parse basic-subclass-parameters', async () => {
    const json = await compileToJson("./files/basic-class-parameters.vexed");

    assert.deepEqual(json, {
        baseStr: "String, it is",
        baseNum: 321,
        baseBool: true,
        mainStr: "It's a string",
        mainNum: 123,
        mainBool: true,
        mainBase: {
            baseStr: "It's a string",
            baseNum: 123,
            baseBool: true,
        },
        mainSidecar: {
            sidecarStr: "It's a string",
            sidecarNum: 123,
            sidecarBool: true,
        }
    });
});

test('Parse basic-array', async () => {
    const json = await compileToJson("./files/basic-array.vexed");

    assert.deepEqual(json, {
        strArray: [ "It's a string", "String, it is" ],
        strStrArray: [ [ "It's a string", "String, it is" ], [ "One", "Two", "Three" ] ],
        intArray: [ 1, 2, 3 ],
        intIntArray: [ [ 1, 2, 3, 4, 5 ], [ 6, 7 ] ],
        boolArray: [ true, false, true, false ],
        boolArray2D: [ [ true, false, true, false ], [ false, false, false ] ]
    });
});

test('Parse basic-array-map', async () => {
    const json = await compileToJson("./files/basic-array-map.vexed");
    assert.deepEqual(json, {
        strArray: [ "ABC", "DEFGH" ],
        temp: "TEMP",
        ext: {
            proof: "Member",
            literally: [ "Yes we can: 1: Member", "Yes we can: 2: Member", "Yes we can: 3: Member" ]
        },
        wrapped: [
            "[ABC]TEMP",
            "[DEFGH]TEMP"
        ],
        lengths: [ 3, 5 ],
        canReally: [ "Yes we can: ABC: Member", "Yes we can: DEFGH: Member" ]
    });
});

test('Parse basic-instances', async () => {
    const json = await compileToJson("./files/basic-instances.vexed");

    assert.deepEqual(json, {
        data: {
            name: "FromConstructor",
            value: 10,
        },
        tempValue: 1000,
        fieldData: {
            name: "FromField",
            value: 1000,
        },
        mainClassData: {
            name: "FromMain",
            value: 100,
        },
        mainBaseClassData: {
            name: "FromMainBase",
            value: 10,
        },
        baseClassData: {
            name: "FromBaseClassMethod",
            value: 1000,
        }
    });
});

test('Parse member-access', async () => {
    const json = await compileToJson("./files/basic-member-access.vexed");

    assert.deepEqual(json, {
        baseStr: "String, it is",
        baseInt: 321,
        baseBool: true,
        baseStrArray: [ "It's a string", "String, it is" ],
        mainStrArray: [ "It's a string", "String, it is" ],
        mainStrArrayLength: 2,
        mainInt: 321,
        mainString: "String, it is",
        mainStringLength: 13
    });
});

test('Parse basic-function', async () => {
    const json = await compileToJson("./files/basic-function.vexed");

    assert.deepEqual(json, {
        memberInt: 7,
        value1: 11,
        value2: 21,
        fac5: 120
    });
});

test('Parse basic-function-subclass', async () => {
    const json = await compileToJson("./files/basic-function-subclass.vexed");

    assert.deepEqual(json, {
        abstractInt: 7,
        value1: 108,
        value2: 216,
        value3: 0,
    });
});

test('Parse basic-conditional', async () => {
    const json = await compileToJson("./files/basic-conditional.vexed");

    assert.deepEqual(json, {
        mainNum1: 1,
        mainNum2: 2,
        isGreater: false,
        isLess: true,
        num1: 1,
        num2: 10
    });
});

test('Parse basic-type', async () => {
    const json = await compileToJson("./files/basic-type.vexed");
    assert.deepEqual(json, {
        stringType: {
            name: "string",
            scriptPath: ".",
        },
        mainType: {
            name: "Main",
            scriptPath: "./files",
        },
        stringTypeName: "string",
        stringTypePath: ".",
        mainTypeName: "Main",
        mainTypePath: "./files"
    });
});

test('Parse basic-io', async () => {
    const json = await compileToJson("./files/basic-io.vexed");
    assert.deepEqual(json, {
        fileName: './files/textfile.txt',
        content: "Lorem ipsum",
        warped: "Lorem ipsum"
    });
});


test('Parse call-once', async () => {
    const logs: string[] = [];
    const consoleLog = console.log.bind(console);
    const logImpl = (...args: any[]) => {
        logs.push(args.join(' '));
        consoleLog(...args);
    };
    mock.method(console, 'log', logImpl);

    const json = await compileToJson("./files/call-once.vexed");

    const count = logs.filter(l => l === "Io.print: \"Hello from expensive\"").length;
    assert.equal(count, 1);

    assert.deepEqual(json, {
        x: 2,
        value: 4
    });
});

test('Parse function-types', async () => {
    const json = await compileToJson("./files/function-types.vexed");

    assert.deepEqual(json, {
        result1: 15,
        result3: 42,
        numbers: [ 1, 2, 3 ],
        doubled: [ 2, 4, 6 ],
        result4: 15
    });
});

test('Array literal with method parameter', async () => {
    const json = await compileToJson("./files/array-parameter.vexed");

    assert.deepEqual(json, {
        result: ["test", "test2", "test3"]
    });
});

test('Array literal with complex parameter scenarios', async () => {
    const json = await compileToJson("./files/array-parameter-complex.vexed");

    assert.deepEqual(json, {
        simpleArray: ["hello", "hello2", "hello3"],
        nestedArray: ["nested_suffix", "nested_suffix2"],
        multiParamArray: ["one", "two", "onetwo"]
    });
});

test('Array literal with both direct values and parameters', async () => {
    const json = await compileToJson("./files/array-direct-and-parameter.vexed");
    
    assert.deepEqual(json, {
        directArray: ["direct1", "direct2", "direct3"],
        result: ["test", "test2", "test3"]
    });
});

test('Boolean operators', async () => {
    const json = await compileToJson("./files/boolean-operators.vexed");
    
    assert.deepEqual(json, {
        andTrue: true,
        andFalse: false,
        orTrue: true,
        orFalse: false,
        eqTrue: true,
        eqFalse: false,
        neqTrue: true,
        neqFalse: false,
        num1: 5,
        num2: 10,
        complex1: true,
        complex2: true
    });
});

test("Implicit array type in variable declaration", async () => {
    const json = await compileToJson("./files/implicit-array-type-let.vexed");
    assert.deepEqual(json, {
        output: 1
    });
});

test("Implicit nested array type in return value", async () => {
    const json = await compileToJson("./files/implicit-array-type-nested.vexed");
    assert.deepEqual(json, {
        output: 2
    });
});

test("Implicit array type in nested array map method", async () => {
    const json = await compileToJson("./files/implicit-array-type-map.vexed");
    assert.deepEqual(json, {
        output: "string"
    });
});

test("Implicit type collection inside if statement block", async () => {
    const json = await compileToJson("./files/implicit-array-type-if.vexed");
    assert.deepEqual(json, {
        output: 0
    });
});

test("Instance literals", async () => {
    const json = await compileToJson("./files/instance-literal.vexed");
    assert.deepEqual(json, {
        config: {
            name: "Config Name",
            ip: "1.0.0.120",
            defValue: "test"
        }
    });
});

test("Instance literals comprehensive", async () => {
    const json = await compileToJson("./files/instance-literal-comprehensive.vexed");
    assert.deepEqual(json, {
        simpleConfig: {
            name: "Simple Config",
            ip: "127.0.0.1",
            port: 8080,
            defValue: "default",
            data: {
                name: "test",
                value: 42
            }
        },
        nestedLiteral: {
            name: "Nested Literal",
            ip: "192.168.1.1",
            port: 9000,
            defValue: "nested",
            data: {
                name: "Overridden Name",
                value: 200
            }
        },
        configWithExpression: {
            name: "With Expression",
            ip: "10.0.0.1",
            port: 3000,
            defValue: "expression",
            data: {
                name: "expr",
                value: 3001
            }
        }
    });
});

test("Instance literals with inheritance", async () => {
    const json = await compileToJson("./files/instance-literal-inheritance.vexed");
    assert.deepEqual(json, {
        base: {
            baseValue: 100,
            baseName: "Base Instance"
        },
        derived: {
            baseValue: 200,
            baseName: "Derived Base Name",
            derivedValue: 300,
            derivedName: "Derived Name"
        }
    });
});
