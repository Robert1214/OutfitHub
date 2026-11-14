// 店主审核的两套风格比较资料（通勤比较组 v1）。
//
// 与单节点三题（CF01/CF02/CF03）验证用的资料同形：
// - 无数据库商品ID、无购买链接、不输出 [[PRODUCTS:...]]；
// - purchaseScope=undecided，只比较风格，不做预算/购买范围/尺码判断；
// - S05 价格为店主暂定样例价（priceStatus 已标注），两套小计不是完整购买总价。
// 新增比较组时先由店主确认再扩展，不把该结构泛化到未审核组合。

export type ComparisonItem = {
  sampleId: string;
  name: string;
  category: "tops" | "bottoms" | "dresses" | "outerwear" | "accessories" | "shoes";
  priceCents: number;
  color?: string;
  material?: string | null;
  materialPercentage?: number | null;
  priceStatus?: string;
  source?: string;
  ownerDescriptions: string[];
  imageObservations?: string[];
  pairingLimitations?: string[];
};

export type ComparisonOption = {
  label: "A" | "B";
  name: string;
  itemSampleIds: string[];
  listedItemsSubtotalCents: number;
  ownerPairingBasis: string;
  innerLayerPurchaseScope?: string;
  purchaseTotalCents: number | null;
};

export type OwnerComparisonCatalog = {
  scope: "internal_style_comparison";
  fixtureVersion: string;
  provenance: "owner_reviewed_comparison_catalog";
  comparisonOnly: true;
  purchaseScope: "undecided";
  currentProduct: null;
  notes: string[];
  items: ComparisonItem[];
  comparisonOptions: ComparisonOption[];
};

export const ownerReviewedComparisonCatalog: OwnerComparisonCatalog = {
  scope: "internal_style_comparison",
  fixtureVersion: "commute-comparison-v1",
  provenance: "owner_reviewed_comparison_catalog",
  comparisonOnly: true,
  purchaseScope: "undecided",
  currentProduct: null,
  notes: [
    "两组是本轮提供的比较对象，不证明顾客正在浏览某一商品或已决定购买。",
    "没有数据库商品ID和可购买链接。人物尺寸、成衣尺寸、库存、退换等未提供。",
    "店主描述属于这两件具体商品的比较依据，不自动推广为所有同品类商品。",
  ],
  items: [
    {
      sampleId: "S02",
      name: "基础垂感休闲西裤",
      category: "bottoms",
      priceCents: 36800,
      ownerDescriptions: ["基础百搭，但有搭配限制", "垂感轻盈", "多个尺码，具体尺寸未知"],
      material: null,
      pairingLimitations: ["不适合搭配摇滚风或鲜艳亮色单品；此限制不自动扩大为所有浅色单品。"],
    },
    {
      sampleId: "S04",
      name: "海军蓝亚麻衬衫",
      category: "tops",
      priceCents: 45800,
      color: "海军蓝",
      material: "亚麻",
      materialPercentage: null,
      source: "owner_provided",
      ownerDescriptions: ["沉稳低调", "修身穿更好看", "轻盈舒适", "相比这件米白运动外套更正式、更透气清爽", "适合大部分上班场合，具体着装要求仍需核对"],
      imageObservations: ["长袖", "领尖纽扣", "前中浅色纽扣", "小红色胸标"],
    },
    {
      sampleId: "S05",
      name: "米白色adidas运动外套",
      category: "outerwear",
      priceCents: 48800,
      priceStatus: "owner_set_provisional_sample_price",
      color: "米白",
      material: null,
      source: "owner_provided",
      ownerDescriptions: ["比海军蓝衬衫更明亮，但不张扬", "偏运动街头感", "修身或宽松穿都可以，这不保证具体尺码合身", "相比这件衬衫适合温度更低时穿，具体温度与保暖等级未知"],
      imageObservations: ["深色立领、袖口与下摆", "袖部条纹", "前中拉链", "胸前标识"],
    },
  ],
  comparisonOptions: [
    {
      label: "A",
      name: "海军蓝衬衫配休闲西裤",
      itemSampleIds: ["S04", "S02"],
      listedItemsSubtotalCents: 82600,
      ownerPairingBasis: "店主明确认可该具体衬衫与西裤搭配。",
      purchaseTotalCents: null,
    },
    {
      label: "B",
      name: "米白运动外套配休闲西裤",
      itemSampleIds: ["S05", "S02"],
      listedItemsSubtotalCents: 85600,
      ownerPairingBasis: "店主选作与A对照的具体外套与西裤组合。",
      innerLayerPurchaseScope: "undecided",
      purchaseTotalCents: null,
    },
  ],
};
