import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from "fs";
import { TstRuntime, ScriptError } from 'vexed';

async function loadScriptExpectingError(fileName: string): Promise<{ runtime: TstRuntime, error: ScriptError }> {
    const runtime = new TstRuntime();
    const script = await fs.readFile(fileName, "utf-8");
    
    try {
        runtime.loadScript(script, fileName);
        
        const main = runtime.tryGetType("Main");
        if (!main) {
            throw new ScriptError("Type error", [ { message: "Main class entrypoint not found", location: { fileName, line: 1, column: 1, startOffset: 0, endOffset: 0, image: "" }}]);
        }

        const instance = main.createInstance([]);

        await runtime.reduceInstance(instance);

        throw new Error("Expected script to produce errors, but none were found");
    } catch (err) {
        if (err instanceof ScriptError) {
            return { runtime, error: err };
        }
        throw err;
    }
}

test('Unknown property type error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/unknown-property-type.vexed");

    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Could not find type UnknownType for property Main.unknownTypeProp/);
    assert.equal(error.errors[0].location.line, 2);
    assert.equal(error.errors[0].location.column, 12);
});

test('Unknown return type error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/unknown-return-type.vexed");

    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Could not find return type UnknownReturnType for method Main.testMethod/);
    assert.equal(error.errors[0].location.line, 2);
    assert.equal(error.errors[0].location.column, 5);
});

test('Unknown parameter type error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/unknown-parameter-type.vexed");

    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Could not find type UnknownParamType for parameter param in method Main.testMethod/);
    assert.equal(error.errors[0].location.line, 2);
    assert.equal(error.errors[0].location.column, 16);
});

test('Unknown extends type error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/unknown-extends-type.vexed");

    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Could not find base type UnknownBaseType for class Main/);
    assert.equal(error.errors[0].location.line, 1);
    assert.equal(error.errors[0].location.column, 7);
});

test('Poison return type propagates into call expression', async () => {
    const { runtime, error } = await loadScriptExpectingError("./files/negative/unknown-return-propagation.vexed");

    // Should report only the missing return type of foo()
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Could not find return type MissingType for method Main.foo/);

    // And the poison type should exist in the runtime
    const poison = runtime.tryGetType("MissingType");
    assert.ok(poison, "Poison type MissingType should be registered");
    assert.equal(poison.constructor.name, "PoisonTypeDefinition");
});
