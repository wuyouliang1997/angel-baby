Page({
  data: {
    babyId: '',
    baby: null,
    monthExpense: 0,
    monthGift: 0
  },

  onLoad(options) {
    if (options.babyId) {
      this.setData({ babyId: options.babyId });
      this.loadBabyInfo();
      this.loadMonthStats();
    }
  },

  onShow() {
    if (this.data.babyId) {
      this.loadBabyInfo();
      this.loadMonthStats();
    }
  },

  async loadBabyInfo() {
    const res = await this.callCloudFunction('getBabyById', { babyId: this.data.babyId });
    if (res && res.success) {
      this.setData({ baby: res.data });
    }
  },

  async loadMonthStats() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const startDate = `${y}-${m}-01`;
    const endDate = `${y}-${m}-${String(now.getDate()).padStart(2, '0')}`;

    const expenseRes = await this.callCloudFunction('getExpenseStats', {
      babyId: this.data.babyId, startDate, endDate
    });
    if (expenseRes && expenseRes.success) {
      this.setData({ monthExpense: expenseRes.data.totalAmount });
    }

    const giftRes = await this.callCloudFunction('getGiftStats', {
      babyId: this.data.babyId, startDate, endDate
    });
    if (giftRes && giftRes.success) {
      this.setData({ monthGift: giftRes.data.totalAmount });
    }
  },

  onEditBaby() {
    const { baby } = this.data;
    if (!baby) return;
    wx.navigateTo({
      url: `/pages/babyForm/index?babyId=${baby._id}&nickname=${encodeURIComponent(baby.nickname)}&gender=${encodeURIComponent(baby.gender || '')}&birthDate=${baby.birthDate}&avatar=${encodeURIComponent(baby.avatar || '')}`
    });
  },

  goToExpense() {
    wx.navigateTo({ url: `/pages/expenseRecord/index?babyId=${this.data.babyId}` });
  },

  goToGift() {
    wx.navigateTo({ url: `/pages/giftRecord/index?babyId=${this.data.babyId}` });
  },

  async callCloudFunction(type, data = {}) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type, data }
      });
      return res.result;
    } catch (err) {
      console.error(`[${type}] failed:`, err);
      return { success: false, errMsg: err.errMsg };
    }
  }
});
