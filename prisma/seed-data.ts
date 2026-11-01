export type SeedRefType = "GARMENT" | "ACCESSORIES" | "SHOES";
export type SeedFitType = "SLIM" | "REGULAR" | "LOOSE";
export type SeedStatus = "ON_SALE" | "SOLD";

export type SeedCategory = {
  name: string;
  slug: string;
  sortOrder: number;
};

export type SeedProduct = {
  slug: string;
  name: string;
  refType: SeedRefType;
  categorySlug: string;
  description: string;
  priceCents: number;
  color: string;
  sizeLabel?: string;
  material: string;
  careInstructions: string;
  tags: string[];
  fitType?: SeedFitType;
  chestCm?: number;
  lengthCm?: number;
  shoulderCm?: number;
  waistCm?: number;
  hipCm?: number;
  pantsLengthCm?: number;
  stock: number;
  status: SeedStatus;
};

export function productImageFiles(slug: string): string[] {
  return [1, 2, 3].map((n) => `${slug}-${n}.jpg`);
}

export const seedCategories: SeedCategory[] = [
  { name: "上装", slug: "tops", sortOrder: 1 },
  { name: "下装", slug: "bottoms", sortOrder: 2 },
  { name: "连衣裙", slug: "dresses", sortOrder: 3 },
  { name: "外套", slug: "outerwear", sortOrder: 4 },
  { name: "配饰", slug: "accessories", sortOrder: 5 },
  { name: "鞋履", slug: "shoes", sortOrder: 6 },
];

export const seedProducts: SeedProduct[] = [
  {
    slug: "ivory-knit-cardigan",
    name: "米白针织开衫",
    refType: "GARMENT",
    categorySlug: "tops",
    description: "柔软羊毛混纺，短款开衫版型，适合春秋叠穿。米白色百搭，通勤和约会都合适。",
    priceCents: 32900,
    color: "米白",
    sizeLabel: "均码",
    material: "羊毛 30% / 腈纶 70%",
    careInstructions: "手洗冷水，平铺晾干",
    tags: ["针织", "温柔", "通勤"],
    fitType: "REGULAR",
    chestCm: 96,
    lengthCm: 58,
    shoulderCm: 38,
    stock: 1,
    status: "ON_SALE",
  },
  {
    slug: "black-silk-shirt",
    name: "黑色真丝衬衫",
    refType: "GARMENT",
    categorySlug: "tops",
    description: "桑蚕丝面料，微收腰剪裁，垂坠感好。黑色经典，单穿或内搭都利落。",
    priceCents: 45900,
    color: "黑色",
    sizeLabel: "均码",
    material: "桑蚕丝 100%",
    careInstructions: "建议干洗",
    tags: ["真丝", "通勤", "极简"],
    fitType: "SLIM",
    chestCm: 92,
    lengthCm: 62,
    shoulderCm: 37,
    stock: 1,
    status: "ON_SALE",
  },
  {
    slug: "floral-midi-dress",
    name: "碎花收腰连衣裙",
    refType: "GARMENT",
    categorySlug: "dresses",
    description: "奶油白底碎花，收腰 A 字裙摆，长度到小腿中部。适合约会和周末出游。",
    priceCents: 39900,
    color: "奶油白",
    sizeLabel: "均码",
    material: "聚酯纤维 100%",
    careInstructions: "机洗轻柔，悬挂晾干",
    tags: ["碎花", "约会", "连衣裙"],
    fitType: "REGULAR",
    chestCm: 94,
    lengthCm: 112,
    shoulderCm: 36,
    stock: 1,
    status: "ON_SALE",
  },
  {
    slug: "camel-wool-coat",
    name: "驼色羊毛大衣",
    refType: "GARMENT",
    categorySlug: "outerwear",
    description: "羊毛混纺大衣，宽松落肩版型，长度过膝。驼色温柔，秋冬通勤首选。",
    priceCents: 89900,
    color: "驼色",
    sizeLabel: "均码",
    material: "羊毛 80% / 聚酯纤维 20%",
    careInstructions: "建议干洗",
    tags: ["羊毛", "大衣", "秋冬"],
    fitType: "LOOSE",
    chestCm: 108,
    lengthCm: 105,
    shoulderCm: 42,
    stock: 1,
    status: "ON_SALE",
  },
  {
    slug: "black-wide-leg-pants",
    name: "黑色高腰阔腿裤",
    refType: "GARMENT",
    categorySlug: "bottoms",
    description: "高腰垂感阔腿裤，宽松直筒版型，遮肉显腿长。黑色百搭，通勤和日常都适合。",
    priceCents: 35900,
    color: "黑色",
    sizeLabel: "均码",
    material: "聚酯纤维 100%",
    careInstructions: "机洗轻柔，悬挂晾干",
    tags: ["阔腿裤", "高腰", "通勤"],
    fitType: "LOOSE",
    waistCm: 72,
    hipCm: 102,
    pantsLengthCm: 105,
    stock: 1,
    status: "ON_SALE",
  },
  {
    slug: "canvas-tote-bag",
    name: "帆布托特包",
    refType: "ACCESSORIES",
    categorySlug: "accessories",
    description: "厚实棉帆布，容量可放 13 寸电脑。米色简约，日常通勤和上课都实用。",
    priceCents: 19900,
    color: "米色",
    sizeLabel: "均码",
    material: "棉帆布",
    careInstructions: "不可机洗，湿布擦拭",
    tags: ["帆布", "通勤", "包"],
    stock: 1,
    status: "ON_SALE",
  },
  {
    slug: "leather-belt",
    name: "复古牛皮腰带",
    refType: "ACCESSORIES",
    categorySlug: "accessories",
    description: "头层牛皮，复古做旧金属扣。棕色百搭，可搭配牛仔裤或连衣裙。",
    priceCents: 15900,
    color: "棕色",
    sizeLabel: "均码",
    material: "头层牛皮",
    careInstructions: "干布擦拭，避免暴晒",
    tags: ["牛皮", "复古", "配饰"],
    stock: 1,
    status: "ON_SALE",
  },
  {
    slug: "retro-loafers",
    name: "复古乐福鞋",
    refType: "SHOES",
    categorySlug: "shoes",
    description: "头层牛皮乐福鞋，复古方头设计，低跟好走。黑色百搭，通勤休闲皆可。",
    priceCents: 49900,
    color: "黑色",
    sizeLabel: "38",
    material: "头层牛皮",
    careInstructions: "干布擦拭，避免暴晒",
    tags: ["乐福鞋", "复古", "皮鞋"],
    stock: 0,
    status: "SOLD",
  },
  {
    slug: "white-sneakers",
    name: "白色板鞋",
    refType: "SHOES",
    categorySlug: "shoes",
    description: "白色牛皮板鞋，橡胶底防滑耐磨。简约百搭，适合日常出行。",
    priceCents: 39900,
    color: "白色",
    sizeLabel: "37",
    material: "牛皮 / 橡胶底",
    careInstructions: "湿布擦拭，阴干",
    tags: ["板鞋", "简约", "百搭"],
    stock: 1,
    status: "ON_SALE",
  },
];
