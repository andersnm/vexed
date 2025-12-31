import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from "fs";
import { InstanceMeta, isInstanceExpression, isParameter, isScopedExpression, Parser, TstBuilder, TstInstanceObject, TstRuntime, TypeDefinition, TypeMeta } from 'vexed';

async function compileInstance(runtime: TstRuntime, fileName: string): Promise<TstInstanceObject> {
    const script = await fs.readFile(fileName, "utf-8");
    const parser = new Parser();
    const program = parser.parse(script, fileName);

    const resolver = new TstBuilder(runtime);
    resolver.resolveProgram(program);

    const main = runtime.getType("Main");
    if (!main) {
        throw new Error("No Main class found");
    }

    return main.createInstance([]);
}

function checkScopedInstanceProperty(instance: TstInstanceObject, propName: string, expectedType: TypeDefinition, expectedValue: any) {
    const propExpr = instance[TypeMeta].resolveProperty(instance, propName);

    assert.ok(propExpr);
    assert.ok(isScopedExpression(propExpr));
    const instanceExpr = propExpr.expr;
    assert.ok(isInstanceExpression(instanceExpr));
    assert.equal(instanceExpr.instance[TypeMeta], expectedType);
    assert.equal(instanceExpr.instance[InstanceMeta], expectedValue);
}

function checkScopedParameterProperty(instance: TstInstanceObject, propName: string, expectedType: TypeDefinition, expectedName: string) {
    const propExpr = instance[TypeMeta].resolveProperty(instance, propName);

    assert.ok(propExpr);
    assert.ok(isScopedExpression(propExpr));
    const paramExpr = propExpr.expr;
    assert.ok(isParameter(paramExpr));
    assert.equal(paramExpr.type, expectedType);
    assert.equal(paramExpr.name, expectedName);
}

function checkInstanceProperty(instance: TstInstanceObject, propName: string, expectedType: TypeDefinition, expectedValue: any) {
    const instanceExpr = instance[TypeMeta].resolveProperty(instance, propName);

    assert.ok(instanceExpr);
    assert.ok(isInstanceExpression(instanceExpr));
    assert.equal(instanceExpr.instance[TypeMeta], expectedType);
    assert.equal(instanceExpr.instance[InstanceMeta], expectedValue);
}

test('Parse basic-class', async () => {
    const runtime = new TstRuntime();
    const instance = await compileInstance(runtime, "./files/basic-class.vexed");
    checkScopedInstanceProperty(instance, "mainStr", runtime.getType("string"), "\"It's a string\"");
    checkScopedInstanceProperty(instance, "mainNum", runtime.getType("int"), 123);
    checkScopedInstanceProperty(instance, "mainBool", runtime.getType("bool"), true);
});

test('Parse basic-subclass', async () => {
    const runtime = new TstRuntime();
    const instance = await compileInstance(runtime, "./files/basic-subclass.vexed");
    checkScopedInstanceProperty(instance, "baseStr", runtime.getType("string"), "\"String, it is\"");
    checkScopedInstanceProperty(instance, "baseNum", runtime.getType("int"), 321);
    checkScopedInstanceProperty(instance, "baseBool", runtime.getType("bool"), true);
    checkScopedInstanceProperty(instance, "mainStr", runtime.getType("string"), "\"It's a string\"");
    checkScopedInstanceProperty(instance, "mainNum", runtime.getType("int"), 123);
    checkScopedInstanceProperty(instance, "mainBool", runtime.getType("bool"), true);

    checkScopedInstanceProperty(instance, "abstractInt", runtime.getType("int"), 777);
});

test('Parse basic-subclass-parameters', async () => {
    const runtime = new TstRuntime();
    const instance = await compileInstance(runtime, "./files/basic-class-parameters.vexed");
    checkScopedParameterProperty(instance, "baseStr", runtime.getType("string"), "strValue");
    checkScopedParameterProperty(instance, "baseNum", runtime.getType("int"), "intValue");
    checkScopedParameterProperty(instance, "baseBool", runtime.getType("bool"), "boolValue");
    checkScopedInstanceProperty(instance, "mainStr", runtime.getType("string"), "\"It's a string\"");
    checkScopedInstanceProperty(instance, "mainNum", runtime.getType("int"), 123);
    checkScopedInstanceProperty(instance, "mainBool", runtime.getType("bool"), true);

    runtime.reduceInstance(instance);

    checkInstanceProperty(instance, "baseStr", runtime.getType("string"), "\"String, it is\"");
    checkInstanceProperty(instance, "baseNum", runtime.getType("int"), 321);
    checkInstanceProperty(instance, "baseBool", runtime.getType("bool"), true);
    checkInstanceProperty(instance, "mainStr", runtime.getType("string"), "\"It's a string\"");
    checkInstanceProperty(instance, "mainNum", runtime.getType("int"), 123);
    checkInstanceProperty(instance, "mainBool", runtime.getType("bool"), true);
});

test('Parse basic-array', async () => {
    const runtime = new TstRuntime();
    const instance = await compileInstance(runtime, "./files/basic-array.vexed");

});

test('Parse member-access', async () => {
    const runtime = new TstRuntime();
    const instance = await compileInstance(runtime, "./files/basic-member-access.vexed");

    runtime.reduceInstance(instance);

    checkInstanceProperty(instance, "mainStrArrayLength", runtime.getType("int"), 2);
    checkInstanceProperty(instance, "mainInt", runtime.getType("int"), 321);
    checkInstanceProperty(instance, "mainStringLength", runtime.getType("int"), 15);
});

test('Parse basic-function', async () => {
    const runtime = new TstRuntime();
    const instance = await compileInstance(runtime, "./files/basic-function.vexed");

    runtime.reduceInstance(instance);
    runtime.reduceInstance(instance);

    checkInstanceProperty(instance, "value1", runtime.getType("int"), 11);
    checkInstanceProperty(instance, "value2", runtime.getType("int"), 21);
});

test('Parse basic-function-subclass', async () => {
    const runtime = new TstRuntime();
    const instance = await compileInstance(runtime, "./files/basic-function-subclass.vexed");

    runtime.reduceInstance(instance);
    runtime.reduceInstance(instance);
    runtime.reduceInstance(instance);

    checkInstanceProperty(instance, "abstractInt", runtime.getType("int"), 7);
    checkInstanceProperty(instance, "value1", runtime.getType("int"), 108);
    checkInstanceProperty(instance, "value2", runtime.getType("int"), 216);
});


test('Parse basic-conditional', async () => {
    const runtime = new TstRuntime();
    const instance = await compileInstance(runtime, "./files/basic-conditional.vexed");

    runtime.reduceInstance(instance);
    runtime.reduceInstance(instance);
    runtime.reduceInstance(instance);

    checkInstanceProperty(instance, "isGreater", runtime.getType("bool"), false);
    checkInstanceProperty(instance, "isLess", runtime.getType("bool"), true);
    checkInstanceProperty(instance, "num1", runtime.getType("int"), 1);
    checkInstanceProperty(instance, "num2", runtime.getType("int"), 10);
});
