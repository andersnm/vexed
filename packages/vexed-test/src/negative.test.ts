import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from "fs";
import { TstRuntime } from 'vexed';
import { ScriptError } from 'vexed/dist/ScriptError.js';

async function loadScriptExpectingError(fileName: string): Promise<{ runtime: TstRuntime, error: ScriptError }> {
    const runtime = new TstRuntime();
    const script = await fs.readFile(fileName, "utf-8");
    
    try {
        runtime.loadScript(script, fileName);
        
        // If there are script errors, throw them as ScriptError
        if (runtime.scriptErrors.length > 0) {
            throw new ScriptError("Script error", runtime.scriptErrors);
        }
        
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
    assert.equal(error.errors[0].location.column, 29);
});

test('Unknown return type error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/unknown-return-type.vexed");
    
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Could not find return type UnknownReturnType for method Main.testMethod/);
    assert.equal(error.errors[0].location.line, 2);
    assert.equal(error.errors[0].location.column, 19);
});

test('Unknown parameter type error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/unknown-parameter-type.vexed");
    
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Could not find type UnknownParamType for parameter param in method Main.testMethod/);
    assert.equal(error.errors[0].location.line, 2);
    assert.equal(error.errors[0].location.column, 23);
});

test('Unknown extends type error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/unknown-extends-type.vexed");
    
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Could not find base type UnknownBaseType for class Main/);
    assert.equal(error.errors[0].location.line, 1);
    assert.equal(error.errors[0].location.column, 7);
});

test('Multiple references to same unknown type', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/multiple-same-unknown-type.vexed");
    
    // Should report multiple errors for the same unknown type used in different places
    assert.ok(error.errors.length >= 1);
    assert.match(error.errors[0].message, /Could not find type UnknownType/);
});

test('Unknown array element type error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/unknown-array-element-type.vexed");
    
    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Could not find type UnknownType for property Main.arrayProp/);
    assert.equal(error.errors[0].location.line, 2);
    assert.equal(error.errors[0].location.column, 23);
});
