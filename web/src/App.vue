<template>
  <div class="app-shell">
    <RouterView />
    <nav v-if="!isPublic" class="bottom-nav">
      <RouterLink to="/chat">聊天</RouterLink>
      <RouterLink to="/characters">角色</RouterLink>
      <RouterLink to="/worldbooks">世界书</RouterLink>
      <RouterLink to="/tools">工具</RouterLink>
      <RouterLink to="/media">资源</RouterLink>
      <RouterLink to="/connections">连接</RouterLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const isPublic = computed(() => route.meta.public === true);
</script>
