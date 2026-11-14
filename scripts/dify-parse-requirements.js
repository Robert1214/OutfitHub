// Copy this complete file into the existing Dify JavaScript code node.
// Input: text = parameter LLM.text. Outputs: q/category/styleTags/requirements, all String.
function main({ text }) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("需求提取输出为空，未执行商品查询");
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("需求提取输出不是合法 JSON，未执行商品查询");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("需求提取输出必须是 JSON 对象");
  }
  const required = ["q", "intent", "category", "styleTags", "budgetCents",
    "budgetScope", "includeCurrentProduct", "otherRequirements", "missingInformation"];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      throw new Error("需求提取缺少字段：" + key);
    }
  }
  const allowed = [...required, "requestedCategories", "anchorProductId"];
  const unknownFields = Object.keys(data).filter((key) => !allowed.includes(key));
  if (unknownFields.length) {
    throw new Error("需求提取包含未约定字段：" + unknownFields.join("、"));
  }
  if (typeof data.q !== "string" || data.q.length > 80) {
    throw new Error("q 必须是最多 80 字符的检索词");
  }
  const categories = ["tops", "bottoms", "dresses", "outerwear", "accessories", "shoes"];
  const enums = {
    intent: ["search", "outfit", "similar", "product_info", "color_advice", "comparison", "unknown"],
    category: [...categories, ""],
    budgetScope: ["item", "total", "unknown", "none"]
  };
  for (const key of Object.keys(enums)) {
    if (!enums[key].includes(data[key])) throw new Error("字段取值不合法：" + key);
  }
  for (const key of ["styleTags", "otherRequirements", "missingInformation"]) {
    if (!Array.isArray(data[key]) || data[key].some((v) => typeof v !== "string" || !v.trim())) {
      throw new Error("字段必须是非空字符串组成的数组：" + key);
    }
  }
  if (data.styleTags.length > 8 || data.styleTags.some((v) => v.length > 50 || /[,，]/.test(v)) ||
      data.styleTags.join(",").length > 300) {
    throw new Error("风格标签不符合商品接口格式");
  }
  for (const key of ["otherRequirements", "missingInformation"]) {
    if (data[key].length > 20 || data[key].some((v) => v.length > 300)) {
      throw new Error("需求条件过长：" + key);
    }
  }
  if (data.budgetCents !== null && (!Number.isSafeInteger(data.budgetCents) || data.budgetCents < 0)) {
    throw new Error("预算必须是非负整数分或 null");
  }
  if ((data.budgetCents === null) !== (data.budgetScope === "none")) {
    throw new Error("预算金额与预算范围不一致");
  }
  if (data.includeCurrentProduct !== null && typeof data.includeCurrentProduct !== "boolean") {
    throw new Error("includeCurrentProduct 必须是布尔值或 null");
  }
  if (data.anchorProductId !== undefined && data.anchorProductId !== null &&
      (typeof data.anchorProductId !== "string" || !data.anchorProductId.trim() || data.anchorProductId.length > 50)) {
    throw new Error("anchorProductId 必须是真实商品ID字符串或 null");
  }
  if (Object.prototype.hasOwnProperty.call(data, "requestedCategories")) {
    const values = data.requestedCategories;
    if (!Array.isArray(values) || values.length > 6 ||
        values.some((value) => !categories.includes(value)) || new Set(values).size !== values.length) {
      throw new Error("requestedCategories 必须是不重复的合法品类数组");
    }
    if (values.length === 1 ? data.category !== values[0] : data.category !== "") {
      throw new Error("category 必须与尚待寻找的候选品类一致");
    }
  }
  return {
    q: data.q.trim(),
    category: data.category,
    styleTags: data.styleTags.join(","),
    requirements: JSON.stringify(data)
  };
}
