#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');

// 读取 JSON 文件
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e.message}`);
  }
}

// 深度比较两个对象
function deepCompare(obj1, obj2, basePath = '') {
  const differences = [];
  
  // 类型检查
  const type1 = typeof obj1;
  const type2 = typeof obj2;
  
  if (type1 !== type2) {
    differences.push({
      kind: 'E',
      path: basePath,
      lhs: obj1,
      rhs: obj2
    });
    return differences;
  }
  
  // 数组处理
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    const maxLength = Math.max(obj1.length, obj2.length);
    
    for (let i = 0; i < maxLength; i++) {
      const currentPath = basePath ? `${basePath}[${i}]` : `[${i}]`;
      
      if (i >= obj1.length) {
        differences.push({
          kind: 'N',
          path: currentPath,
          rhs: obj2[i]
        });
      } else if (i >= obj2.length) {
        differences.push({
          kind: 'D',
          path: currentPath,
          lhs: obj1[i]
        });
      } else {
        differences.push(...deepCompare(obj1[i], obj2[i], currentPath));
      }
    }
    return differences;
  }
  
  // 对象处理
  if (type1 === 'object' && obj1 !== null && obj2 !== null) {
    const keys1 = new Set(Object.keys(obj1));
    const keys2 = new Set(Object.keys(obj2));
    
    // 检查删除的键
    for (const key of keys1) {
      if (!keys2.has(key)) {
        differences.push({
          kind: 'D',
          path: basePath ? `${basePath}.${key}` : key,
          lhs: obj1[key]
        });
      }
    }
    
    // 检查新增的键
    for (const key of keys2) {
      if (!keys1.has(key)) {
        differences.push({
          kind: 'N',
          path: basePath ? `${basePath}.${key}` : key,
          rhs: obj2[key]
        });
      }
    }
    
    // 检查修改的键
    for (const key of [...keys1].filter(k => keys2.has(k))) {
      const currentPath = basePath ? `${basePath}.${key}` : key;
      
      if (typeof obj1[key] === 'object' && typeof obj2[key] === 'object' &&
          obj1[key] !== null && obj2[key] !== null) {
        differences.push(...deepCompare(obj1[key], obj2[key], currentPath));
      } else if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
        differences.push({
          kind: 'E',
          path: currentPath,
          lhs: obj1[key],
          rhs: obj2[key]
        });
      }
    }
    
    return differences;
  }
  
  // 基本类型比较
  if (obj1 !== obj2) {
    differences.push({
      kind: 'E',
      path: basePath,
      lhs: obj1,
      rhs: obj2
    });
  }
  
  return differences;
}

// 格式化差异
function formatDiff(differences, options) {
  if (!differences || differences.length === 0) {
    return chalk.green('✓ 没有差异');
  }
  
  let output = '';
  
  for (const change of differences) {
    const kind = change.kind;
    const diffPath = change.path || '';
    
    switch (kind) {
      case 'N':
        // 新增字段
        output += chalk.green(`+  ${diffPath}: ${JSON.stringify(change.rhs)}\n`);
        break;
        
      case 'D':
        // 删除字段
        output += chalk.red(`-  ${diffPath}: ${JSON.stringify(change.lhs)}\n`);
        break;
        
      case 'E':
        // 修改字段
        output += chalk.yellow(`~  ${diffPath}:\n`);
        output += chalk.gray(`   ${JSON.stringify(change.lhs)} → ${JSON.stringify(change.rhs)}\n`);
        break;
    }
  }
  
  return output;
}

// 获取差异摘要
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

// 打印差异摘要
function printSummary(summary) {
  console.log(chalk.cyan('\n📊 差异摘要\n'));
  console.log(chalk.gray(`总差异: ${summary.total}`));
  console.log(chalk.green(`新增: ${summary.added}`));
  console.log(chalk.red(`删除: ${summary.removed}`));
  console.log(chalk.yellow(`修改: ${summary.edited}`));
  console.log();
}

// 导出差异
function exportDiff(differences, filePath, format) {
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (format === 'json') {
    fs.writeFileSync(filePath, JSON.stringify(differences, null, 2), 'utf-8');
  } else if (format === 'csv') {
    const headers = ['kind', 'path', 'lhs', 'rhs'];
    const rows = differences.map(d => [
      d.kind,
      d.path || '',
      JSON.stringify(d.lhs) || '',
      JSON.stringify(d.rhs) || ''
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )].join('\n');
    
    fs.writeFileSync(filePath, csv, 'utf-8');
  } else {
    // 默认文本格式
    const text = formatDiff(differences, {});
    fs.writeFileSync(filePath, text, 'utf-8');
  }
  
  console.log(chalk.green(`✓ 已保存到: ${filePath}`));
}

// 生成补丁
function generatePatch(differences) {
  const patches = [];
  
  for (const change of differences) {
    const patchPath = change.path ? `/${change.path.replace(/\./g, '/')}` : '';
    
    switch (change.kind) {
      case 'N':
        patches.push({
          op: 'add',
          path: patchPath,
          value: change.rhs
        });
        break;
        
      case 'D':
        patches.push({
          op: 'remove',
          path: patchPath
        });
        break;
        
      case 'E':
        patches.push({
          op: 'replace',
          path: patchPath,
          value: change.rhs
        });
        break;
    }
  }
  
  return patches;
}

// 应用补丁
function applyPatch(obj, patches) {
  const result = JSON.parse(JSON.stringify(obj));
  
  for (const patch of patches) {
    const pathParts = patch.path.split('/').filter(p => p);
    let current = result;
    
    // 处理数组索引
    for (let i = 0; i < pathParts.length - 1; i++) {
      let part = pathParts[i];
      
      // 检查是否是数组索引
      const arrayIndex = part.match(/^(\d+)$/);
      if (arrayIndex && Array.isArray(current)) {
        const index = parseInt(arrayIndex[1]);
        if (!current[index]) {
          current[index] = {};
        }
        current = current[index];
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    }
    
    const lastPart = pathParts[pathParts.length - 1];
    
    switch (patch.op) {
      case 'add':
        if (Array.isArray(current)) {
          const index = parseInt(lastPart);
          current.splice(index, 0, patch.value);
        } else {
          current[lastPart] = patch.value;
        }
        break;
        
      case 'remove':
        if (Array.isArray(current)) {
          const index = parseInt(lastPart);
          current.splice(index, 1);
        } else {
          delete current[lastPart];
        }
        break;
        
      case 'replace':
        if (Array.isArray(current)) {
          const index = parseInt(lastPart);
          current[index] = patch.value;
        } else {
          current[lastPart] = patch.value;
        }
        break;
    }
  }
  
  return result;
}

// CLI 配置
program
  .name('json-diff')
  .description('JSON 差异比较工具 - 对比两个 JSON 文件的差异')
  .version('1.0.0');

program
  .command('diff <file1> <file2>')
  .option('-o, --output <path>', '导出到文件')
  .option('-f, --format <type>', '导出格式（json/csv/txt）', 'txt')
  .option('-p, --patch <path>', '生成 JSON Patch 文件')
  .option('--no-color', '禁用颜色')
  .option('--summary', '显示摘要')
  .description('比较两个 JSON 文件的差异')
  .action((file1, file2, options) => {
    try {
      console.log(chalk.cyan('\n🔍 比较差异\n'));
      console.log(chalk.gray(`文件 1: ${file1}`));
      console.log(chalk.gray(`文件 2: ${file2}\n`));
      
      const obj1 = readJsonFile(file1);
      const obj2 = readJsonFile(file2);
      
      const differences = deepCompare(obj1, obj2);
      
      // 显示差异
      const diffOutput = formatDiff(differences, options);
      console.log(diffOutput);
      
      // 显示摘要
      if (differences.length > 0 || options.summary) {
        const summary = getDiffSummary(differences);
        printSummary(summary);
      }
      
      // 导出差异
      if (options.output) {
        exportDiff(differences, options.output, options.format);
      }
      
      // 生成补丁
      if (options.patch) {
        const patches = generatePatch(differences);
        const patchDir = path.dirname(options.patch);
        
        if (!fs.existsSync(patchDir)) {
          fs.mkdirSync(patchDir, { recursive: true });
        }
        
        fs.writeFileSync(options.patch, JSON.stringify(patches, null, 2), 'utf-8');
        console.log(chalk.green(`✓ 补丁已保存到: ${options.patch}`));
      }
      
      // 退出码
      process.exit(differences.length > 0 ? 1 : 0);
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('patch <file> <patch>')
  .option('-o, --output <path>', '输出文件（默认覆盖原文件）')
  .description('应用 JSON Patch 到文件')
  .action((file, patchFile, options) => {
    try {
      console.log(chalk.cyan('\n🔧 应用补丁\n'));
      console.log(chalk.gray(`文件: ${file}`));
      console.log(chalk.gray(`补丁: ${patchFile}\n`));
      
      const obj = readJsonFile(file);
      const patches = JSON.parse(fs.readFileSync(patchFile, 'utf-8'));
      
      const patched = applyPatch(obj, patches);
      
      const outputFile = options.output || file;
      fs.writeFileSync(outputFile, JSON.stringify(patched, null, 2), 'utf-8');
      
      console.log(chalk.green(`✓ 补丁已应用: ${outputFile}`));
      console.log();
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();
