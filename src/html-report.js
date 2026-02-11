// HTML 差异报告生成器

/**
 * 生成 HTML 差异报告
 * @param {Array} differences - 差异列表
 * @param {string} file1 - 第一个文件名
 * @param {string} file2 - 第二个文件名
 * @returns {string} HTML 内容
 */
function generateHtmlDiff(differences, file1, file2) {
  const summary = getDiffSummary(differences);

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JSON 差异报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .files { font-size: 14px; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; padding: 30px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
        .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
        .summary-card .label { font-size: 14px; color: #6b7280; margin-bottom: 5px; }
        .summary-card .value { font-size: 32px; font-weight: bold; }
        .summary-card.added .value { color: #10b981; }
        .summary-card.removed .value { color: #ef4444; }
        .summary-card.edited .value { color: #f59e0b; }
        .differences { padding: 30px; }
        .differences h2 { font-size: 20px; margin-bottom: 20px; color: #111827; }
        .diff-item { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 15px; overflow: hidden; }
        .diff-item.added { border-left: 4px solid #10b981; }
        .diff-item.removed { border-left: 4px solid #ef4444; }
        .diff-item.edited { border-left: 4px solid #f59e0b; }
        .diff-header { padding: 12px 20px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; font-family: 'Courier New', monospace; font-size: 14px; }
        .diff-content { padding: 20px; font-family: 'Courier New', monospace; font-size: 13px; overflow-x: auto; }
        .diff-content pre { white-space: pre-wrap; word-wrap: break-word; }
        .added-line { background: #d1fae5; color: #065f46; padding: 4px 8px; margin: 2px 0; border-radius: 4px; }
        .removed-line { background: #fee2e2; color: #991b1b; padding: 4px 8px; margin: 2px 0; border-radius: 4px; text-decoration: line-through; }
        .edited-from { background: #fee2e2; color: #991b1b; padding: 4px 8px; margin: 2px 0; border-radius: 4px; text-decoration: line-through; }
        .edited-to { background: #d1fae5; color: #065f46; padding: 4px 8px; margin: 2px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>JSON 差异报告</h1>
            <div class="files">${file1} → ${file2}</div>
        </div>
        <div class="summary">
            <div class="summary-card">
                <div class="label">总差异</div>
                <div class="value">${summary.total}</div>
            </div>
            <div class="summary-card added">
                <div class="label">新增</div>
                <div class="value">${summary.added}</div>
            </div>
            <div class="summary-card removed">
                <div class="label">删除</div>
                <div class="value">${summary.removed}</div>
            </div>
            <div class="summary-card edited">
                <div class="label">修改</div>
                <div class="value">${summary.edited}</div>
            </div>
        </div>
        <div class="differences">
            <h2>差异详情</h2>
`;

  if (differences.length === 0) {
    html += `
            <div style="text-align: center; padding: 40px; color: #10b981;">
                <div style="font-size: 48px; margin-bottom: 20px;">✓</div>
                <div style="font-size: 18px;">没有差异</div>
            </div>
`;
  } else {
    for (const diff of differences) {
      const kindClass = diff.kind === 'N' ? 'added' : diff.kind === 'D' ? 'removed' : 'edited';
      const kindText = diff.kind === 'N' ? '新增' : diff.kind === 'D' ? '删除' : '修改';

      html += `
            <div class="diff-item ${kindClass}">
                <div class="diff-header">${diff.path || '(root)'}</div>
                <div class="diff-content">
`;

      if (diff.kind === 'N') {
        html += `
                    <div class="added-line">+ ${JSON.stringify(diff.rhs)}</div>
`;
      } else if (diff.kind === 'D') {
        html += `
                    <div class="removed-line">- ${JSON.stringify(diff.lhs)}</div>
`;
      } else {
        html += `
                    <div class="edited-from">- ${JSON.stringify(diff.lhs)}</div>
                    <div class="edited-to">+ ${JSON.stringify(diff.rhs)}</div>
`;
      }

      html += `
                </div>
            </div>
`;
    }
  }

  html += `
        </div>
    </div>
</body>
</html>`;

  return html;
}

/**
 * 获取差异摘要
 */
function getDiffSummary(differences) {
  const summary = {
    total: differences.length,
    added: 0,
    removed: 0,
    edited: 0
  };

  for (const change of differences) {
    switch (change.kind) {
      case 'N':
        summary.added++;
        break;
      case 'D':
        summary.removed++;
        break;
      case 'E':
        summary.edited++;
        break;
    }
  }

  return summary;
}

module.exports = {
  generateHtmlDiff,
  getDiffSummary
};
