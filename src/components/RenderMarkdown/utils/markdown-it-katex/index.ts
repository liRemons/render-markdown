import { getKatex, isKatexReady, ensureKatexLoaded } from './katex-loader';

export interface KatexPluginOptions {
    throwOnError?: boolean;
    errorColor?: string;
    displayMode?: boolean;
    macros?: Record<string, string>;
    /** CDN 加载超时(ms)，默认 15000 */
    loadTimeout?: number;
}

export function katexPlugin(md: any, options: KatexPluginOptions = {}): void {
    const opts = {
        throwOnError: false,
        errorColor: '#cc0000',
        ...options,
    };

    if (!isKatexReady()) {
        console.warn(
            '[markdown-it-katex] KaTeX is not loaded yet. ' +
            'Call `await ensureKatexLoaded()` before using this plugin, ' +
            'or use `renderWithKatex()` helper instead.'
        );
    }

    function render(tex: string, displayMode: boolean): string {
        try {
            return getKatex().renderToString(tex, {
                ...opts,
                displayMode,
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return `<span style="color:${opts.errorColor}" title="${escapeHtml(msg)}">${escapeHtml(tex)}</span>`;
        }
    }

    function escapeHtml(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ========== 行内 $...$ ==========
    md.inline.ruler.after('escape', 'katex_inline', (state: any, silent: any) => {
        if (state.src[state.pos] !== '$') return false;
        if (state.src[state.pos + 1] === '$') return false; // $$ 留给块级

        const start = state.pos + 1;
        let end = start;
        while (end < state.posMax) {
            if (state.src[end] === '$' && state.src[end - 1] !== '\\') break;
            end++;
        }
        if (end >= state.posMax || end === start) return false;

        if (!silent) {
            const token = state.push('katex_inline', 'math', 0);
            token.markup = '$';
            token.content = state.src.slice(start, end);
        }
        state.pos = end + 1;
        return true;
    });

    // ========== 块级 $$...$$ ==========
    md.block.ruler.after('blockquote', 'katex_block', (state: any, startLine: number, endLine: number, silent: any) => {
        const pos = state.bMarks[startLine] + state.tShift[startLine];
        const max = state.eMarks[startLine];

        if (pos + 2 > max || state.src.slice(pos, pos + 2) !== '$$') return false;
        if (silent) return true;

        let nextLine = startLine + 1;
        let found = false;

        while (nextLine < endLine) {
            const linePos = state.bMarks[nextLine] + state.tShift[nextLine];
            const lineMax = state.eMarks[nextLine];
            if (state.src.slice(linePos, lineMax).trim() === '$$') {
                found = true;
                break;
            }
            nextLine++;
        }

        const contentStart = state.bMarks[startLine + 1];
        const contentEnd = found ? state.bMarks[nextLine] : state.eMarks[endLine - 1];

        state.line = nextLine + (found ? 1 : 0);

        const token = state.push('katex_block', 'math', 0);
        token.block = true;
        token.markup = '$$';
        token.content = state.src.slice(contentStart, contentEnd).trim();
        token.map = [startLine, state.line];

        return true;
    });

    // ========== 渲染规则 ==========
    md.renderer.rules.katex_inline = (tokens: any, idx: number) =>
        render(tokens[idx].content, false);

    md.renderer.rules.katex_block = (tokens: any, idx: number) =>
        `<div class="katex-block">${render(tokens[idx].content, true)}</div>\n`;
}

export { ensureKatexLoaded }