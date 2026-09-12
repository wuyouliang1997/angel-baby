function getTodayStr() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
function calcDays(birthDate) { const birth = new Date(birthDate); return Math.floor((new Date() - birth) / 86400000); }
function calcAge(birthDate) { const birth = new Date(birthDate); const today = new Date(); let y = today.getFullYear() - birth.getFullYear(); let m = today.getMonth() - birth.getMonth(); let d = today.getDate() - birth.getDate(); if (d < 0) { m--; d += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); } if (m < 0) { y--; m += 12; } let r = ''; if (y > 0) r += y + '年'; if (m > 0) r += m + '月'; return r + d + '日'; }

Page({
  data: {
    babyId: '',
    baby: null,
    days: 0,
    age: '',
    todayAmount: 0,
    todayCount: 0
  },

  onLoad(options) {
    if (options.babyId) {
      this.setData({ babyId: options.babyId });
      this.loadBabyInfo();
      this.loadTodayRecords();
    } else {
      wx.showToast({ title: '请先添加宝宝', icon: 'none' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onShow() {
    if (this.data.babyId) {
      this.loadBabyInfo();
      this.loadTodayRecords();
    }
  },

  async loadBabyInfo() {
    const res = await this.callCloudFunction('getBabyById', {
      babyId: this.data.babyId
    });
    if (res && res.success) {
      const baby = res.data;
      const days = calcDays(baby.birthDate);
      const age = calcAge(baby.birthDate);
      this.setData({ baby, days, age });
    }
  },

  async loadTodayRecords() {
    const res = await this.callCloudFunction('getTodayRecords', {
      date: getTodayStr(),
      babyId: this.data.babyId
    });
    if (res && res.success) {
      this.setData({
        todayAmount: res.total || 0,
        todayCount: res.count || 0
      });
    }
  },

  goToMilkRecord() {
    wx.navigateTo({
      url: `/pages/milkRecord/index?babyId=${this.data.babyId}`
    });
  },

  goToAnalysis() {
    wx.navigateTo({
      url: `/pages/milkAnalysis/index?babyId=${this.data.babyId}`
    });
  },

  onEditBaby() {
    const { baby } = this.data;
    wx.navigateTo({
      url: `/pages/babyForm/index?babyId=${this.data.babyId}&nickname=${encodeURIComponent(baby.nickname || '')}&gender=${encodeURIComponent(baby.gender || '')}&birthDate=${baby.birthDate}&avatar=${encodeURIComponent(baby.avatar || '')}`
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
