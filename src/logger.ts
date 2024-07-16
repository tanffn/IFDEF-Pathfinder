export enum DebugModule {
    Folding = 1 << 0,
    Decorations = 1 << 1,
}

let debugMask: number = DebugModule.Decorations;// DebugModule.Folding | DebugModule.Decorations;

export function setDebugMask(mask: number): void {
    debugMask = mask;
}

export function log(module: DebugModule, message: string): void {
    if (debugMask & module) {
        const moduleName = DebugModule[module];
        console.log(`[IFDEF Extension] [${moduleName}] ${message}`);
    }
}
