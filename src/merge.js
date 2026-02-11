// JSON 合并模块

/**
 * 合并两个 JSON 对象
 * @param {Object} target - 目标对象
 * @param {Object} source - 源对象
 * @param {Object} options - 合并选项
 * @returns {Object} 合并后的对象
 */
function mergeJson(target, source, options = {}) {
  const {
    strategy = 'overwrite',  // overwrite | preserve | merge
    arrayMerge = 'overwrite'  // overwrite | concatenate | merge
  } = options;

  const result = JSON.parse(JSON.stringify(target));

  function merge(t, s, path = '') {
    for (const key of Object.keys(s)) {
      const sourceValue = s[key];
      const targetValue = t[key];
      const currentPath = path ? `${path}.${key}` : key;

      // 目标不存在，直接添加
      if (targetValue === undefined) {
        t[key] = JSON.parse(JSON.stringify(sourceValue));
        continue;
      }

      // 类型不同
      const sourceType = Array.isArray(sourceValue) ? 'array' : typeof sourceValue;
      const targetType = Array.isArray(targetValue) ? 'array' : typeof targetValue;

      if (sourceType !== targetType) {
        // 类型不同，根据策略处理
        if (strategy === 'preserve') {
          continue;
        } else {
          t[key] = JSON.parse(JSON.stringify(sourceValue));
        }
        continue;
      }

      // 数组处理
      if (sourceType === 'array') {
        switch (arrayMerge) {
          case 'overwrite':
            t[key] = JSON.parse(JSON.stringify(sourceValue));
            break;
          case 'concatenate':
            t[key] = [...targetValue, ...sourceValue];
            break;
          case 'merge':
            t[key] = mergeArrays(targetValue, sourceValue);
            break;
        }
        continue;
      }

      // 对象递归
      if (sourceType === 'object' && sourceValue !== null) {
        merge(targetValue, sourceValue, currentPath);
        continue;
      }

      // 基本类型，根据策略处理
      if (strategy === 'preserve') {
        continue;
      } else {
        t[key] = JSON.parse(JSON.stringify(sourceValue));
      }
    }
  }

  merge(result, source);
  return result;
}

/**
 * 合并两个数组
 * @param {Array} arr1 - 第一个数组
 * @param {Array} arr2 - 第二个数组
 * @returns {Array} 合并后的数组
 */
function mergeArrays(arr1, arr2) {
  const result = [...arr1];

  for (const item of arr2) {
    // 简单去重
    if (typeof item === 'object' && item !== null) {
      const json = JSON.stringify(item);
      if (!result.some(i => JSON.stringify(i) === json)) {
        result.push(item);
      }
    } else if (!result.includes(item)) {
      result.push(item);
    }
  }

  return result;
}

/**
 * 深度合并多个 JSON 对象
 * @param {Array<Object>} objects - JSON 对象数组
 * @param {Object} options - 合并选项
 * @returns {Object} 合并后的对象
 */
function deepMerge(objects, options = {}) {
  if (!Array.isArray(objects) || objects.length === 0) {
    return {};
  }

  let result = JSON.parse(JSON.stringify(objects[0]));

  for (let i = 1; i < objects.length; i++) {
    result = mergeJson(result, objects[i], options);
  }

  return result;
}

/**
 * 扁平化 JSON 对象
 * @param {Object} obj - JSON 对象
 * @param {string} separator - 分隔符
 * @returns {Object} 扁平化后的对象
 */
function flattenObject(obj, separator = '.') {
  const result = {};

  function flatten(current, path = '') {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      result[path] = current;
      return;
    }

    for (const [key, value] of Object.entries(current)) {
      const newPath = path ? `${path}${separator}${key}` : key;
      flatten(value, newPath);
    }
  }

  flatten(obj);
  return result;
}

/**
 * 嵌套化扁平对象
 * @param {Object} obj - 扁平对象
 * @param {string} separator - 分隔符
 * @returns {Object} 嵌套对象
 */
function unflattenObject(obj, separator = '.') {
  const result = {};

  for (const [path, value] of Object.entries(obj)) {
    const keys = path.split(separator);
    let current = result;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  return result;
}

/**
 * 比较并合并（三路合并基础）
 * @param {Object} base - 基础版本
 * @param {Object} local - 本地修改
 * @param {Object} remote - 远程修改
 * @param {Object} options - 合并选项
 * @returns {Object} 合并结果
 */
function threeWayMerge(base, local, remote, options = {}) {
  const result = JSON.parse(JSON.stringify(base));

  // 比较本地 vs 基础
  const localChanges = compareChanges(base, local);

  // 比较远程 vs 基础
  const remoteChanges = compareChanges(base, remote);

  // 找出冲突
  const conflicts = findConflicts(localChanges, remoteChanges);

  // 应用非冲突的修改
  for (const [path, change] of Object.entries(localChanges)) {
    if (!conflicts.includes(path)) {
      setValue(result, path, change.value);
    }
  }

  for (const [path, change] of Object.entries(remoteChanges)) {
    if (!conflicts.includes(path)) {
      setValue(result, path, change.value);
    }
  }

  return {
    merged: result,
    conflicts: conflicts.map(path => ({
      path,
      local: localChanges[path]?.value,
      remote: remoteChanges[path]?.value
    }))
  };
}

/**
 * 比较变更
 * @param {Object} from - 源对象
 * @param {Object} to - 目标对象
 * @returns {Object} 变更映射
 */
function compareChanges(from, to) {
  const changes = {};
  const flatFrom = flattenObject(from);
  const flatTo = flattenObject(to);

  for (const [path, value] of Object.entries(flatTo)) {
    if (flatFrom[path] !== value) {
      changes[path] = { from: flatFrom[path], value };
    }
  }

  return changes;
}

/**
 * 找出冲突
 * @param {Object} localChanges - 本地变更
 * @param {Object} remoteChanges - 远程变更
 * @returns {Array} 冲突路径
 */
function findConflicts(localChanges, remoteChanges) {
  const conflicts = [];

  for (const path of Object.keys(localChanges)) {
    if (remoteChanges[path] && JSON.stringify(localChanges[path].value) !== JSON.stringify(remoteChanges[path].value)) {
      conflicts.push(path);
    }
  }

  return conflicts;
}

/**
 * 设置嵌套值
 * @param {Object} obj - 目标对象
 * @param {string} path - 路径
 * @param {*} value - 值
 */
function setValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = JSON.parse(JSON.stringify(value));
}

module.exports = {
  mergeJson,
  mergeArrays,
  deepMerge,
  flattenObject,
  unflattenObject,
  threeWayMerge
};
