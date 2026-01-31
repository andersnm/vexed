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

test('Poison types mega-test', async () => {
    const { runtime, error } = await loadScriptExpectingError("./files/negative/poison-mega-test.vexed");

    // Should report only the original missing type errors, not cascading errors
    // Expected errors:
    // - MissingReturnType for methodWithMissingReturnType
    // - MissingParamType for methodWithMissingParam parameter
    // - MissingPropertyType for missingPropType property
    // - MissingType1, MissingType2, MissingType3 for multiMissingTypes method
    // - MissingArrayElement[] for arrayWithMissingElement return type
    // - MissingBaseClass for ChildWithMissingBase extends clause
    
    assert.equal(error.errors.length, 8, `Expected exactly 8 errors (missing types only), got ${error.errors.length}: ${error.errors.map(e => e.message).join(', ')}`);
    
    // Verify each expected error
    const errorMessages = error.errors.map(e => e.message);
    
    assert.ok(errorMessages.some(msg => msg.includes("MissingReturnType") && msg.includes("methodWithMissingReturnType")), 
        "Should report missing return type MissingReturnType");
    assert.ok(errorMessages.some(msg => msg.includes("MissingParamType") && msg.includes("methodWithMissingParam")), 
        "Should report missing parameter type MissingParamType");
    assert.ok(errorMessages.some(msg => msg.includes("MissingPropertyType") && msg.includes("missingPropType")), 
        "Should report missing property type MissingPropertyType");
    assert.ok(errorMessages.some(msg => msg.includes("MissingType1")), 
        "Should report missing parameter type MissingType1");
    assert.ok(errorMessages.some(msg => msg.includes("MissingType2")), 
        "Should report missing parameter type MissingType2");
    assert.ok(errorMessages.some(msg => msg.includes("MissingType3")), 
        "Should report missing return type MissingType3");
    assert.ok(errorMessages.some(msg => msg.includes("MissingArrayElement")), 
        "Should report missing array element type MissingArrayElement");
    assert.ok(errorMessages.some(msg => msg.includes("MissingBaseClass")), 
        "Should report missing base class MissingBaseClass");

    // Verify all poison types are registered in runtime
    const poisonTypes = [
        "MissingReturnType",
        "MissingParamType", 
        "MissingPropertyType",
        "MissingType1",
        "MissingType2",
        "MissingType3",
        "MissingArrayElement[]",
        "MissingBaseClass"
    ];
    
    for (const typeName of poisonTypes) {
        const poisonType = runtime.tryGetType(typeName);
        assert.ok(poisonType, `Poison type ${typeName} should be registered`);
        assert.equal(poisonType.constructor.name, "PoisonTypeDefinition", 
            `${typeName} should be a PoisonTypeDefinition`);
    }
});

test('Missing parameter error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/missing-parameter.vexed");

    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Unknown identifier y/);
});

test('Missing variable error', async () => {
    const { error } = await loadScriptExpectingError("./files/negative/missing-variable.vexed");

    assert.equal(error.errors.length, 1);
    assert.match(error.errors[0].message, /Unknown identifier unknownVar/);
});
