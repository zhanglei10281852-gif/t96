import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import { useUserStore } from "@/stores/user";

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/Login.vue"),
    meta: { title: "登录", requiresAuth: false },
  },
  {
    path: "/",
    component: () => import("@/layouts/MainLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: "/dashboard",
      },
      {
        path: "dashboard",
        name: "Dashboard",
        component: () => import("@/views/Dashboard.vue"),
        meta: { title: "仪表盘", icon: "DashboardOutlined" },
      },
      {
        path: "elderly",
        name: "Elderly",
        component: () => import("@/views/Elderly.vue"),
        meta: {
          title: "老人管理",
          icon: "UserOutlined",
          roles: ["admin", "worker"],
        },
      },
      {
        path: "orders",
        name: "Orders",
        component: () => import("@/views/Orders.vue"),
        meta: { title: "订单管理", icon: "ShoppingCartOutlined" },
      },
      {
        path: "canteens",
        name: "Canteens",
        component: () => import("@/views/Canteens.vue"),
        meta: { title: "助餐点管理", icon: "ShopOutlined", roles: ["admin"] },
      },
      {
        path: "subsidy",
        name: "Subsidy",
        component: () => import("@/views/Subsidy.vue"),
        meta: {
          title: "补贴报表",
          icon: "FileTextOutlined",
          roles: ["admin", "worker"],
        },
      },
      {
        path: "suppliers",
        name: "Suppliers",
        component: () => import("@/views/Suppliers.vue"),
        meta: {
          title: "供应商管理",
          icon: "TeamOutlined",
          roles: ["admin", "canteen"],
        },
      },
      {
        path: "inventory",
        name: "Inventory",
        component: () => import("@/views/Inventory.vue"),
        meta: {
          title: "食材库存",
          icon: "StockOutlined",
          roles: ["admin", "canteen"],
        },
      },
      {
        path: "purchases",
        name: "Purchases",
        component: () => import("@/views/Purchases.vue"),
        meta: {
          title: "采购管理",
          icon: "ShoppingOutlined",
          roles: ["admin", "canteen"],
        },
      },
      {
        path: "stock-ops",
        name: "StockOps",
        component: () => import("@/views/StockOps.vue"),
        meta: {
          title: "出入库流水",
          icon: "SwapOutlined",
          roles: ["admin", "canteen"],
        },
      },
      {
        path: "analytics",
        name: "Analytics",
        component: () => import("@/views/Analytics.vue"),
        meta: {
          title: "成本分析",
          icon: "BarChartOutlined",
          roles: ["admin", "canteen"],
        },
      },
      {
        path: "inventory-checks",
        name: "InventoryChecks",
        component: () => import("@/views/InventoryChecks.vue"),
        meta: {
          title: "库存盘点",
          icon: "CheckSquareOutlined",
          roles: ["admin", "canteen"],
        },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const userStore = useUserStore();
  userStore.initFromStorage();

  if (!userStore.isLoggedIn && to.meta.requiresAuth !== false) {
    next({ path: "/login", query: { redirect: to.fullPath } });
    return;
  }

  if (to.meta.roles && userStore.userInfo?.role) {
    const roles = to.meta.roles as string[];
    if (!roles.includes(userStore.userInfo.role)) {
      next("/dashboard");
      return;
    }
  }

  if (to.path === "/login" && userStore.isLoggedIn) {
    next("/dashboard");
    return;
  }

  next();
});

export default router;
