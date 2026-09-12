function getTodayStr() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }

Page({
  data: {
    isEdit: false,
    babyId: '',
    nickname: '',
    gender: '',
    birthDate: '',
    avatar: '',
    today: getTodayStr()
  },

  onLoad(options) {
    if (options.babyId) {
      this.setData({
        isEdit: true,
        babyId: options.babyId,
        nickname: decodeURIComponent(options.nickname || ''),
        gender: decodeURIComponent(options.gender || ''),
        birthDate: options.birthDate || '',
        avatar: decodeURIComponent(options.avatar || '')
      });
    }
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onGenderChange(e) {
    const genderList = ['男', '女'];
    this.setData({ gender: genderList[e.detail.value] });
  },

  onBirthDateChange(e) {
    this.setData({ birthDate: e.detail.value });
  },

  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        wx.navigateTo({
          url: `/pages/cropper/index?src=${tempFilePath}`,
          events: {
            cropResult: (data) => {
              this.uploadAvatar(data.tempFilePath);
            }
          }
        });
      }
    });
  },

  async uploadAvatar(filePath) {
    wx.showLoading({ title: '上传中...' });
    try {
      const fs = wx.getFileSystemManager();
      const data = fs.readFileSync(filePath, 'base64');
      this.setData({ avatar: 'data:image/jpeg;base64,' + data });
      wx.showToast({ title: '头像已选择', icon: 'success' });
    } catch (err) {
      console.error('Upload failed:', err);
      wx.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onCancel() {
    wx.navigateBack();
  },

  async onSubmit() {
    const { isEdit, babyId, nickname, gender, birthDate, avatar } = this.data;

    if (!nickname) {
      wx.showToast({ title: '请输入宝宝昵称', icon: 'none' });
      return;
    }
    if (!birthDate) {
      wx.showToast({ title: '请选择出生日期', icon: 'none' });
      return;
    }

    wx.showLoading({ title: isEdit ? '保存中...' : '添加中...' });
    const res = await this.callCloudFunction(isEdit ? 'updateBaby' : 'addBaby', {
      babyId,
      nickname,
      gender,
      birthDate,
      avatar
    });
    wx.hideLoading();

    if (res && res.success) {
      wx.showToast({ title: isEdit ? '修改成功' : '添加成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.showToast({ title: isEdit ? '修改失败' : '添加失败', icon: 'none' });
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