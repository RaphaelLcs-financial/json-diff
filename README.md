# @raphaellcs/json-diff
[![npm](https://img.shields.io/npm/v/@raphaellcs/json-diff)](https://www.npmjs.org/package/@raphaellcs/json-diff)
[![downloads](https://img.shields.io/npm/dm/@raphaellcs/json-diff)](https://www.npmjs.org/package/@raphaellcs/json-diff)
[![license](https://img.shields.io/npm/l/@raphaellcs/json-diff)](https://www.npmjs.org/package/@raphaellcs/json-diff)
[![GitHub stars](https://img.shields.io/github/stars/RaphaelLcs-financial/json-diff?style=social)](https://github.com/RaphaelLcs-financial/json-diff/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/RaphaelLcs-financial/json-diff)](https://github.com/RaphaelLcs-financial/json-diff/issues)

> JSON 差异比较工具 - HTML 报告、JSON 合并、三路合并

## ⭐ 赞助

如果这个工具对你有帮助，请给个 Star ⭐️ 或者[赞助我](https://github.com/sponsors/RaphaelLcs-financial)！

## 🚀 功能

- **精确比较**：深度比较 JSON 对象和数组
- **清晰显示**：颜色高亮显示新增、删除、修改
- **多种格式**：JSON、CSV、TXT、HTML 导出（HTML 为新功能）
- **JSON Patch**：生成和应用标准 JSON Patch
- **差异摘要**：统计差异数量
- **数组支持**：处理数组差异
- **JSON 合并**：合并两个或多个 JSON 文件（新功能）
- **三路合并**：解决合并冲突（新功能）
- **忽略路径**：忽略特定字段的差异（新功能）

## 📦 安装

```bash
npx @claw-dev/json-diff
```

## 📖 快速开始

### 1. 比较两个文件

```bash
json-diff file1.json file2.json
```

输出：

```
🔍 比较差异

文件 1: file1.json
文件 2: file2.json

+  field3: "new value"
-  field2: "old value"
~  field1:
   "value1" → "value2"

📊 差异摘要

总差异: 3
新增: 1
删除: 1
修改: 1
数组变化: 0
```

### 2. 导出差异

```bash
# 导出为 JSON
json-diff file1.json file2.json -o diff.json -f json

# 导出为 CSV
json-diff file1.json file2.json -o diff.csv -f csv

# 导出为文本
json-diff file1.json file2.json -o diff.txt -f txt
```

### 3. 生成 JSON Patch

```bash
json-diff file1.json file2.json -p patch.json
```

生成标准 JSON Patch 文件，可用于版本控制系统或自动部署。

### 4. 应用补丁

```bash
json-diff patch file.json patch.json
```

将补丁应用到文件。

## 📋 差异类型

| 类型 | 颜色 | 说明 |
|------|------|------|
| `+` | 绿色 | 新增字段 |
| `-` | 红色 | 删除字段 |
| `~` | 黄色 | 修改字段 |
| `A` | 蓝色 | 数组变化 |

## 🎯 使用场景

### 1. 配置对比

```bash
json-diff config-dev.json config-prod.json
```

比较开发和生产环境的配置差异。

### 2. 数据库迁移

```bash
# 生成迁移脚本
json-diff schema-old.json schema-new.json -p migration.json

# 应用迁移
json-diff patch schema.json migration.json
```

### 3. API 响应对比

```bash
json-diff response-old.json response-new.json
```

检查 API 返回数据的变化。

### 4. 版本比较

```bash
json-diff package-v1.json package-v2.json
```

比较不同版本的配置或数据。

### 5. 批量比较

```bash
#!/bin/bash

for file in *.json; do
    json-diff "old/$file" "new/$file" -o "diffs/${file%.json}.diff"
done
```

## 💡 JSON Patch

### 什么是 JSON Patch？

JSON Patch (RFC 6902) 是一种标准格式，用于描述如何修改 JSON 文档。

### 补丁操作

```json
[
  { "op": "add", "path": "/baz", "value": "qux" },
  { "op": "remove", "path": "/bad" },
  { "op": "replace", "path": "/foo", "value": "bar" }
]
```

| 操作 | 说明 |
|------|------|
| `add` | 添加值 |
| `remove` | 删除值 |
| `replace` | 替换值 |

### 使用补丁

生成补丁：

```bash
json-diff old.json new.json -p changes.patch
```

应用补丁：

```bash
json-diff patch old.json changes.patch -o patched.json
```

## 📊 差异摘要

使用 `--summary` 总是显示摘要：

```bash
json-diff file1.json file2.json --summary
```

输出：

```
📊 差异摘要

总差异: 5
新增: 2
删除: 1
修改: 2
数组变化: 0
```

## 🔧 高级功能

### 1. 无颜色输出

```bash
json-diff file1.json file2.json --no-color
```

适合脚本或 CI/CD 环境。

### 2. 仅摘要

```bash
json-diff file1.json file2.json --summary
```

快速了解有多少差异，不显示详情。

### 3. 应用补丁到新文件

```bash
json-diff patch old.json changes.patch -o new.json
```

不覆盖原文件，保存为新文件。

## 🚧 待实现

- [ ] 自定义比较函数
- [ ] 可视化差异（实时）
- [ ] 支持更多格式（YAML、XML）

## ✨ 新功能（v2.0.0）

### HTML 报告

生成美观的可视化差异报告：

```bash
json-diff file1.json file2.json -o report.html -f html
```

包含：
- 差异摘要统计
- 颜色编码的差异
- 新增（绿色）、删除（红色）、修改（黄色）
- 响应式设计

### JSON 合并

合并两个或多个 JSON 文件：

```bash
# 基础合并
json-diff merge target.json source.json -o merged.json

# 策略合并
json-diff merge base.json extra.json -s merge -a merge

# 深度合并多个文件
json-diff merge base.json a.json b.json c.json --deep -o merged.json
```

合并策略：
- `overwrite`：源值覆盖目标值（默认）
- `preserve`：保留目标值，不覆盖
- `merge`：递归合并对象

数组合并：
- `overwrite`：数组覆盖
- `concatenate`：数组拼接
- `merge`：数组合并并去重

### 三路合并

解决 Git 冲突或版本合并：

```bash
json-diff 3way base.json local.json remote.json
```

特性：
- 自动检测冲突
- 显示冲突详情
- 非冲突字段自动合并
- 支持多种合并策略

### 忽略路径

比较时忽略特定字段：

```bash
json-diff file1.json file2.json -i "metadata,timestamp,_id,traceId"
```

适用于忽略临时字段或内部字段。

## 🤝 贡献

欢迎提交 Issue 和 PR！

## 📄 许可证

MIT © 梦心

---

Made with 🌙 by 梦心
