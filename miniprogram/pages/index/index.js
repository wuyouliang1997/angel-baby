function calcDays(birthDate) { const birth = new Date(birthDate); return Math.floor((new Date() - birth) / 86400000); }
function calcAge(birthDate) { const birth = new Date(birthDate); const today = new Date(); let y = today.getFullYear() - birth.getFullYear(); let m = today.getMonth() - birth.getMonth(); let d = today.getDate() - birth.getDate(); if (d < 0) { m--; d += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); } if (m < 0) { y--; m += 12; } let r = ''; if (y > 0) r += y + '年'; if (m > 0) r += m + '月'; return r + d + '日'; }

Page({
  data: {
    babies: [],
    currentBaby: null,
    showJoinModal: false,
    joinCode: '',
    joinNickname: ''
  },

  onShow() {
    this.loadBabies();
  },

  async loadBabies() {
    const res = await this.callCloudFunction('getBabies');
    if (res && res.success) {
      const babies = (res.data || []).map(baby => ({
        ...baby,
        days: calcDays(baby.birthDate),
        age: calcAge(baby.birthDate)
      }));

      // 转换云文件ID为临时链接（共享宝宝的头像也能显示）
      for (const b of babies) {
        if (!b.avatar || !b.avatar.startsWith('cloud://')) continue;
        try {
          const tempRes = await wx.cloud.getTempFileURL({ fileList: [b.avatar] });
          if (tempRes.fileList[0] && tempRes.fileList[0].status === 0) {
            b.avatar = tempRes.fileList[0].tempFileURL;
          } else {
            const dl = await wx.cloud.downloadFile({ fileID: b.avatar });
            b.avatar = dl.tempFilePath || '';
          }
        } catch (e) { b.avatar = ''; }
      }

      // 保留当前选中的宝宝，如果已删除则回退到第一个
      let currentBaby = this.data.currentBaby;
      if (currentBaby) {
        const found = babies.find(b => b._id === currentBaby._id);
        currentBaby = found || (babies.length > 0 ? babies[0] : null);
      } else {
        currentBaby = babies.length > 0 ? babies[0] : null;
      }

      this.setData({ babies, currentBaby });
    }
  },

  toggleAddForm() {
    wx.navigateTo({ url: '/pages/babyForm/index' });
  },

  onEditBaby(e) {
    const { id, nickname, gender, birthdate, avatar } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/babyForm/index?babyId=${id}&nickname=${encodeURIComponent(nickname || '')}&gender=${encodeURIComponent(gender || '')}&birthDate=${birthdate || ''}&avatar=${encodeURIComponent(avatar || '')}`
    });
  },

  onDeleteBaby(e) {
    const babyId = e.currentTarget.dataset.id;
    const babyName = e.currentTarget.dataset.name;

    wx.showModal({
      title: '删除确认',
      content: `确定删除宝宝"${babyName}"吗？\n删除后相关奶量记录也会被删除`,
      confirmColor: '#ff6b6b',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          const result = await this.callCloudFunction('deleteBaby', { babyId });
          wx.hideLoading();

          if (result && result.success) {
            wx.showToast({ title: '已删除', icon: 'success' });
            this.loadBabies();
          } else {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  onSwitchBaby() {
    wx.showActionSheet({
      itemList: this.data.babies.map(baby => baby.nickname),
      success: (res) => {
        const selectedBaby = this.data.babies[res.tapIndex];
        this.setData({ currentBaby: selectedBaby });
      }
    });
  },

  goToBabyPage(e) {
    if (!this.data.currentBaby) {
      wx.showToast({ title: '请先添加宝宝', icon: 'none' });
      return;
    }
    const babyId = this.data.currentBaby._id;
    wx.navigateTo({ url: `/pages/home/index?babyId=${babyId}` });
  },

  goToGrowth() {
    if (!this.data.currentBaby) {
      wx.showToast({ title: '请先添加宝宝', icon: 'none' });
      return;
    }
    const babyId = this.data.currentBaby._id;
    wx.navigateTo({ url: `/pages/growth/index?babyId=${babyId}` });
  },

  goToLedger() {
    if (!this.data.currentBaby) {
      wx.showToast({ title: '请先添加宝宝', icon: 'none' });
      return;
    }
    const babyId = this.data.currentBaby._id;
    wx.navigateTo({ url: `/pages/ledger/index?babyId=${babyId}` });
  },

  goToShare() {
    if (!this.data.currentBaby) return;
    wx.navigateTo({ url: `/pages/share/index?babyId=${this.data.currentBaby._id}` });
  },

  showJoinModal() {
    this.setData({ showJoinModal: true, joinCode: '', joinNickname: '' });
  },

  hideJoinModal() {
    this.setData({ showJoinModal: false, joinCode: '', joinNickname: '' });
  },

  onJoinCodeInput(e) {
    this.setData({ joinCode: e.detail.value });
  },

  onJoinNicknameInput(e) {
    this.setData({ joinNickname: e.detail.value });
  },

  async onJoinSubmit() {
    const code = this.data.joinCode.trim();
    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位共享码', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '加入中...' });
    const res = await this.callCloudFunction('joinByShareCode', { shareCode: code, nickname: this.data.joinNickname.trim() });
    wx.hideLoading();
    if (res && res.success) {
      wx.showToast({ title: '加入成功', icon: 'success' });
      this.setData({ showJoinModal: false, joinCode: '' });
      this.loadBabies();
    } else {
      wx.showToast({ title: res.errMsg || '加入失败', icon: 'none' });
    }
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
