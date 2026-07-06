import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("coordi/:ocid", "routes/coordi-detail.tsx"),
  route("like/:ocid", "routes/like.tsx"),
  route("api/item-suggestions", "routes/item-suggestions.tsx"),
  route("api/ranking", "routes/api.ranking.tsx"),
  route("api/cron/crawl", "routes/api.cron.crawl.tsx"),
] satisfies RouteConfig;
