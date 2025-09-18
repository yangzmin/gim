<template>
  <div class="friend-list">
    <!-- 搜索框 -->
    <div class="search-section">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索好友..."
        prefix-icon="el-icon-search"
        size="small"
        clearable
        @input="handleSearch"
      />
    </div>

    <!-- 在线好友 -->
    <div v-if="onlineFriends.length > 0" class="friend-section">
      <div class="section-header">
        <span class="section-title">在线好友 ({{ onlineFriends.length }})</span>
        <i 
          class="el-icon-arrow-down toggle-icon"
          :class="{ 'collapsed': !showOnline }"
          @click="showOnline = !showOnline"
        ></i>
      </div>
      <div v-show="showOnline" class="friend-items">
        <div
          v-for="friend in filteredOnlineFriends"
          :key="friend.userID"
          class="friend-item"
          :class="{ 'active': selectedFriend?.userID === friend.userID }"
          @click="$emit('select-friend', friend)"
        >
          <div class="avatar-container">
            <div class="avatar">
              <img v-if="friend.avatar" :src="friend.avatar" :alt="friend.nickname" />
              <span v-else>{{ friend.nickname?.charAt(0) || 'U' }}</span>
            </div>
            <div class="online-status online"></div>
          </div>
          <div class="friend-info">
            <div class="friend-name">{{ friend.nickname }}</div>
            <div class="last-seen">在线</div>
          </div>
          <div class="friend-actions">
            <el-badge 
              v-if="friend.unreadCount > 0" 
              :value="friend.unreadCount > 99 ? '99+' : friend.unreadCount"
              class="unread-badge"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 离线好友 -->
    <div v-if="offlineFriends.length > 0" class="friend-section">
      <div class="section-header">
        <span class="section-title">离线好友 ({{ offlineFriends.length }})</span>
        <i 
          class="el-icon-arrow-down toggle-icon"
          :class="{ 'collapsed': !showOffline }"
          @click="showOffline = !showOffline"
        ></i>
      </div>
      <div v-show="showOffline" class="friend-items">
        <div
          v-for="friend in filteredOfflineFriends"
          :key="friend.userID"
          class="friend-item"
          :class="{ 'active': selectedFriend?.userID === friend.userID }"
          @click="$emit('select-friend', friend)"
        >
          <div class="avatar-container">
            <div class="avatar">
              <img v-if="friend.avatar" :src="friend.avatar" :alt="friend.nickname" />
              <span v-else>{{ friend.nickname?.charAt(0) || 'U' }}</span>
            </div>
            <div class="online-status offline"></div>
          </div>
          <div class="friend-info">
            <div class="friend-name">{{ friend.nickname }}</div>
            <div class="last-seen">{{ formatLastSeen(friend.lastSeen) }}</div>
          </div>
          <div class="friend-actions">
            <el-badge 
              v-if="friend.unreadCount > 0" 
              :value="friend.unreadCount > 99 ? '99+' : friend.unreadCount"
              class="unread-badge"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="friends.length === 0 && !loading" class="empty-state">
      <i class="el-icon-user empty-icon"></i>
      <p>暂无好友</p>
      <el-button type="text" @click="$emit('add-friend')">
        <i class="el-icon-plus"></i>
        添加好友
      </el-button>
    </div>

    <!-- 搜索无结果 -->
    <div v-if="searchKeyword && filteredFriends.length === 0" class="empty-state">
      <i class="el-icon-search empty-icon"></i>
      <p>未找到相关好友</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <i class="el-icon-loading"></i>
      <p>加载中...</p>
    </div>

    <!-- 添加好友按钮 -->
    <div v-if="friends.length > 0" class="add-friend-btn">
      <el-button 
        type="primary" 
        size="small" 
        icon="el-icon-plus"
        @click="$emit('add-friend')"
      >
        添加好友
      </el-button>
    </div>
  </div>
</template>

