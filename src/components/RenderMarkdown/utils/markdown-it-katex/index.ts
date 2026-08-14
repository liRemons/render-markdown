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

    md.inline.ruler.before('emphasis', 'katex_inline', (state: any, silent: any) => {
        // 1. 当前位置必须是 $
        if (state.src.charCodeAt(state.pos) !== 0x24 /* $ */) return false;

        // 2. 排除 $$ （留给块级）
        if (state.src.charCodeAt(state.pos + 1) === 0x24) return false;

        // 3. 排除 \$ 转义
        if (state.pos > 0 && state.src.charCodeAt(state.pos - 1) === 0x5c /* \ */) {
            return false;
        }

        // 4. $ 后不能是空格（KaTeX 规范）
        const afterOpen = state.pos + 1;
        if (afterOpen >= state.posMax) return false;
        if (/\s/.test(state.src[afterOpen])) return false;

        // 5. 查找配对的结束 $
        let end = afterOpen;
        while (end < state.posMax) {
            const ch = state.src.charCodeAt(end);
            if (ch === 0x24 /* $ */ && state.src.charCodeAt(end - 1) !== 0x5c /* \ */) {
                break;
            }
            end++;
        }

        // 6. 没找到配对 / 空内容 / 结束符前是空格 → 不匹配
        if (end >= state.posMax) return false;
        if (end === afterOpen) return false;
        if (/\s/.test(state.src[end - 1])) return false;

        if (!silent) {
            const token = state.push('katex_inline', 'math', 0);
            token.markup = '$';
            token.content = state.src.slice(afterOpen, end);
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