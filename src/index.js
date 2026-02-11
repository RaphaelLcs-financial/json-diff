#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const {
  generateHtmlDiff,
  getDiffSummary as getDiffSummaryExternal
} = require('./html-report.js');

// 获取差异摘要（使用导入的或本地的）
function getDiffSummary(differences) {
  return getDiffSummaryExternal(differences);
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
const {
  mergeJson,
  deepMerge,
  threeWayMerge
} = require('./merge.js');

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
  .option('-f, --format <type>', '导出格式（json/csv/txt/html）', 'txt')
  .option('-p, --patch <path>', '生成 JSON Patch 文件')
  .option('--no-color', '禁用颜色')
  .option('--summary', '显示摘要')
  .option('-i, --ignore <paths>', '忽略的路径（逗号分隔）')
  .description('比较两个 JSON 文件的差异')
  .action((file1, file2, options) => {
    try {
      console.log(chalk.cyan('\n🔍 比较差异\n'));
      console.log(chalk.gray(`文件 1: ${file1}`));
      console.log(chalk.gray(`文件 2: ${file2}\n`));

      const obj1 = readJsonFile(file1);
      const obj2 = readJsonFile(file2);

      let differences = deepCompare(obj1, obj2);

      // 过滤忽略的路径
      if (options.ignore) {
        const ignorePaths = options.ignore.split(',').map(p => p.trim());
        differences = differences.filter(d => {
          const diffPath = d.path || '';
          return !ignorePaths.some(igp => diffPath.startsWith(igp));
        });
      }

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
        if (options.format === 'html') {
          const html = generateHtmlDiff(differences, path.basename(file1), path.basename(file2));
          const outputDir = path.dirname(options.output);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          fs.writeFileSync(options.output, html, 'utf-8');
          console.log(chalk.green(`✓ 已保存到: ${options.output}`));
        } else {
          exportDiff(differences, options.output, options.format);
        }
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

// 合并命令
program
  .command('merge <target> <source> [output]')
  .option('-s, --strategy <type>', '合并策略（overwrite/preserve/merge）', 'overwrite')
  .option('-a, --array-merge <type>', '数组合并方式（overwrite/concatenate/merge）', 'overwrite')
  .option('--deep', '深度合并所有子对象')
  .description('合并两个 JSON 文件')
  .action((target, source, output, options) => {
    try {
      console.log(chalk.cyan('\n🔀 合并 JSON\n'));
      console.log(chalk.gray(`目标文件: ${target}`));
      console.log(chalk.gray(`源文件: ${source}\n`));

      const targetObj = readJsonFile(target);
      const sourceObj = readJsonFile(source);

      let merged;

      if (options.deep) {
        // 深度合并
        const objects = [targetObj, sourceObj];
        // 读取额外的源文件
        for (let i = 3; i < process.argv.length; i++) {
          const arg = process.argv[i];
          if (!arg.startsWith('-') && !arg.includes('.json')) {
            break;
          }
          try {
            const obj = readJsonFile(arg);
            objects.push(obj);
          } catch (e) {
            // 不是文件，跳过
          }
        }

        merged = deepMerge(objects, {
          strategy: options.strategy,
          arrayMerge: options.arrayMerge
        });

        console.log(chalk.gray(`合并策略: ${options.strategy}`));
        console.log(chalk.gray(`数组合并: ${options.arrayMerge}`));
      } else {
        // 两两合并
        merged = mergeJson(targetObj, sourceObj, {
          strategy: options.strategy,
          arrayMerge: options.arrayMerge
        });

        console.log(chalk.gray(`合并策略: ${options.strategy}`));
        console.log(chalk.gray(`数组合并: ${options.arrayMerge}`));
      }

      const outputFile = output || target;
      fs.writeFileSync(outputFile, JSON.stringify(merged, null, 2), 'utf-8');

      console.log(chalk.green(`✓ 合并完成: ${outputFile}`));
      console.log();
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// 三路合并命令
program
  .command('3way <base> <local> <remote> [output]')
  .option('-s, --strategy <type>', '合并策略（overwrite/preserve/merge）', 'merge')
  .option('-a, --array-merge <type>', '数组合并方式（overwrite/concatenate/merge）', 'merge')
  .option('--show-conflicts', '显示冲突详情')
  .description('三路合并 JSON 文件（用于解决冲突）')
  .action((base, local, remote, output, options) => {
    try {
      console.log(chalk.cyan('\n🔀 三路合并\n'));
      console.log(chalk.gray(`基础版本: ${base}`));
      console.log(chalk.gray(`本地修改: ${local}`));
      console.log(chalk.gray(`远程修改: ${remote}\n`));

      const baseObj = readJsonFile(base);
      const localObj = readJsonFile(local);
      const remoteObj = readJsonFile(remote);

      const result = threeWayMerge(baseObj, localObj, remoteObj, {
        strategy: options.strategy,
        arrayMerge: options.arrayMerge
      });

      const outputFile = output || base;
      fs.writeFileSync(outputFile, JSON.stringify(result.merged, null, 2), 'utf-8');

      console.log(chalk.green(`✓ 合并完成: ${outputFile}`));

      if (result.conflicts.length > 0) {
        console.log(chalk.yellow(`\n⚠️  发现 ${result.conflicts.length} 个冲突:\n`));

        for (const conflict of result.conflicts) {
          console.log(chalk.red(`  ${conflict.path}:`));
          console.log(chalk.gray(`    本地: ${JSON.stringify(conflict.local)}`));
          console.log(chalk.gray(`    远程: ${JSON.stringify(conflict.remote)}`));
          console.log();
        }

        console.log(chalk.yellow('请手动解决这些冲突！'));
        process.exit(1);
      } else {
        console.log(chalk.green('\n✓ 没有冲突，合并成功！\n'));
      }
    } catch (error) {
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();
