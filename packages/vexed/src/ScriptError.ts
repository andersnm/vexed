export interface ScriptErrorInfo {
    fileName: string;
    line: number;
    column: number;
    message: string;
}

export class ScriptError extends Error {
    constructor(message: string, public errors: ScriptErrorInfo[]) {
        super(message);
    }

    formatForVSCode(): string {
        return this.errors.map(err => {
            return `${err.fileName}:${err.line}:${err.column}: ${err.message}`;
        }).join('\n');
    }
}
