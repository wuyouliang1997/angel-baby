const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// 金额四舍五入到分，避免浮点累加出现长尾小数
const roundMoney = (n) => Math.round(n * 100) / 100;

// 获取当前用户可访问的所有 openid（自己的 + 共享的）
const getUserOpenids = async (currentOpenid) => {
  const openids = [currentOpenid];
  try {
    // 分页遍历全部 family_shares（云函数端 get() 默认上限 100，需分页取全）
    const pageSize = 1000;
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await db.collection("family_shares").skip(skip).limit(pageSize).get();
      const batch = res.data || [];
      batch.forEach(s => {
        // 检查当前用户是否在共享中
        let hasAccess = s.ownerOpenid === currentOpenid;
        if (!hasAccess && s.sharedOpenids) {
          hasAccess = s.sharedOpenids.some(item => {
            const id = typeof item === 'string' ? item : item.openid;
            return id === currentOpenid;
          });
        }
        if (hasAccess) {
          if (s.ownerOpenid && !openids.includes(s.ownerOpenid)) openids.push(s.ownerOpenid);
          if (s.sharedOpenids) {
            s.sharedOpenids.forEach(item => {
              const id = typeof item === 'string' ? item : item.openid;
              if (id && !openids.includes(id)) openids.push(id);
            });
          }
        }
      });
      if (batch.length < pageSize) {
        hasMore = false;
      } else {
        skip += pageSize;
      }
    }
  } catch (e) { /* 集合不存在时忽略 */ }
  return openids;
};

// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// 更新数据
const updateRecord = async (event) => {
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            sales: event.data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  try {
    const insertRecord = event.data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  try {
    await db
      .collection("sales")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// ========== 奶量记录相关 ==========

// 新增奶量记录
const addMilkRecord = async (event) => {
  try {
    const { amount, recordTime, recordDate, timestamp, remark, babyId } = event.data;

    // 参数校验
    if (!amount || amount < 10 || amount > 500) {
      return { success: false, errMsg: "奶量请填写10-500ml" };
    }
    if (!recordTime || !recordDate) {
      return { success: false, errMsg: "参数错误" };
    }

    try { await db.createCollection("milk_records"); } catch (e) { }

    const wxContext = cloud.getWXContext();
    const result = await db.collection("milk_records").add({
      data: {
        _openid: wxContext.OPENID,
        babyId: babyId || "",
        amount: Number(amount),
        recordTime,
        recordDate,
        timestamp,
        remark: remark || "",
        createdAt: new Date().toISOString()
      }
    });

    return { success: true, data: { _id: result._id } };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 查询指定日期的奶量记录
const getTodayRecords = async (event) => {
  try {
    const { date, babyId } = event.data || {};

    // 使用本地时间获取今天日期
    let recordDate = date;
    if (!recordDate) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      recordDate = `${y}-${m}-${d}`;
    }

    const wxContext = cloud.getWXContext();
    const openids = await getUserOpenids(wxContext.OPENID);
    const whereCondition = {
      _openid: db.command.in(openids),
      recordDate: recordDate
    };

    if (babyId) {
      whereCondition.babyId = babyId;
    }

    // 获取总数（使用 count 获取准确值）
    const countRes = await db.collection("milk_records")
      .where(whereCondition)
      .count();

    const result = await db.collection("milk_records")
      .where(whereCondition)
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    // 单独统计总奶量（不受列表 limit(100) 影响，与 count 保持一致）
    const sumRes = await db.collection("milk_records")
      .where(whereCondition)
      .field({ amount: true })
      .limit(1000)
      .get();
    const total = sumRes.data.reduce((sum, item) => sum + item.amount, 0);
    const count = countRes.total;

    return {
      success: true,
      data: result.data,
      total,
      count
    };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 删除奶量记录
const deleteMilkRecord = async (event) => {
  try {
    const { _id } = event.data;
    if (!_id) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();

    // 先查询确认记录属于当前用户
    const record = await db.collection("milk_records").doc(_id).get();
    if (!record.data || record.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权删除" };
    }

    await db.collection("milk_records").doc(_id).remove();
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 修改奶量记录
const updateMilkRecord = async (event) => {
  try {
    const { _id, amount, recordTime, timestamp, remark, recordDate } = event.data;
    if (!_id) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();

    // 先查询确认记录属于当前用户
    const record = await db.collection("milk_records").doc(_id).get();
    if (!record.data || record.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权修改" };
    }

    const updateData = {
      amount: Number(amount),
      recordTime,
      timestamp,
      remark: remark || ""
    };
    // 编辑时允许修改日期，保持 recordDate 与 timestamp 一致
    if (recordDate) {
      updateData.recordDate = recordDate;
    }

    await db.collection("milk_records").doc(_id).update({ data: updateData });

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 查询日期范围内的奶量记录
const getMilkRecordsByDateRange = async (event) => {
  try {
    const { startDate, endDate, babyId } = event.data;
    if (!startDate || !endDate) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();

    const openids = await getUserOpenids(wxContext.OPENID);

    const whereCondition = {
      _openid: db.command.in(openids),
      recordDate: db.command.and([
        db.command.gte(startDate),
        db.command.lte(endDate)
      ])
    };

    if (babyId) {
      whereCondition.babyId = babyId;
    }

    const result = await db.collection("milk_records")
      .where(whereCondition)
      .orderBy("timestamp", "desc")
      .limit(1000)
      .get();

    return {
      success: true,
      data: result.data
    };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// ========== 宝宝信息相关 ==========

// 添加宝宝
const addBaby = async (event) => {
  try {
    const { nickname, gender, birthDate, avatar } = event.data;
    if (!nickname || !birthDate) {
      return { success: false, errMsg: "请填写完整信息" };
    }

    const wxContext = cloud.getWXContext();
    const result = await db.collection("babies").add({
      data: {
        _openid: wxContext.OPENID,
        nickname,
        gender: gender || "",
        birthDate,
        avatar: avatar || "",
        createdAt: new Date().toISOString()
      }
    });

    return { success: true, data: { _id: result._id } };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取宝宝列表（自己的 + 共享的）
const getBabies = async () => {
  try {
    const wxContext = cloud.getWXContext();
    const openids = await getUserOpenids(wxContext.OPENID);

    const result = await db.collection("babies")
      .where({ _openid: db.command.in(openids) })
      .orderBy("createdAt", "desc")
      .get();

    const data = result.data.map(b => ({ ...b, isOwner: b._openid === wxContext.OPENID }));
    return { success: true, data };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取单个宝宝信息（支持共享访问）
const getBabyById = async (event) => {
  try {
    const { babyId } = event.data;
    if (!babyId) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();
    const openids = await getUserOpenids(wxContext.OPENID);
    const result = await db.collection("babies").doc(babyId).get();

    if (!result.data || !openids.includes(result.data._openid)) {
      return { success: false, errMsg: "无权访问" };
    }

    const data = { ...result.data, isOwner: result.data._openid === wxContext.OPENID };
    return { success: true, data };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 删除宝宝
const deleteBaby = async (event) => {
  try {
    const { babyId } = event.data;
    if (!babyId) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();

    // 先确认宝宝属于当前用户
    const baby = await db.collection("babies").doc(babyId).get();
    if (!baby.data || baby.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权删除" };
    }

    // 删除宝宝
    await db.collection("babies").doc(babyId).remove();

    // 循环删除该宝宝的所有奶量记录（防御性分批删除）
    let hasMore = true;
    while (hasMore) {
      const records = await db.collection("milk_records")
        .where({ babyId })
        .limit(20)
        .get();

      if (records.data.length === 0) {
        hasMore = false;
      } else {
        await db.collection("milk_records")
          .where({ babyId })
          .remove();
      }
    }

    // 循环删除该宝宝的所有身高体重记录
    hasMore = true;
    while (hasMore) {
      const growthRecords = await db.collection("growth_records")
        .where({ babyId })
        .limit(20)
        .get();

      if (growthRecords.data.length === 0) {
        hasMore = false;
      } else {
        await db.collection("growth_records")
          .where({ babyId })
          .remove();
      }
    }

    // 循环删除该宝宝的所有开支记录
    hasMore = true;
    while (hasMore) {
      const expenseRecords = await db.collection("expense_records")
        .where({ babyId })
        .limit(20)
        .get();

      if (expenseRecords.data.length === 0) {
        hasMore = false;
      } else {
        await db.collection("expense_records")
          .where({ babyId })
          .remove();
      }
    }

    // 循环删除该宝宝的所有礼金记录
    hasMore = true;
    while (hasMore) {
      const giftRecords = await db.collection("gift_records")
        .where({ babyId })
        .limit(20)
        .get();

      if (giftRecords.data.length === 0) {
        hasMore = false;
      } else {
        await db.collection("gift_records")
          .where({ babyId })
          .remove();
      }
    }

    // 删除共享记录
    await db.collection("family_shares").where({ babyId }).remove();

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 修改宝宝
const updateBaby = async (event) => {
  try {
    const { babyId, nickname, gender, birthDate, avatar } = event.data;
    if (!babyId || !nickname || !birthDate) {
      return { success: false, errMsg: "请填写完整信息" };
    }

    const wxContext = cloud.getWXContext();

    // 仅宝宝创建者可修改档案（与删除权限保持一致）
    const baby = await db.collection("babies").doc(babyId).get();
    if (!baby.data || baby.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权修改" };
    }

    await db.collection("babies").doc(babyId).update({
      data: {
        nickname,
        gender: gender || "",
        birthDate,
        avatar: avatar || ""
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// ========== 身高体重相关 ==========

// 新增身高体重记录
const addGrowthRecord = async (event) => {
  try {
    const { babyId, height, weight, recordDate } = event.data;
    if (!babyId || !recordDate) {
      return { success: false, errMsg: "参数错误" };
    }
    if (!height && !weight) {
      return { success: false, errMsg: "请填写身高或体重" };
    }

    // 自动创建集合（如果不存在）
    try {
      await db.createCollection("growth_records");
    } catch (e) {
      // 集合已存在，忽略错误
    }

    const wxContext = cloud.getWXContext();
    const result = await db.collection("growth_records").add({
      data: {
        _openid: wxContext.OPENID,
        babyId,
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        recordDate,
        createdAt: new Date().toISOString()
      }
    });

    return { success: true, data: { _id: result._id } };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取宝宝的身高体重记录（分页）
const getGrowthRecords = async (event) => {
  try {
    const { babyId, page, pageSize } = event.data || {};
    if (!babyId) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();
    const size = pageSize || 5;
    const p = page || 1;
    const skip = (p - 1) * size;

    const openids = await getUserOpenids(wxContext.OPENID);

    // 获取总数
    const countRes = await db.collection("growth_records")
      .where({
        _openid: db.command.in(openids),
        babyId
      })
      .count();

    // 获取当前页数据
    const result = await db.collection("growth_records")
      .where({
        _openid: db.command.in(openids),
        babyId
      })
      .orderBy("recordDate", "desc")
      .skip(skip)
      .limit(size)
      .get();

    return {
      success: true,
      data: result.data,
      total: countRes.total,
      page: p,
      pageSize: size
    };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 获取宝宝的身高体重记录（最近N条，用于图表）
const getGrowthRecordsForChart = async (event) => {
  try {
    const { babyId, limit } = event.data || {};
    if (!babyId) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();
    const openids = await getUserOpenids(wxContext.OPENID);
    const where = {
      _openid: db.command.in(openids),
      babyId
    };
    const countRes = await db.collection("growth_records").where(where).count();
    const result = await db.collection("growth_records")
      .where(where)
      .orderBy("recordDate", "desc")
      .limit(limit || 5)
      .get();

    const data = result.data.reverse();
    return { success: true, data, total: countRes.total };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 修改身高体重记录
const updateGrowthRecord = async (event) => {
  try {
    const { _id, height, weight, recordDate } = event.data;
    if (!_id) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();
    const record = await db.collection("growth_records").doc(_id).get();
    if (!record.data || record.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权修改" };
    }

    await db.collection("growth_records").doc(_id).update({
      data: {
        height: height ? Number(height) : null,
        weight: weight ? Number(weight) : null,
        recordDate
      }
    });

    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// 删除身高体重记录
const deleteGrowthRecord = async (event) => {
  try {
    const { _id } = event.data;
    if (!_id) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();
    const record = await db.collection("growth_records").doc(_id).get();
    if (!record.data || record.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权删除" };
    }

    await db.collection("growth_records").doc(_id).remove();
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// ========== 日常开支相关 ==========

const addExpenseRecord = async (event) => {
  try {
    const { babyId, amount, category, recordDate, remark } = event.data;
    if (!babyId || !amount || !category || !recordDate) {
      return { success: false, errMsg: "请填写完整信息" };
    }

    try { await db.createCollection("expense_records"); } catch (e) { }

    const wxContext = cloud.getWXContext();
    await db.collection("expense_records").add({
      data: {
        _openid: wxContext.OPENID,
        babyId,
        amount: Number(amount),
        category,
        recordDate,
        remark: remark || "",
        createdAt: new Date().toISOString()
      }
    });
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const getExpenseRecords = async (event) => {
  try {
    const { babyId, page, pageSize, startDate, endDate, category } = event.data || {};
    if (!babyId) return { success: false, errMsg: "参数错误" };

    const wxContext = cloud.getWXContext();
    const size = pageSize || 10;
    const p = page || 1;

    const openids = await getUserOpenids(wxContext.OPENID);
    const where = { _openid: db.command.in(openids), babyId };
    if (startDate && endDate) {
      where.recordDate = db.command.and([db.command.gte(startDate), db.command.lte(endDate)]);
    }
    if (category) where.category = category;
    const countRes = await db.collection("expense_records").where(where).count();

    const result = await db.collection("expense_records")
      .where(where)
      .orderBy("recordDate", "desc")
      .orderBy("createdAt", "desc")
      .skip((p - 1) * size)
      .limit(size)
      .get();

    return { success: true, data: result.data, total: countRes.total, page: p, pageSize: size };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const updateExpenseRecord = async (event) => {
  try {
    const { _id, amount, category, recordDate, remark } = event.data;
    if (!_id) return { success: false, errMsg: "参数错误" };

    const wxContext = cloud.getWXContext();
    const record = await db.collection("expense_records").doc(_id).get();
    if (!record.data || record.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权修改" };
    }

    await db.collection("expense_records").doc(_id).update({
      data: { amount: Number(amount), category, recordDate, remark: remark || "" }
    });
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const deleteExpenseRecord = async (event) => {
  try {
    const { _id } = event.data;
    if (!_id) return { success: false, errMsg: "参数错误" };

    const wxContext = cloud.getWXContext();
    const record = await db.collection("expense_records").doc(_id).get();
    if (!record.data || record.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权删除" };
    }

    await db.collection("expense_records").doc(_id).remove();
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const getExpenseStats = async (event) => {
  try {
    const { babyId, startDate, endDate, category } = event.data || {};
    if (!babyId || !startDate || !endDate) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();
    const openids = await getUserOpenids(wxContext.OPENID);
    const where = {
      _openid: db.command.in(openids),
      babyId,
      recordDate: db.command.and([db.command.gte(startDate), db.command.lte(endDate)])
    };
    if (category) {
      where.category = category;
    }

    const result = await db.collection("expense_records")
      .where(where)
      .orderBy("recordDate", "desc")
      .limit(1000)
      .get();

    // 按分类聚合
    const categoryMap = {};
    let totalAmount = 0;
    result.data.forEach(r => {
      totalAmount += r.amount;
      categoryMap[r.category] = (categoryMap[r.category] || 0) + r.amount;
    });

    const categories = Object.entries(categoryMap).map(([name, amount]) => ({
      category: name,
      amount: roundMoney(amount),
      percent: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    return { success: true, data: { categories, totalAmount: roundMoney(totalAmount), count: result.data.length } };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// ========== 礼金相关 ==========

const addGiftRecord = async (event) => {
  try {
    const { babyId, amount, source, description, recordDate, remark } = event.data;
    if (!babyId || !amount || !source || !recordDate) {
      return { success: false, errMsg: "请填写完整信息" };
    }

    try { await db.createCollection("gift_records"); } catch (e) { }

    const wxContext = cloud.getWXContext();
    await db.collection("gift_records").add({
      data: {
        _openid: wxContext.OPENID,
        babyId,
        amount: Number(amount),
        source,
        description: description || "",
        recordDate,
        remark: remark || "",
        createdAt: new Date().toISOString()
      }
    });
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const getGiftRecords = async (event) => {
  try {
    const { babyId, page, pageSize, startDate, endDate } = event.data || {};
    if (!babyId) return { success: false, errMsg: "参数错误" };

    const wxContext = cloud.getWXContext();
    const size = pageSize || 10;
    const p = page || 1;

    const openids = await getUserOpenids(wxContext.OPENID);
    const where = { _openid: db.command.in(openids), babyId };
    if (startDate && endDate) {
      where.recordDate = db.command.and([db.command.gte(startDate), db.command.lte(endDate)]);
    }
    const countRes = await db.collection("gift_records").where(where).count();

    const result = await db.collection("gift_records")
      .where(where)
      .orderBy("recordDate", "desc")
      .orderBy("createdAt", "desc")
      .skip((p - 1) * size)
      .limit(size)
      .get();

    return { success: true, data: result.data, total: countRes.total, page: p, pageSize: size };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const updateGiftRecord = async (event) => {
  try {
    const { _id, amount, source, description, recordDate, remark } = event.data;
    if (!_id) return { success: false, errMsg: "参数错误" };

    const wxContext = cloud.getWXContext();
    const record = await db.collection("gift_records").doc(_id).get();
    if (!record.data || record.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权修改" };
    }

    await db.collection("gift_records").doc(_id).update({
      data: { amount: Number(amount), source, description: description || "", recordDate, remark: remark || "" }
    });
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const deleteGiftRecord = async (event) => {
  try {
    const { _id } = event.data;
    if (!_id) return { success: false, errMsg: "参数错误" };

    const wxContext = cloud.getWXContext();
    const record = await db.collection("gift_records").doc(_id).get();
    if (!record.data || record.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权删除" };
    }

    await db.collection("gift_records").doc(_id).remove();
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const getGiftStats = async (event) => {
  try {
    const { babyId, startDate, endDate } = event.data || {};
    if (!babyId || !startDate || !endDate) {
      return { success: false, errMsg: "参数错误" };
    }

    const wxContext = cloud.getWXContext();
    const openids3 = await getUserOpenids(wxContext.OPENID);
    const where = {
      _openid: db.command.in(openids3),
      babyId,
      recordDate: db.command.and([db.command.gte(startDate), db.command.lte(endDate)])
    };

    const result = await db.collection("gift_records")
      .where(where)
      .orderBy("recordDate", "desc")
      .limit(1000)
      .get();

    // 按来源聚合
    const sourceMap = {};
    let totalAmount = 0;
    result.data.forEach(r => {
      totalAmount += r.amount;
      sourceMap[r.source] = (sourceMap[r.source] || 0) + r.amount;
    });

    const sources = Object.entries(sourceMap).map(([name, amount]) => ({
      source: name,
      amount: roundMoney(amount),
      percent: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    return { success: true, data: { sources, totalAmount: roundMoney(totalAmount), count: result.data.length } };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// ========== 家庭共享相关 ==========

const generateShareCode = async (event) => {
  try {
    const { babyId } = event.data;
    if (!babyId) return { success: false, errMsg: "参数错误" };

    const wxContext = cloud.getWXContext();

    // 只有宝宝创建者才能生成/查看共享码
    const baby = await db.collection("babies").doc(babyId).get();
    if (!baby.data || baby.data._openid !== wxContext.OPENID) {
      return { success: false, errMsg: "仅创建者可管理共享" };
    }

    try { await db.createCollection("family_shares"); } catch (e) { }

    // 检查是否已有共享记录
    const existing = await db.collection("family_shares").where({ babyId }).get();
    if (existing.data.length > 0) {
      return { success: true, data: existing.data[0] };
    }

    // 生成 6 位不重复共享码
    let code;
    let attempts = 0;
    while (attempts < 10) {
      code = String(Math.floor(Math.random() * 900000) + 100000);
      const dup = await db.collection("family_shares").where({ shareCode: code }).get();
      if (dup.data.length === 0) break;
      attempts++;
    }

    const result = await db.collection("family_shares").add({
      data: {
        babyId,
        ownerOpenid: wxContext.OPENID,
        sharedOpenids: [],
        shareCode: code,
        createdAt: new Date().toISOString()
      }
    });

    return { success: true, data: { _id: result._id, shareCode: code, sharedOpenids: [] } };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const joinByShareCode = async (event) => {
  try {
    const { shareCode, nickname } = event.data;
    if (!shareCode) return { success: false, errMsg: "请输入共享码" };

    const wxContext = cloud.getWXContext();

    const share = await db.collection("family_shares").where({ shareCode }).get();
    if (share.data.length === 0) {
      return { success: false, errMsg: "共享码无效" };
    }

    const record = share.data[0];

    // 不能加入自己创建的共享
    if (record.ownerOpenid === wxContext.OPENID) {
      return { success: false, errMsg: "这是您创建的共享" };
    }

    // 检查是否已在共享列表中
    const members = record.sharedOpenids || [];
    if (members.some(m => (typeof m === 'string' ? m : m.openid) === wxContext.OPENID)) {
      return { success: false, errMsg: "您已加入该共享" };
    }

    members.push({ openid: wxContext.OPENID, nickname: nickname || '家人' });

    await db.collection("family_shares").doc(record._id).update({
      data: { sharedOpenids: members }
    });

    // 返回共享宝宝的基本信息
    const baby = await db.collection("babies").doc(record.babyId).get();
    return {
      success: true,
      data: { babyId: record.babyId, baby: baby.data }
    };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const getShareInfo = async (event) => {
  try {
    const { babyId } = event.data;
    if (!babyId) return { success: false, errMsg: "参数错误" };

    const wxContext = cloud.getWXContext();
    const share = await db.collection("family_shares").where({ babyId }).get();

    if (share.data.length === 0) {
      return { success: true, data: null };
    }

    const record = share.data[0];
    if (record.ownerOpenid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权查看" };
    }

    // 统一 sharedOpenids 格式：兼容旧的字符串数组和新的对象数组
    record.sharedOpenids = (record.sharedOpenids || []).map(item => {
      if (typeof item === 'string') return { openid: item, nickname: '旧成员' };
      return item;
    });

    return { success: true, data: record };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

const removeSharedUser = async (event) => {
  try {
    const { babyId, targetOpenid } = event.data;
    if (!babyId || !targetOpenid) return { success: false, errMsg: "参数错误" };

    const wxContext = cloud.getWXContext();
    const share = await db.collection("family_shares").where({ babyId }).get();

    if (share.data.length === 0) return { success: false, errMsg: "共享记录不存在" };

    const record = share.data[0];
    if (record.ownerOpenid !== wxContext.OPENID) {
      return { success: false, errMsg: "无权操作" };
    }

    const updated = (record.sharedOpenids || []).filter(item => {
      const id = typeof item === 'string' ? item : item.openid;
      return id !== targetOpenid;
    });
    await db.collection("family_shares").doc(record._id).update({
      data: { sharedOpenids: updated }
    });

    return { success: true, data: { sharedOpenids: updated } };
  } catch (e) {
    return { success: false, errMsg: e.message };
  }
};

// const getOpenId = require('./getOpenId/index');
// const getMiniProgramCode = require('./getMiniProgramCode/index');
// const createCollection = require('./createCollection/index');
// const selectRecord = require('./selectRecord/index');
// const updateRecord = require('./updateRecord/index');
// const fetchGoodsList = require('./fetchGoodsList/index');
// const genMpQrcode = require('./genMpQrcode/index');
// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    case "addMilkRecord":
      return await addMilkRecord(event);
    case "getTodayRecords":
      return await getTodayRecords(event);
    case "deleteMilkRecord":
      return await deleteMilkRecord(event);
    case "updateMilkRecord":
      return await updateMilkRecord(event);
    case "getMilkRecordsByDateRange":
      return await getMilkRecordsByDateRange(event);
    case "addBaby":
      return await addBaby(event);
    case "getBabies":
      return await getBabies();
    case "getBabyById":
      return await getBabyById(event);
    case "deleteBaby":
      return await deleteBaby(event);
    case "updateBaby":
      return await updateBaby(event);
    case "addGrowthRecord":
      return await addGrowthRecord(event);
    case "getGrowthRecords":
      return await getGrowthRecords(event);
    case "getGrowthRecordsForChart":
      return await getGrowthRecordsForChart(event);
    case "updateGrowthRecord":
      return await updateGrowthRecord(event);
    case "deleteGrowthRecord":
      return await deleteGrowthRecord(event);
    case "addExpenseRecord":
      return await addExpenseRecord(event);
    case "getExpenseRecords":
      return await getExpenseRecords(event);
    case "updateExpenseRecord":
      return await updateExpenseRecord(event);
    case "deleteExpenseRecord":
      return await deleteExpenseRecord(event);
    case "getExpenseStats":
      return await getExpenseStats(event);
    case "addGiftRecord":
      return await addGiftRecord(event);
    case "getGiftRecords":
      return await getGiftRecords(event);
    case "updateGiftRecord":
      return await updateGiftRecord(event);
    case "deleteGiftRecord":
      return await deleteGiftRecord(event);
    case "getGiftStats":
      return await getGiftStats(event);
    case "generateShareCode":
      return await generateShareCode(event);
    case "joinByShareCode":
      return await joinByShareCode(event);
    case "getShareInfo":
      return await getShareInfo(event);
    case "removeSharedUser":
      return await removeSharedUser(event);
    default:
      return { success: false, errMsg: "未知的操作类型: " + event.type };
  }
};
