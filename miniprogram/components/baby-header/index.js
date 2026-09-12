Component({
  properties: {
    baby: {
      type: Object,
      value: {},
      observer(newVal) {
        this._convertAvatar(newVal);
      }
    }
  },
  data: {
    displayAvatar: ''
  },
  methods: {
    _convertAvatar(baby) {
      if (!baby || !baby.avatar) {
        this.setData({ displayAvatar: '' });
        return;
      }
      // 非云文件直接使用
      if (!baby.avatar.startsWith('cloud://')) {
        this.setData({ displayAvatar: baby.avatar });
        return;
      }
      // 先尝试获取临时链接
      wx.cloud.getTempFileURL({ fileList: [baby.avatar] }).then(res => {
        const f = res.fileList[0];
        if (f && f.status === 0 && f.tempFileURL) {
          this.setData({ displayAvatar: f.tempFileURL });
          return;
        }
        // 临时链接失败，尝试下载文件
        return wx.cloud.downloadFile({ fileID: baby.avatar });
      }).then(downloadRes => {
        if (downloadRes && downloadRes.tempFilePath) {
          this.setData({ displayAvatar: downloadRes.tempFilePath });
        }
      }).catch(() => {
        this.setData({ displayAvatar: '' });
      });
    },
    onTapAvatar() {
      if (this.data.baby && this.data.baby.isOwner === false) {
        wx.showToast({ title: '仅创建者可编辑', icon: 'none' });
        return;
      }
      this.triggerEvent('tapedit');
    }
  }
});
