Page({
  data: {
    babyId: '',
    baby: null,
    latestRecord: null
  },

  onLoad(options) {
    if (options.babyId) {
      this.setData({ babyId: options.babyId });
      this.loadBabyInfo();
      this.loadLatestRecord();
    }
  },

  onShow() {
    if (this.data.babyId) {
      this.loadBabyInfo();
      this.loadLatestRecord();
    }
  },

  onEditBaby() {
    const { baby } = this.data;
    if (!baby) return;
    wx.navigateTo({
      url: `/pages/babyForm/index?babyId=${baby._id}&nickname=${encodeURIComponent(baby.nickname)}&gender=${encodeURIComponent(baby.gender || '')}&birthDate=${baby.birthDate}&avatar=${encodeURIComponent(baby.avatar || '')}`
    });
  },

  async loadBabyInfo() {
    const res = await this.callCloudFunction('getBabyById', {
      babyId: this.data.babyId
    });
    if (res && res.success) {
      this.setData({ baby: res.data });
    }
  },

  async loadLatestRecord() {
    const res = await this.callCloudFunction('getGrowthRecords', {
      babyId: this.data.babyId,
      page: 1,
      pageSize: 1
    });
    if (res && res.success && res.data.length > 0) {
      this.setData({ latestRecord: res.data[0] });
    } else {
      this.setData({ latestRecord: null });
    }
  },

  goToRecord() {
    wx.navigateTo({
      url: `/pages/growthRecord/index?babyId=${this.data.babyId}`
    });
  },

  goToAnalysis() {
    wx.navigateTo({
      url: `/pages/growthAnalysis/index?babyId=${this.data.babyId}`
    });
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
