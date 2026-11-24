// data/trash.js —— 垃圾分类数据【丙】
// schema（冻结）：{ id, name, bin: 0可回收|1有害|2厨余|3其他, diff: 1~3(关卡难度池), tip: '知识点' }
// 新增 icon 字段（组长 2026-11-23）：assets/trash/<id>.png —— 美术组提供的实拍图标，
// 以数据 id 命名保证一一对应；游戏内瓦片与结算页错题卡均使用该图标。
// 要求：≥40 条、四分类均衡、tip 一句话讲清"为什么"（结算页答错回顾会展示）
// 数据：44 条，四类各 11 条（甲第 2 天做谱面生成时按 diff 过滤取池）
window.Game = window.Game || {};

Game.TRASH = [
  // ========== 可回收物（bin: 0）==========
  { id: 't01', name: '易拉罐', bin: 0, diff: 1, icon: 'assets/trash/t01.png', tip: '铝制易拉罐可再生冶炼成新铝材，回收价值很高，属于可回收物。' },
  { id: 't02', name: '塑料饮料瓶', bin: 0, diff: 1, icon: 'assets/trash/t02.png', tip: 'PET 饮料瓶可再生成再生纤维，做成衣服或地毯，属于可回收物。' },
  { id: 't03', name: '废纸箱', bin: 0, diff: 1, icon: 'assets/trash/t03.png', tip: '干净的瓦楞纸箱可打成纸浆重新造纸，属于可回收物。' },
  { id: 't04', name: '旧报纸', bin: 0, diff: 1, icon: 'assets/trash/t04.png', tip: '报纸脱墨后可再造纸，属于可回收物。' },
  { id: 't05', name: '玻璃瓶', bin: 0, diff: 1, icon: 'assets/trash/t05.png', tip: '玻璃可以无限次熔融再造而不降质，属于可回收物。' },
  { id: 't06', name: '旧衣服', bin: 0, diff: 2, icon: 'assets/trash/t06.png', tip: '纺织物可再生成再生纤维或工业抹布，属于可回收物。' },
  { id: 't07', name: '牛奶盒', bin: 0, diff: 2, icon: 'assets/trash/t07.png', tip: '洗净压扁的利乐包装可分离出纸、铝、塑三层再生利用，属于可回收物。' },
  { id: 't08', name: '金属罐头', bin: 0, diff: 1, icon: 'assets/trash/t08.png', tip: '铁罐可磁选回收再炼钢，属于可回收物。' },
  { id: 't09', name: '旧手机', bin: 0, diff: 2, icon: 'assets/trash/t09.png', tip: '电子产品含铜、金等金属，应交回收渠道拆解再生，属于可回收物。' },
  { id: 't10', name: '旧书', bin: 0, diff: 1, icon: 'assets/trash/t10.png', tip: '书本纸张可回收再造纸，属于可回收物；干净的优先捐赠或二手转让。' },
  { id: 't11', name: '塑料玩具', bin: 0, diff: 2, icon: 'assets/trash/t11.png', tip: '干净的硬塑料玩具可破碎再造，属于可回收物。' },

  // ========== 有害垃圾（bin: 1）==========
  { id: 't12', name: '废电池', bin: 1, diff: 1, icon: 'assets/trash/t12.png', tip: '废电池含汞、镉等重金属，随意丢弃会污染土壤和地下水，属于有害垃圾。' },
  { id: 't13', name: '过期药品', bin: 1, diff: 1, icon: 'assets/trash/t13.png', tip: '过期药品成分复杂，随生活垃圾处理会污染水体，属于有害垃圾。' },
  { id: 't14', name: '荧光灯管', bin: 1, diff: 2, icon: 'assets/trash/t14.png', tip: '荧光灯管内含汞蒸气，破碎后会挥发有毒汞，属于有害垃圾。' },
  { id: 't15', name: '水银温度计', bin: 1, diff: 2, icon: 'assets/trash/t15.png', tip: '水银就是金属汞，毒性强且难降解，属于有害垃圾。' },
  { id: 't16', name: '废油漆桶', bin: 1, diff: 3, icon: 'assets/trash/t16.png', tip: '油漆含苯类有机溶剂和重金属颜料，残留物污染大，属于有害垃圾。' },
  { id: 't17', name: '杀虫剂罐', bin: 1, diff: 3, icon: 'assets/trash/t17.png', tip: '杀虫剂含有机磷等有毒成分，空罐残留仍有害，属于有害垃圾。' },
  { id: 't18', name: '废胶水', bin: 1, diff: 3, icon: 'assets/trash/t18.png', tip: '胶水多含有机溶剂与树脂，属于有害垃圾，不能倒进下水道。' },
  { id: 't19', name: '过期化妆品', bin: 1, diff: 2, icon: 'assets/trash/t19.png', tip: '化妆品含防腐剂、香精和重金属，属于有害垃圾。' },
  { id: 't20', name: '废胶片', bin: 1, diff: 3, icon: 'assets/trash/t20.png', tip: '胶片显影层含银盐等化学物质，属于有害垃圾。' },
  { id: 't21', name: '打印机墨盒', bin: 1, diff: 2, icon: 'assets/trash/t21.png', tip: '墨盒残留墨粉含重金属与有机溶剂，属于有害垃圾。' },
  { id: 't22', name: '消毒剂瓶', bin: 1, diff: 3, icon: 'assets/trash/t22.png', tip: '消毒剂含强氧化性化学成分，属于有害垃圾，切勿混入可回收。' },

  // ========== 厨余垃圾（bin: 2）==========
  { id: 't23', name: '剩饭剩菜', bin: 2, diff: 1, icon: 'assets/trash/t23.png', tip: '剩饭剩菜易腐烂，可堆肥或厌氧产沼气，属于厨余垃圾。' },
  { id: 't24', name: '苹果核', bin: 2, diff: 1, icon: 'assets/trash/t24.png', tip: '果核果皮属于易腐有机物，可堆肥，属于厨余垃圾。' },
  { id: 't25', name: '菜叶', bin: 2, diff: 1, icon: 'assets/trash/t25.png', tip: '蔬菜叶含水量高、易降解，属于厨余垃圾。' },
  { id: 't26', name: '蛋壳', bin: 2, diff: 1, icon: 'assets/trash/t26.png', tip: '蛋壳主要成分是碳酸钙，可堆肥还田，属于厨余垃圾。' },
  { id: 't27', name: '茶叶渣', bin: 2, diff: 2, icon: 'assets/trash/t27.png', tip: '茶叶渣是植物残体、易腐，属于厨余垃圾。' },
  { id: 't28', name: '鱼骨', bin: 2, diff: 2, icon: 'assets/trash/t28.png', tip: '细小鱼骨易被粉碎降解，属于厨余垃圾。' },
  { id: 't29', name: '虾壳', bin: 2, diff: 2, icon: 'assets/trash/t29.png', tip: '虾壳属于易腐的生物质，可堆肥，属于厨余垃圾。' },
  { id: 't30', name: '过期面包', bin: 2, diff: 1, icon: 'assets/trash/t30.png', tip: '面包是易腐食物，属于厨余垃圾，拆掉包装袋单独投放。' },
  { id: 't31', name: '瓜子壳', bin: 2, diff: 3, icon: 'assets/trash/t31.png', tip: '瓜子壳属于易腐的植物性废弃物，按厨余垃圾投放。' },
  { id: 't32', name: '中药药渣', bin: 2, diff: 2, icon: 'assets/trash/t32.png', tip: '中药渣是植物纤维类有机物，可堆肥，属于厨余垃圾。' },
  { id: 't33', name: '花卉残枝', bin: 2, diff: 2, icon: 'assets/trash/t33.png', tip: '残枝花叶属于易腐的植物性垃圾，属于厨余垃圾。' },

  // ========== 其他垃圾（bin: 3）==========
  { id: 't34', name: '用过的纸巾', bin: 3, diff: 1, icon: 'assets/trash/t34.png', tip: '纸巾遇水即溶、纤维短且被污染，不可回收，属于其他垃圾。' },
  { id: 't35', name: '烟蒂', bin: 3, diff: 1, icon: 'assets/trash/t35.png', tip: '烟蒂含焦油和醋酸纤维滤嘴，难降解也不可回收，属于其他垃圾。' },
  { id: 't36', name: '大棒骨', bin: 3, diff: 2, icon: 'assets/trash/t36.png', tip: '大棒骨太硬，粉碎机难以处理，不属于厨余垃圾，应投其他垃圾。' },
  { id: 't37', name: '陶瓷碎片', bin: 3, diff: 2, icon: 'assets/trash/t37.png', tip: '陶瓷熔点高、无法与玻璃一起再生，属于其他垃圾。' },
  { id: 't38', name: '沾油的餐盒', bin: 3, diff: 2, icon: 'assets/trash/t38.png', tip: '被油污严重污染的一次性餐盒无法再生，属于其他垃圾。' },
  { id: 't39', name: '创可贴', bin: 3, diff: 2, icon: 'assets/trash/t39.png', tip: '创可贴沾有血液和胶层，不可回收，属于其他垃圾。' },
  { id: 't40', name: '猫砂', bin: 3, diff: 3, icon: 'assets/trash/t40.png', tip: '猫砂含膨润土、结块物和排泄物，无法堆肥回收，属于其他垃圾。' },
  { id: 't41', name: '尿不湿', bin: 3, diff: 2, icon: 'assets/trash/t41.png', tip: '尿不湿由高分子吸水材料组成，不可降解回收，属于其他垃圾。' },
  { id: 't42', name: '扫地灰土', bin: 3, diff: 1, icon: 'assets/trash/t42.png', tip: '扫地灰土混杂不可回收的细碎物，属于其他垃圾。' },
  { id: 't43', name: '旧牙刷', bin: 3, diff: 1, icon: 'assets/trash/t43.png', tip: '牙刷是多种塑料与刷毛的复合体，难以分离回收，属于其他垃圾。' },
  { id: 't44', name: '头发', bin: 3, diff: 3, icon: 'assets/trash/t44.png', tip: '头发降解慢、不属于可堆肥的厨余范畴，属于其他垃圾。' },
];
