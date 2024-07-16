import * as vscode from 'vscode';
import { log, DebugModule } from './logger';

export class IfdefFoldingProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(
        document: vscode.TextDocument,
        context: vscode.FoldingContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.FoldingRange[]> {
        const foldingRanges: vscode.FoldingRange[] = [];
        const stack: { startLine: number, type: string }[] = [];
        
        log(DebugModule.Folding, `Processing document with ${document.lineCount} lines`);

        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();
            log(DebugModule.Folding, `Line ${i + 1}: Processing "${text}"`);

            if (/^#(ifdef|ifndef|if)/.test(text)) {
                const match = text.match(/^#(ifdef|ifndef|if)/)!;
                log(DebugModule.Folding, `Line ${i + 1}: Found ${match[1]} directive`);
                stack.push({ startLine: i, type: match[1] });
                log(DebugModule.Folding, `Stack pushed: ${JSON.stringify(stack)}`);
            } else if (/^#(else|elseif|elif)/.test(text)) {
                const match = text.match(/^#(else|elseif|elif)/)!;
                log(DebugModule.Folding, `Line ${i + 1}: Found #${match[1]} directive`);
                if (stack.length > 0) {
                    const start = stack.pop()!;
                    log(DebugModule.Folding, `Creating folding range from line ${start.startLine} to ${i - 1}`);
                    foldingRanges.push(new vscode.FoldingRange(start.startLine, i - 1));
                    // Push new block for else/elseif/elif
                    stack.push({ startLine: i, type: match[1] });
                    log(DebugModule.Folding, `Updated stack: ${JSON.stringify(stack)}`);
                } else {
                    log(DebugModule.Folding, `Warning: #${match[1]} found without matching opening directive`);
                }
            } else if (/^#(endif)/.test(text)) {
                log(DebugModule.Folding, `Line ${i + 1}: Found #endif directive`);
                if (stack.length > 0) {
                    const start = stack.pop()!;
                    log(DebugModule.Folding, `Creating folding range from line ${start.startLine} to ${i}`);
                    foldingRanges.push(new vscode.FoldingRange(start.startLine, i));
                    log(DebugModule.Folding, `Stack after pop: ${JSON.stringify(stack)}`);
                } else {
                    log(DebugModule.Folding, `Warning: #endif found without matching opening directive`);
                }
            }
        }

        // Handle any remaining unclosed directives
        while (stack.length > 0) {
            const start = stack.pop()!;
            log(DebugModule.Folding, `Creating folding range for unclosed directive from line ${start.startLine} to ${document.lineCount - 1}`);
            foldingRanges.push(new vscode.FoldingRange(start.startLine, document.lineCount - 1));
        }

        log(DebugModule.Folding, `Created ${foldingRanges.length} folding ranges`);
        log(DebugModule.Folding, `Final folding ranges: ${JSON.stringify(foldingRanges)}`);
        return foldingRanges;
    }
}
