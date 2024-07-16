import * as vscode from 'vscode';
import { log, DebugModule } from './logger';

export class IfdefDecorationProvider {

    private decorationTypes: vscode.TextEditorDecorationType[] = [];
    private cursorDecorationType: vscode.TextEditorDecorationType;
    private statusBarItem: vscode.StatusBarItem;
    private previousCursorLine: number | undefined;

    constructor() {
        // Initialize decoration types with different colors
        for (let i = 0; i < 10; i++) {
            this.decorationTypes.push(vscode.window.createTextEditorDecorationType({
                color: this.getColor(i)
            }));
        }

        // Initialize a special decoration type for the cursor position
        this.cursorDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: 'inherit',
                fontStyle: 'italic',
                contentText: '', 
            }
        });

        // Create a status bar item for cursor path
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.text = 'IFDEF Path: <None>';

        // Register the event listener for cursor movement
        vscode.window.onDidChangeTextEditorSelection(this.onDidChangeTextEditorSelection, this);
    }

    getColor(level: number): string {
        const colors = [
            'blue', 'green', 'red', 'orange', 'purple', 'cyan', 'magenta', 'brown', 'lime', 'pink'
        ];
        return colors[level % colors.length];
    }

    onDidChangeTextEditorSelection(event: vscode.TextEditorSelectionChangeEvent) {
        const editor = event.textEditor;
        this.updateDecorations(editor);
    }

    updateDecorations(editor: vscode.TextEditor) {
        const pattern = /#(ifdef|ifndef|if|elseif|elif|else|endif)([^\r\n]*)/gm;
        const text = editor.document.getText();
        const matches = [...text.matchAll(pattern)];
        const stack: { line: number, type: string, name: string, level: number }[] = [];
        const elseifStack: { name: string, type: string }[] = [];
        const decorations: vscode.DecorationOptions[][] = Array.from({ length: 10 }, () => []);
        let cursorDecoration: vscode.DecorationOptions[] = [];
    
        // Get the current cursor position
        const cursorPosition = editor.selection.active;
    
        // Check if the cursor line has changed
        if (this.previousCursorLine !== cursorPosition.line) {
            log(DebugModule.Decorations, `Prev: ${this.previousCursorLine}; New: ${cursorPosition.line}`);
            this.previousCursorLine = cursorPosition.line;
        } else {
            // Clear previous cursor decorations if the cursor line hasn't changed
            editor.setDecorations(this.cursorDecorationType, []);
            return;
        }
    
        log(DebugModule.Decorations, `Cursor position: Line ${cursorPosition.line}, Character ${cursorPosition.character}`);
    
        let activePath: string[] = []; // Initialize as an empty array
    
        for (const match of matches) {
            const line = editor.document.positionAt(match.index!).line;
            const type = match[1];
            let name = match[2].trim().split('//')[0].trim(); // Ignore anything after //
    
            // Ignore lines that are fully commented out
            if (editor.document.lineAt(line).text.trim().startsWith('//') || editor.document.lineAt(line).text.trim().startsWith('/*')) {
                continue;
            }
    
            // Handle defined(...) and !defined(...) cases
            if (name.startsWith('defined(') || name.startsWith('!defined(')) {
                name = name.replace(/^!?defined\((.*?)\)/, '$1');
                if (name.startsWith('!')) {
                    name = `!${name.substring(1)}`;
                }
            }
    
            // Handle #if !(...)
            if (name.startsWith('!(')) {
                name = `!${name.substring(2, name.length - 1)}`;
            }
    
            // Remove double exclamation marks
            name = name.replace(/!!/g, '');
    
            if (type === 'ifdef' || type === 'ifndef' || type === 'if') {
                const level = stack.length;
                const isNegated = type === 'ifndef' || name.startsWith('!');
                const displayName = isNegated ? `!${name.replace(/^!/, '')}` : name;
                stack.push({ line: line, type: type, name: displayName, level: level });
                elseifStack.push({ name: displayName, type: type }); // Push into elseifStack
                const fullPath = stack.map(item => item.name).join('->');
                log(DebugModule.Decorations, `Found #${type}: ${displayName} at line ${line}, full path: ${fullPath}`);
                const range = new vscode.Range(line, editor.document.lineAt(line).text.length, line, editor.document.lineAt(line).text.length);
                const decoration = {
                    range,
                    renderOptions: {
                        after: {
                            contentText: ` <-- ${displayName}`,
                            color: this.getColor(level),
                            fontStyle: 'italic'
                        }
                    }
                };
                decorations[level].push(decoration);
                if (line <= cursorPosition.line) {
                    activePath.push(displayName);
                }
            } else if (type === 'elseif' || type === 'elif') {
                const lastItem = stack[stack.length - 1];
                const level = lastItem.level;
                const displayName = name;
                elseifStack.push({ name: displayName, type: type });
                
                // Replace the last item in the stack
                stack[stack.length - 1] = { line: line, type: type, name: displayName, level: level };
                
                const fullPath = stack.map(item => item.name).join('->');
                log(DebugModule.Decorations, `Found #${type}: ${displayName} at line ${line}, full path: ${fullPath}`);
                const range = new vscode.Range(line, editor.document.lineAt(line).text.length, line, editor.document.lineAt(line).text.length);
                const decoration = {
                    range,
                    renderOptions: {
                        after: {
                            contentText: ` <-- ${displayName}`,
                            color: this.getColor(level),
                            fontStyle: 'italic'
                        }
                    }
                };
                decorations[level].push(decoration);
                if (line <= cursorPosition.line) {
                    activePath[activePath.length - 1] = displayName;
                }
            } else if (type === 'else') {
                const start = stack[stack.length - 1];
                if (start) {
                    const owner = start.name;
                    const level = start.level;
                    const negatedOwner = owner.startsWith('!') ? owner.substring(1) : `!${owner}`;
                    const fullPath = stack.map(item => item.name).join('->');
                    log(DebugModule.Decorations, `Found #else: ${negatedOwner} at line ${line}, full path: ${fullPath}`);
                    const range = new vscode.Range(line, editor.document.lineAt(line).text.length, line, editor.document.lineAt(line).text.length);
                    const decoration = {
                        range,
                        renderOptions: {
                            after: {
                                contentText: ` <-- ${negatedOwner}`,
                                color: this.getColor(level),
                                fontStyle: 'italic'
                            }
                        }
                    };
                    decorations[level].push(decoration);
                    if (line <= cursorPosition.line) {
                        activePath[activePath.length - 1] = negatedOwner;
                    }
                }
            } else if (type === 'endif') {
                const start = stack.pop();
                if (start) {
                    const owner = start.name;
                    const level = start.level;
                    const fullPath = stack.map(item => item.name).concat(owner).join('->');
                    let combinedPath = '';
                    log(DebugModule.Decorations, `elseifStack before processing #endif: ${JSON.stringify(elseifStack)}`);
                    log(DebugModule.Decorations, `stack before processing #endif: ${JSON.stringify(stack)}`);
                    while (elseifStack.length > 0) {
                        const elseifOwner = elseifStack.pop()!;
                        combinedPath = combinedPath ? `${elseifOwner.name} & ${combinedPath}` : elseifOwner.name;
                        if (elseifStack.length === 0 || elseifOwner.type === 'ifdef' || elseifOwner.type === 'ifndef' || elseifOwner.type === 'if') {
                            break; // Stop when reaching the first ifdef/ifndef/if
                        }
                    }
                    log(DebugModule.Decorations, `Found #endif: ${combinedPath} at line ${line}, full path: ${fullPath}`);
                    const range = new vscode.Range(line, editor.document.lineAt(line).text.length, line, editor.document.lineAt(line).text.length);
                    const decoration = {
                        range,
                        renderOptions: {
                            after: {
                                contentText: ` <-- ${combinedPath}`,
                                color: this.getColor(level),
                                fontStyle: 'italic'
                            }
                        }
                    };
                    decorations[level].push(decoration);
                    if (line < cursorPosition.line) {
                        activePath.pop();
                    }
                }
            }
        }
    
        // Apply decorations to the editor using decoration types
        decorations.forEach((decoration, level) => {
            editor.setDecorations(this.decorationTypes[level], decoration);
        });
    
        // Update status bar with cursor path
        const fullPath = activePath.length > 0 ? activePath.join('->') : '<None>';
        log(DebugModule.Decorations, `IFDEF Path, activePath: ${activePath}, full path: ${fullPath}`);
        this.statusBarItem.text = `IFDEF Path: ${fullPath}`;
        this.statusBarItem.show();
    }

    dispose() {
        this.statusBarItem.dispose();
        this.cursorDecorationType.dispose();
        this.decorationTypes.forEach(type => type.dispose());
    }
}

// Activation function for the extension
export function activate(context: vscode.ExtensionContext) {
    const provider = new IfdefDecorationProvider();

    // Register the provider to update decorations when the active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
            provider.updateDecorations(editor);
        }
    });

    // Update decorations for the active editor on activation
    if (vscode.window.activeTextEditor) {
        provider.updateDecorations(vscode.window.activeTextEditor);
    }

    // Add the status bar item to the extension context
    context.subscriptions.push(provider);
}

export function deactivate() {
    // Dispose of resources when the extension is deactivated
}