<script>
import { formatTime } from '@/utils/helpers'
import { debounce } from '@/utils/helpers'

export default {
  name: 'FriendList',
  props: {
    friends: {
      type: Array,
      default: () => []
    },
    selectedFriend: {
      type: Object,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      searchKeyword: '',
      showOnline: true,
      showOffline: true,
      filteredFriends: []
    }
  },
  computed: {
    onlineFriends() {
      return this.friends.filter(friend => friend.isOnline)
    },
    offlineFriends() {
      return this.friends.filter(friend => !friend.isOnline)
    },
    filteredOnlineFriends() {
      return this.filterFriends(this.onlineFriends)
    },
    filteredOfflineFriends() {
      return this.filterFriends(this.offlineFriends)
    }
  },
  watch: {
    friends: {
      handler() {
        this.updateFilteredFriends()
      },
      immediate: true
    }
  },
  created() {
    // 创建防抖搜索函数
    this.debouncedSearch = debounce(this.updateFilteredFriends, 300)
  },
  methods: {
    handleSearch() {
      this.debouncedSearch()
    },

    updateFilteredFriends() {
      this.filteredFriends = this.filterFriends(this.friends)
    },

    filterFriends(friendList) {
      if (!this.searchKeyword.trim()) {
        return friendList
      }
      
      const keyword = this.searchKeyword.toLowerCase()
      return friendList.filter(friend => {
        return friend.nickname?.toLowerCase().includes(keyword) ||
               friend.userID?.toLowerCase().includes(keyword)
      })
    },

    formatLastSeen(lastSeen) {
      if (!lastSeen) return '很久之前'
      return formatTime(lastSeen)
    }
  }
}
</script>

<style lang="scss" scoped>
.friend-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 0; // 使flex生效
}

.search-section {
  padding: 16px;
  border-bottom: 1px solid #f2f6fc;
}

.friend-section {
  .section-header {
    padding: 12px 16px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    
    &:hover {
      background: #f8f9fa;
    }
  }

  .section-title {
    font-size: 12px;
    color: #909399;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .toggle-icon {
    font-size: 12px;
    color: #c0c4cc;
    transition: transform 0.3s;
    
    &.collapsed {
      transform: rotate(-90deg);
    }
  }
}

.friend-items {
  overflow-y: auto;
  max-height: 300px;
}

.friend-item {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f8f9fa;

  &:hover {
    background: #f8f9fa;
  }

  &.active {
    background: #409eff;
    color: white;

    .friend-name,
    .last-seen {
      color: white;
    }

    .online-status.offline {
      background: rgba(255, 255, 255, 0.6);
    }
  }

  &:last-child {
    border-bottom: none;
  }
}

.avatar-container {
  position: relative;
  margin-right: 12px;
  flex-shrink: 0;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
}

.online-status {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid white;

  &.online {
    background: #67c23a;
  }

  &.offline {
    background: #c0c4cc;
  }
}

.friend-info {
  flex: 1;
  min-width: 0;
}

.friend-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.last-seen {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.friend-actions {
  flex-shrink: 0;
}

.unread-badge {
  :deep(.el-badge__content) {
    background: #f56c6c;
    border: none;
    font-size: 10px;
    height: 16px;
    line-height: 16px;
    padding: 0 5px;
    min-width: 16px;
  }
}

.empty-state,
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  text-align: center;
  padding: 40px 20px;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    color: #c0c4cc;
  }

  p {
    margin-bottom: 16px;
    font-size: 14px;
  }
}

.add-friend-btn {
  padding: 16px;
  border-top: 1px solid #f2f6fc;
  text-align: center;

  .el-button {
    width: 100%;
  }
}

// 滚动条样式
.friend-items::-webkit-scrollbar {
  width: 4px;
}

.friend-items::-webkit-scrollbar-track {
  background: transparent;
}

.friend-items::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 2px;
}

.friend-items::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}
</style>