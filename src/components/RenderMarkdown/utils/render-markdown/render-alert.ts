interface AlertTypeMap {
    warning: string;
    note: string;
    tip: string;
    important: string;
    caution: string;
}


function renderAlert(tokens: Array<{ markup: string }>, index: number): string {
    const typeMap: AlertTypeMap = {
        warning: '注意',
        note: '注',
        tip: '提示',
        important: '重要',
        caution: '警告',
    }


    const token = tokens[index];
    // 建议增加防御性编程，防止 index 越界或 markup 不在 typeMap 中
    if (!token || !token.markup || !typeMap[token.markup as keyof AlertTypeMap]) {
        return '';
    }

    return `<p class="markdown-alert-title">
        <i class="markdown-alert-icon iconfont icon-${token.markup as keyof AlertTypeMap}"></i>
        ${typeMap[token.markup as keyof AlertTypeMap]}
    </p>`
}

export default renderAlert