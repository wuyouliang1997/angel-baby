Page({
  data: {
    babyId: '',
    shareInfo: null,
    loading: true,
    isOwner: true
  },

  onLoad(options) {
    if (options.babyId) this.setData({ babyId: options.babyId });
  },

  onShow() {
    if (this.data.babyId) this.loadShareInfo();
  },

  async loadShareInfo() {
    this.setData({ loading: true });
    const res = await this.callCloudFunction('getShareInfo', { babyId: this.data.babyId });
    if (res && res.success) {
      this.setData({ shareInfo: res.data, isOwner: true, loading: false });
    } else if (res && res.errMsg === '无权查看') {
      this.setData({ shareInfo: null, isOwner: false, loading: false });
    } else {
      wx.showToast({ title: res.errMsg || '加载失败', icon: 'none' });
      this.setData({ shareInfo: null, isOwner: true, loading: false });
    }
  },

  async generate() {
    if (!this.data.isOwner) return;
    wx.showLoading({ title: '生成中...' });
    const res = await this.callCloudFunction('generateShareCode', { babyId: this.data.babyId });
    wx.hideLoading();
    if (res && res.success) {
      this.setData({ shareInfo: res.data });
      wx.showToast({ title: '共享码已生成', icon: 'success' });
    } else {
      wx.showToast({ title: res.errMsg || '生成失败', icon: 'none' });
    }
  },

  async removeUser(e) {
    const openid = e.currentTarget.dataset.openid;
    wx.showModal({
      title: '确认移除',
      content: '确定移除该共享成员吗？',
      success: async (result) => {
        if (result.confirm) {
          const res = await this.callCloudFunction('removeSharedUser', { babyId: this.data.babyId, targetOpenid: openid });
          if (res && res.success) {
            wx.showToast({ title: '已移除' });
            this.loadShareInfo();
          }
        }
      }
    });
  },

  copyCode() {
    wx.setClipboardData({
      data: this.data.shareInfo.shareCode,
      success: () => { wx.showToast({ title: '已复制' }); }
    });
  },

  async callCloudFunction(type, data = {}) {
    try {
      const res = await wx.cloud.callFunction({ name: 'quickstartFunctions', data: { type, data } });
      return res.result;
    } catch (err) {
      return { success: false, errMsg: err.errMsg };
    }
  }
});
