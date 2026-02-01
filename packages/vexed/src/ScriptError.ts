import { AstLocation } from "./AstLocation.js";

export interface ScriptErrorInfo {
    location: AstLocation;
    message: string;
}

export class ScriptError extends Error {
    constructor(message: string, public errors: ScriptErrorInfo[]) {
        super(message);
    }
}
